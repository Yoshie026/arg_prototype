const express = require('express');
const store = require('./server/gameStore');

const app = express();
app.use(express.static('public'));

const json = express.json();
const raw = express.raw({ type: '*/*', limit: '5mb' });

// Helper — extract token from Authorization header
function getToken(req) {
    return (req.headers.authorization || '').replace('Bearer ', '');
}

// Helper — strip tokens from game before sending to client
function sanitize(game, token) {
    const role = store.getRole(game, token);
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

// Create game
app.post('/api/games', json, (req, res) => {
    const { playerName } = req.body || {};
    if (!playerName) return res.status(400).json({ error: 'Name required' });
    const { game, token } = store.createGame(playerName);
    res.json({ code: game.code, token, game: sanitize(game, token) });
});

// Join game
app.post('/api/games/:code/join', json, (req, res) => {
    const { playerName } = req.body || {};
    if (!playerName) return res.status(400).json({ error: 'Name required' });
    const result = store.joinGame(req.params.code.toUpperCase(), playerName);
    if (result.error) return res.status(400).json({ error: result.error });
    const { game, token } = result;
    res.json({ token, game: sanitize(game, token) });
});

// Get game state
app.get('/api/games/:code', (req, res) => {
    const token = getToken(req);
    const game = store.loadGame(req.params.code.toUpperCase());
    if (!game) return res.status(404).json({ error: 'Game not found' });
    const role = store.getRole(game, token);
    if (!role) return res.status(403).json({ error: 'Not a player in this game' });
    res.json({ game: sanitize(game, token), role });
});

// Upload target audio (setter confirms)
app.post('/api/games/:code/target', raw, (req, res) => {
    const token = getToken(req);
    const location = req.headers['x-location'] ? JSON.parse(req.headers['x-location']) : null;
    const result = store.uploadTarget(req.params.code.toUpperCase(), token, req.body, location);
    if (result.error) return res.status(400).json({ error: result.error });
    res.json({ game: sanitize(result.game, token) });
});

// Download target audio
app.get('/api/games/:code/target-audio', (req, res) => {
    const token = getToken(req);
    const code = req.params.code.toUpperCase();
    const game = store.loadGame(code);
    if (!game) return res.status(404).json({ error: 'Game not found' });
    if (!store.getRole(game, token)) return res.status(403).json({ error: 'Not a player' });
    const audioPath = store.getTargetAudioPath(code, game.round);
    if (!audioPath) return res.status(404).json({ error: 'No target audio' });
    res.sendFile(audioPath);
});

// Report match result (audio blob in body, score in header)
app.post('/api/games/:code/result', raw, (req, res) => {
    const token = getToken(req);
    const score = parseFloat(req.headers['x-score']);
    if (isNaN(score)) return res.status(400).json({ error: 'Score required (X-Score header)' });
    const result = store.reportMatch(req.params.code.toUpperCase(), token, score, req.body);
    if (result.error) return res.status(400).json({ error: result.error });
    res.json({ game: sanitize(result.game, token), matched: result.matched });
});

// Download attempt audio (matcher's latest recording)
app.get('/api/games/:code/attempt-audio', (req, res) => {
    const token = getToken(req);
    const code = req.params.code.toUpperCase();
    const game = store.loadGame(code);
    if (!game) return res.status(404).json({ error: 'Game not found' });
    if (!store.getRole(game, token)) return res.status(403).json({ error: 'Not a player' });
    const audioPath = store.getAttemptAudioPath(code, game.round);
    if (!audioPath) return res.status(404).json({ error: 'No attempt audio' });
    res.sendFile(audioPath);
});

// Next round
app.post('/api/games/:code/next-round', (req, res) => {
    const token = getToken(req);
    const result = store.nextRound(req.params.code.toUpperCase(), token);
    if (result.error) return res.status(400).json({ error: result.error });
    res.json({ game: sanitize(result.game, token) });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Audio Tennis running on http://localhost:${PORT}`);
});
