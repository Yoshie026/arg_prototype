const { Pool } = require('pg');
const crypto = require('crypto');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

function generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
}

function rowToGame(row) {
    return {
        code: row.code,
        state: row.state,
        round: row.round,
        players: {
            creator: { name: row.creator_name, token: row.creator_token, score: row.creator_score },
            joiner: row.joiner_name
                ? { name: row.joiner_name, token: row.joiner_token, score: row.joiner_score }
                : null,
        },
        currentSetter: row.current_setter,
        targetLocation: row.target_location,
        attempts: row.attempts || [],
        createdAt: row.created_at,
    };
}

async function loadGame(code) {
    const { rows } = await pool.query(
        'SELECT code, state, round, creator_name, creator_token, creator_score, joiner_name, joiner_token, joiner_score, current_setter, target_location, attempts, created_at FROM games WHERE code = $1',
        [code]
    );
    if (rows.length === 0) return null;
    return rowToGame(rows[0]);
}

function getRole(game, token) {
    if (game.players.creator && game.players.creator.token === token) return 'creator';
    if (game.players.joiner && game.players.joiner.token === token) return 'joiner';
    return null;
}

async function createGame(playerName) {
    const token = crypto.randomUUID();
    let code;

    for (let i = 0; i < 10; i++) {
        code = generateCode();
        try {
            await pool.query(
                'INSERT INTO games (code, creator_name, creator_token) VALUES ($1, $2, $3)',
                [code, playerName, token]
            );
            break;
        } catch (err) {
            if (err.code === '23505' && i < 9) continue;
            throw err;
        }
    }

    const game = await loadGame(code);
    return { game, token };
}

async function joinGame(code, playerName) {
    const game = await loadGame(code);
    if (!game) return { error: 'Game not found' };
    if (game.players.joiner) return { error: 'Game is full' };

    const token = crypto.randomUUID();
    await pool.query(
        `UPDATE games SET joiner_name = $1, joiner_token = $2, state = 'setting' WHERE code = $3`,
        [playerName, token, code]
    );

    const updated = await loadGame(code);
    return { game: updated, token };
}

async function uploadTarget(code, token, audioBuffer, location) {
    const game = await loadGame(code);
    if (!game) return { error: 'Game not found' };

    const role = getRole(game, token);
    if (!role) return { error: 'Not a player in this game' };
    if (role !== game.currentSetter) return { error: 'Not your turn to set' };
    if (game.state !== 'setting') return { game }; // already moved on

    await pool.query(
        `UPDATE games SET target_audio = $1, target_location = $2, state = 'matching', attempts = '[]'::jsonb, attempt_audio = NULL WHERE code = $3`,
        [audioBuffer, location ? JSON.stringify(location) : null, code]
    );

    const updated = await loadGame(code);
    return { game: updated };
}

async function getTargetAudio(code) {
    const { rows } = await pool.query('SELECT target_audio FROM games WHERE code = $1', [code]);
    if (rows.length === 0 || !rows[0].target_audio) return null;
    return rows[0].target_audio;
}

async function getAttemptAudio(code) {
    const { rows } = await pool.query('SELECT attempt_audio FROM games WHERE code = $1', [code]);
    if (rows.length === 0 || !rows[0].attempt_audio) return null;
    return rows[0].attempt_audio;
}

async function reportMatch(code, token, score, audioBuffer) {
    const game = await loadGame(code);
    if (!game) return { error: 'Game not found' };

    const role = getRole(game, token);
    if (!role) return { error: 'Not a player in this game' };
    if (role === game.currentSetter) return { error: 'Not your turn to match' };
    if (game.state !== 'matching') return { game, matched: game.state === 'matched' }; // already moved on

    const matched = score >= 0.8;
    const attempts = [...game.attempts, { score, matched, timestamp: new Date().toISOString() }];

    if (matched) {
        await pool.query(
            `UPDATE games SET attempts = $1, attempt_audio = $2, state = 'matched',
             creator_score = creator_score + 1, joiner_score = joiner_score + 1 WHERE code = $3`,
            [JSON.stringify(attempts), audioBuffer, code]
        );
    } else {
        await pool.query(
            'UPDATE games SET attempts = $1, attempt_audio = $2 WHERE code = $3',
            [JSON.stringify(attempts), audioBuffer, code]
        );
    }

    const updated = await loadGame(code);
    return { game: updated, matched };
}

async function nextRound(code, token) {
    const game = await loadGame(code);
    if (!game) return { error: 'Game not found' };

    const role = getRole(game, token);
    if (!role) return { error: 'Not a player in this game' };
    if (game.state !== 'matched') return { game }; // already moved on

    const newSetter = game.currentSetter === 'creator' ? 'joiner' : 'creator';

    await pool.query(
        `UPDATE games SET current_setter = $1, round = round + 1, state = 'setting',
         target_location = NULL, target_audio = NULL, attempt_audio = NULL, attempts = '[]'::jsonb
         WHERE code = $2`,
        [newSetter, code]
    );

    const updated = await loadGame(code);
    return { game: updated };
}

module.exports = {
    loadGame, createGame, joinGame, getRole,
    getTargetAudio, getAttemptAudio,
    uploadTarget, reportMatch, nextRound,
};
