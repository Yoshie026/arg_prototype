/**
 * REST API client for Noise Tennis.
 * Stores per-game tokens in localStorage for async rejoining.
 */
class Api {
    constructor() {
        this.token = null;
        this.gameCode = null;
        this.storageKey = 'sound-tennis';
        this.legacyStorageKey = 'audio-tennis';
    }

    getStoredGames() {
        const nextRaw = localStorage.getItem(this.storageKey);
        if (nextRaw !== null) {
            try {
                const parsed = JSON.parse(nextRaw);
                return parsed && typeof parsed === 'object' ? parsed : {};
            } catch {
                return {};
            }
        }

        const legacyRaw = localStorage.getItem(this.legacyStorageKey);
        if (!legacyRaw) return {};
        try {
            const legacy = JSON.parse(legacyRaw);
            if (legacy && typeof legacy === 'object') {
                localStorage.setItem(this.storageKey, JSON.stringify(legacy));
                localStorage.removeItem(this.legacyStorageKey);
                return legacy;
            }
        } catch {}
        return {};
    }

    setStoredGames(games) {
        localStorage.setItem(this.storageKey, JSON.stringify(games));
        // Keep one canonical key to prevent legacy data from reappearing.
        localStorage.removeItem(this.legacyStorageKey);
    }

    setCredentials(code, token) {
        this.gameCode = code;
        this.token = token;
        const games = this.getStoredGames();
        const existing = games[code];
        // Preserve any saved metadata
        if (existing && typeof existing === 'object') {
            existing.token = token;
        } else {
            games[code] = { token };
        }
        this.setStoredGames(games);
    }

    loadCredentials(code) {
        const games = this.getStoredGames();
        const entry = games[code];
        if (!entry) return false;
        this.gameCode = code;
        this.token = typeof entry === 'string' ? entry : entry.token;
        return true;
    }

    removeCredentials(code) {
        const games = this.getStoredGames();
        delete games[code];
        this.setStoredGames(games);
    }

    saveGameInfo(code, info) {
        const games = this.getStoredGames();
        const entry = games[code];
        if (!entry) return;
        const token = typeof entry === 'string' ? entry : entry.token;
        games[code] = { token, ...info };
        this.setStoredGames(games);
    }

    getGameInfo(code) {
        const games = this.getStoredGames();
        const entry = games[code];
        if (!entry) return null;
        if (typeof entry === 'string') return { token: entry };
        return entry;
    }

    getAllGameCodes() {
        return Object.keys(this.getStoredGames());
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
