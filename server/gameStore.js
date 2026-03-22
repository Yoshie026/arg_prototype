const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const GAMES_DIR = path.join(DATA_DIR, 'games');
const AUDIO_DIR = path.join(DATA_DIR, 'audio');

fs.mkdirSync(GAMES_DIR, { recursive: true });
fs.mkdirSync(AUDIO_DIR, { recursive: true });

function generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
}

function gamePath(code) {
    return path.join(GAMES_DIR, `${code}.json`);
}

function audioPath(code, round, type) {
    return path.join(AUDIO_DIR, `${code}_r${round}_${type}.webm`);
}

function loadGame(code) {
    const p = gamePath(code);
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

function saveGame(game) {
    fs.writeFileSync(gamePath(game.code), JSON.stringify(game, null, 2));
}

function getRole(game, token) {
    if (game.players.creator && game.players.creator.token === token) return 'creator';
    if (game.players.joiner && game.players.joiner.token === token) return 'joiner';
    return null;
}

function createGame(playerName) {
    let code;
    do { code = generateCode(); } while (fs.existsSync(gamePath(code)));

    const token = crypto.randomUUID();
    const game = {
        code,
        state: 'waiting',
        round: 1,
        players: {
            creator: { name: playerName, token, score: 0 },
            joiner: null,
        },
        currentSetter: 'creator',
        targetLocation: null,
        attempts: [],
        createdAt: new Date().toISOString(),
    };
    saveGame(game);
    return { game, token };
}

function joinGame(code, playerName) {
    const game = loadGame(code);
    if (!game) return { error: 'Game not found' };
    if (game.players.joiner) return { error: 'Game is full' };

    const token = crypto.randomUUID();
    game.players.joiner = { name: playerName, token, score: 0 };
    game.state = 'setting';
    saveGame(game);
    return { game, token };
}

function uploadTarget(code, token, audioBuffer, location) {
    const game = loadGame(code);
    if (!game) return { error: 'Game not found' };

    const role = getRole(game, token);
    if (!role) return { error: 'Not a player in this game' };
    if (role !== game.currentSetter) return { error: 'Not your turn to set' };
    if (game.state !== 'setting') return { error: 'Not in setting phase' };

    const p = audioPath(code, game.round, 'target');
    fs.writeFileSync(p, Buffer.from(audioBuffer));

    game.targetLocation = location || null;
    game.state = 'matching';
    game.attempts = [];
    saveGame(game);
    return { game };
}

function getTargetAudioPath(code, round) {
    const p = audioPath(code, round, 'target');
    return fs.existsSync(p) ? p : null;
}

function getAttemptAudioPath(code, round) {
    const p = audioPath(code, round, 'attempt');
    return fs.existsSync(p) ? p : null;
}

function reportMatch(code, token, score, audioBuffer) {
    const game = loadGame(code);
    if (!game) return { error: 'Game not found' };

    const role = getRole(game, token);
    if (!role) return { error: 'Not a player in this game' };
    if (role === game.currentSetter) return { error: 'Not your turn to match' };
    if (game.state !== 'matching') return { error: 'Not in matching phase' };

    // Store attempt audio so the setter can listen
    if (audioBuffer && audioBuffer.length > 0) {
        const p = audioPath(code, game.round, 'attempt');
        fs.writeFileSync(p, Buffer.from(audioBuffer));
    }

    const matched = score >= 0.85;

    game.attempts.push({
        score,
        matched,
        timestamp: new Date().toISOString(),
    });

    if (matched) {
        game.players.creator.score++;
        game.players.joiner.score++;
        game.state = 'matched';
    }

    saveGame(game);
    return { game, matched };
}

function nextRound(code, token) {
    const game = loadGame(code);
    if (!game) return { error: 'Game not found' };

    const role = getRole(game, token);
    if (!role) return { error: 'Not a player in this game' };
    if (game.state !== 'matched') return { error: 'Round not complete' };

    game.currentSetter = game.currentSetter === 'creator' ? 'joiner' : 'creator';
    game.round++;
    game.state = 'setting';
    game.targetLocation = null;
    game.attempts = [];
    saveGame(game);
    return { game };
}

module.exports = {
    loadGame, createGame, joinGame, getRole,
    getTargetAudioPath, getAttemptAudioPath,
    uploadTarget, reportMatch, nextRound,
};
