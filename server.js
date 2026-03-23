require('dotenv').config();
const express = require('express');
const store = require('./server/gameStore');

const app = express();
app.use(express.static('public'));

const json = express.json();
const raw = express.raw({ type: '*/*', limit: '5mb' });

function getToken(req) {
    return (req.headers.authorization || '').replace('Bearer ', '');
}

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
app.post('/api/games', json, async (req, res) => {
    try {
        const { playerName } = req.body || {};
        if (!playerName) return res.status(400).json({ error: 'Name required' });
        const { game, token } = await store.createGame(playerName);
        res.json({ code: game.code, token, game: sanitize(game, token) });
    } catch (err) {
        console.error('create-game error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Join game
app.post('/api/games/:code/join', json, async (req, res) => {
    try {
        const { playerName } = req.body || {};
        if (!playerName) return res.status(400).json({ error: 'Name required' });
        const result = await store.joinGame(req.params.code.toUpperCase(), playerName);
        if (result.error) return res.status(400).json({ error: result.error });
        const { game, token } = result;
        res.json({ token, game: sanitize(game, token) });
    } catch (err) {
        console.error('join-game error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get game state
app.get('/api/games/:code', async (req, res) => {
    try {
        const token = getToken(req);
        const game = await store.loadGame(req.params.code.toUpperCase());
        if (!game) return res.status(404).json({ error: 'Game not found' });
        const role = store.getRole(game, token);
        if (!role) return res.status(403).json({ error: 'Not a player in this game' });
        res.json({ game: sanitize(game, token), role });
    } catch (err) {
        console.error('get-game error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Upload target audio (setter confirms)
app.post('/api/games/:code/target', raw, async (req, res) => {
    try {
        const token = getToken(req);
        const location = req.headers['x-location'] ? JSON.parse(req.headers['x-location']) : null;
        const result = await store.uploadTarget(req.params.code.toUpperCase(), token, req.body, location);
        if (result.error) return res.status(400).json({ error: result.error });
        res.json({ game: sanitize(result.game, token) });
    } catch (err) {
        console.error('upload-target error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Download target audio
app.get('/api/games/:code/target-audio', async (req, res) => {
    try {
        const token = getToken(req);
        const code = req.params.code.toUpperCase();
        const game = await store.loadGame(code);
        if (!game) return res.status(404).json({ error: 'Game not found' });
        if (!store.getRole(game, token)) return res.status(403).json({ error: 'Not a player' });
        const audio = await store.getTargetAudio(code);
        if (!audio) return res.status(404).json({ error: 'No target audio' });
        res.set('Content-Type', 'audio/webm');
        res.send(audio);
    } catch (err) {
        console.error('target-audio error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Report match result (audio blob in body, score in header)
app.post('/api/games/:code/result', raw, async (req, res) => {
    try {
        const token = getToken(req);
        const score = parseFloat(req.headers['x-score']);
        if (isNaN(score)) return res.status(400).json({ error: 'Score required (X-Score header)' });
        const result = await store.reportMatch(req.params.code.toUpperCase(), token, score, req.body);
        if (result.error) return res.status(400).json({ error: result.error });
        res.json({ game: sanitize(result.game, token), matched: result.matched });
    } catch (err) {
        console.error('report-result error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Download attempt audio
app.get('/api/games/:code/attempt-audio', async (req, res) => {
    try {
        const token = getToken(req);
        const code = req.params.code.toUpperCase();
        const game = await store.loadGame(code);
        if (!game) return res.status(404).json({ error: 'Game not found' });
        if (!store.getRole(game, token)) return res.status(403).json({ error: 'Not a player' });
        const audio = await store.getAttemptAudio(code);
        if (!audio) return res.status(404).json({ error: 'No attempt audio' });
        res.set('Content-Type', 'audio/webm');
        res.send(audio);
    } catch (err) {
        console.error('attempt-audio error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Next round
app.post('/api/games/:code/next-round', async (req, res) => {
    try {
        const token = getToken(req);
        const result = await store.nextRound(req.params.code.toUpperCase(), token);
        if (result.error) return res.status(400).json({ error: result.error });
        res.json({ game: sanitize(result.game, token) });
    } catch (err) {
        console.error('next-round error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Sound Tennis running on http://localhost:${PORT}`);
});
