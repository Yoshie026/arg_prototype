import pg from 'pg';
import crypto from 'crypto';

// ── Database ────────────────────────────────────────────────────────

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ── Game store (ported from server/gameStore.js) ────────────────────

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
  if (game.state !== 'setting') return { game };
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
  if (game.state !== 'matching') return { game, matched: game.state === 'matched' };
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
  if (game.state !== 'matched') return { game };
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

// ── Helpers ─────────────────────────────────────────────────────────

function getToken(req) {
  return (req.headers.get('authorization') || '').replace('Bearer ', '');
}

function sanitize(game, token) {
  const role = getRole(game, token);
  return {
    code: game.code,
    state: game.state,
    round: game.round,
    currentSetter: game.currentSetter,
    targetLocation: game.targetLocation,
    attempts: game.attempts,
    players: {
      creator: game.players.creator
        ? { name: game.players.creator.name, score: game.players.creator.score }
        : null,
      joiner: game.players.joiner
        ? { name: game.players.joiner.name, score: game.players.joiner.score }
        : null,
    },
    myRole: role,
    isSetter: role === game.currentSetter,
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function audio(buffer) {
  return new Response(buffer, {
    headers: { 'Content-Type': 'audio/webm' },
  });
}

// ── Router ──────────────────────────────────────────────────────────

export default async (req) => {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  try {
    // POST /api/games
    if (method === 'POST' && path === '/api/games') {
      const { playerName } = await req.json();
      if (!playerName) return json({ error: 'Name required' }, 400);
      const { game, token } = await createGame(playerName);
      return json({ code: game.code, token, game: sanitize(game, token) });
    }

    // POST /api/games/:code/join
    const joinMatch = path.match(/^\/api\/games\/([^/]+)\/join$/);
    if (method === 'POST' && joinMatch) {
      const { playerName } = await req.json();
      if (!playerName) return json({ error: 'Name required' }, 400);
      const result = await joinGame(joinMatch[1].toUpperCase(), playerName);
      if (result.error) return json({ error: result.error }, 400);
      const { game, token } = result;
      return json({ token, game: sanitize(game, token) });
    }

    // POST /api/games/:code/target
    const targetMatch = path.match(/^\/api\/games\/([^/]+)\/target$/);
    if (method === 'POST' && targetMatch) {
      const token = getToken(req);
      const location = req.headers.get('x-location')
        ? JSON.parse(req.headers.get('x-location'))
        : null;
      const audioBuffer = Buffer.from(await req.arrayBuffer());
      const result = await uploadTarget(targetMatch[1].toUpperCase(), token, audioBuffer, location);
      if (result.error) return json({ error: result.error }, 400);
      return json({ game: sanitize(result.game, token) });
    }

    // GET /api/games/:code/target-audio
    const targetAudioMatch = path.match(/^\/api\/games\/([^/]+)\/target-audio$/);
    if (method === 'GET' && targetAudioMatch) {
      const token = getToken(req);
      const code = targetAudioMatch[1].toUpperCase();
      const game = await loadGame(code);
      if (!game) return json({ error: 'Game not found' }, 404);
      if (!getRole(game, token)) return json({ error: 'Not a player' }, 403);
      const audioData = await getTargetAudio(code);
      if (!audioData) return json({ error: 'No target audio' }, 404);
      return audio(audioData);
    }

    // POST /api/games/:code/result
    const resultMatch = path.match(/^\/api\/games\/([^/]+)\/result$/);
    if (method === 'POST' && resultMatch) {
      const token = getToken(req);
      const score = parseFloat(req.headers.get('x-score'));
      if (isNaN(score)) return json({ error: 'Score required (X-Score header)' }, 400);
      const audioBuffer = Buffer.from(await req.arrayBuffer());
      const result = await reportMatch(resultMatch[1].toUpperCase(), token, score, audioBuffer);
      if (result.error) return json({ error: result.error }, 400);
      return json({ game: sanitize(result.game, token), matched: result.matched });
    }

    // GET /api/games/:code/attempt-audio
    const attemptAudioMatch = path.match(/^\/api\/games\/([^/]+)\/attempt-audio$/);
    if (method === 'GET' && attemptAudioMatch) {
      const token = getToken(req);
      const code = attemptAudioMatch[1].toUpperCase();
      const game = await loadGame(code);
      if (!game) return json({ error: 'Game not found' }, 404);
      if (!getRole(game, token)) return json({ error: 'Not a player' }, 403);
      const audioData = await getAttemptAudio(code);
      if (!audioData) return json({ error: 'No attempt audio' }, 404);
      return audio(audioData);
    }

    // POST /api/games/:code/next-round
    const nextRoundMatch = path.match(/^\/api\/games\/([^/]+)\/next-round$/);
    if (method === 'POST' && nextRoundMatch) {
      const token = getToken(req);
      const result = await nextRound(nextRoundMatch[1].toUpperCase(), token);
      if (result.error) return json({ error: result.error }, 400);
      return json({ game: sanitize(result.game, token) });
    }

    // GET /api/games/:code
    const getGameMatch = path.match(/^\/api\/games\/([^/]+)$/);
    if (method === 'GET' && getGameMatch) {
      const token = getToken(req);
      const game = await loadGame(getGameMatch[1].toUpperCase());
      if (!game) return json({ error: 'Game not found' }, 404);
      const role = getRole(game, token);
      if (!role) return json({ error: 'Not a player in this game' }, 403);
      return json({ game: sanitize(game, token), role });
    }

    return json({ error: 'Not found' }, 404);
  } catch (err) {
    console.error('API error:', err);
    return json({ error: 'Server error' }, 500);
  }
};

export const config = {
  path: '/api/*',
};
