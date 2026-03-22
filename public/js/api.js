/**
 * REST API client for Audio Tennis.
 * Stores per-game tokens in localStorage for async rejoining.
 */
class Api {
    constructor() {
        this.token = null;
        this.gameCode = null;
    }

    setCredentials(code, token) {
        this.gameCode = code;
        this.token = token;
        const games = JSON.parse(localStorage.getItem('audio-tennis') || '{}');
        games[code] = token;
        localStorage.setItem('audio-tennis', JSON.stringify(games));
    }

    loadCredentials(code) {
        const games = JSON.parse(localStorage.getItem('audio-tennis') || '{}');
        if (games[code]) {
            this.gameCode = code;
            this.token = games[code];
            return true;
        }
        return false;
    }

    authHeaders(extra = {}) {
        return { Authorization: `Bearer ${this.token}`, ...extra };
    }

    async createGame(playerName) {
        const res = await fetch('/api/games', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerName }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        this.setCredentials(data.code, data.token);
        return data;
    }

    async joinGame(code, playerName) {
        const res = await fetch(`/api/games/${code}/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerName }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        this.setCredentials(code, data.token);
        return data;
    }

    async getGame() {
        const res = await fetch(`/api/games/${this.gameCode}`, {
            headers: this.authHeaders(),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        return data;
    }

    async uploadTarget(arrayBuffer, location) {
        const headers = this.authHeaders({ 'Content-Type': 'application/octet-stream' });
        if (location) headers['X-Location'] = JSON.stringify(location);
        const res = await fetch(`/api/games/${this.gameCode}/target`, {
            method: 'POST',
            headers,
            body: arrayBuffer,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        return data;
    }

    async getTargetAudio() {
        const res = await fetch(`/api/games/${this.gameCode}/target-audio`, {
            headers: this.authHeaders(),
        });
        if (!res.ok) throw new Error('Failed to load target audio');
        return res.arrayBuffer();
    }

    async reportResult(score, audioArrayBuffer) {
        const res = await fetch(`/api/games/${this.gameCode}/result`, {
            method: 'POST',
            headers: this.authHeaders({
                'Content-Type': 'application/octet-stream',
                'X-Score': String(score),
            }),
            body: audioArrayBuffer,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        return data;
    }

    async getAttemptAudio() {
        const res = await fetch(`/api/games/${this.gameCode}/attempt-audio`, {
            headers: this.authHeaders(),
        });
        if (!res.ok) throw new Error('Failed to load attempt audio');
        return res.arrayBuffer();
    }

    async nextRound() {
        const res = await fetch(`/api/games/${this.gameCode}/next-round`, {
            method: 'POST',
            headers: this.authHeaders(),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        return data;
    }
}

export default Api;
