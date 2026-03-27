import Api from './api.js';

const PLAYER_NAME_KEY = 'sound-tennis-name';
const LEGACY_PLAYER_NAME_KEY = 'audio-tennis-name';

class AudioTennis {
    constructor() {
        this.audio = new AudioEngine();
        this.viz = null;
        this.api = new Api();

        this.game = null;
        this.isSetter = false;
        this.targetEmbedding = null;
        this.liveAnimFrame = null;
        this.map = null;
        this.mapMarker = null;
        this.clapReady = false;
        this._bound = false;
        this._poll = null;
        this._needsPoll = false;

        this.bindLobby();
        this.preloadClap();
        this.renderMyGames();
        this.refreshGameList();

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                // Pause without clearing _needsPoll
                if (this._poll) { clearInterval(this._poll); this._poll = null; }
            } else if (this._needsPoll) {
                this._poll = setInterval(() => this.poll(), 4000);
                this.poll(); // check immediately on return
            }
        });
    }

    // ── Lobby ────────────────────────────────────────────────

    bindLobby() {
        document.getElementById('create-btn').onclick = () => this.create();
        document.getElementById('join-btn').onclick = () => this.join();
        document.getElementById('join-code').onkeydown = (e) => { if (e.key === 'Enter') this.join(); };
    }

    async preloadClap() {
        const el = document.getElementById('clap-status');
        try {
            await window.clapEngine.load((p) => {
                if (p.status === 'progress' && p.total)
                    el.textContent = `Loading sound model... ${Math.round(p.loaded / p.total * 100)}%`;
            });
            this.clapReady = true;
            // Hide visually but keep layout space to avoid page jump.
            el.textContent = '';
            el.classList.add('done');
        } catch (err) {
            el.textContent = 'Model error: ' + err.message;
        }
    }

    err(msg) { document.getElementById('lobby-error').textContent = msg; }

    async create() {
        const name = document.getElementById('player-name').value.trim();
        if (!name) return this.err('Enter your name');
        try {
            const data = await this.api.createGame(name);
            this.game = data.game;
            this.saveName(name);
            this.enter();
        } catch (e) { this.err(e.message); }
    }

    async join() {
        const name = document.getElementById('player-name').value.trim();
        const code = document.getElementById('join-code').value.trim().toUpperCase();
        if (!code || code.length !== 4) return this.err('Enter a 4-character code');
        this.err('');

        // Try fresh join first
        if (name) {
            try {
                this.game = (await this.api.joinGame(code, name)).game;
                this.saveName(name);
                return this.enter();
            } catch (e) {
                // "Game is full" → we might already be a player, try rejoin below
                if (!e.message.includes('full')) return this.err(e.message);
            }
        }

        // Fall back to rejoin with saved token
        if (this.api.loadCredentials(code)) {
            try {
                this.game = (await this.api.getGame()).game;
                return this.enter();
            } catch {
                this.api.removeCredentials(code);
            }
        }

        if (!name) return this.err('Enter your name to join');
        this.err('Could not join game ' + code);
    }

    async openGame(code) {
        if (!this.api.loadCredentials(code)) return;
        try {
            this.game = (await this.api.getGame()).game;
            this.enter();
        } catch {
            // Token expired — remove from list
            this.api.removeCredentials(code);
            this.renderMyGames();
        }
    }

    saveName(name) {
        localStorage.setItem(PLAYER_NAME_KEY, name);
        localStorage.setItem(LEGACY_PLAYER_NAME_KEY, name);
    }

    // ── My games list ────────────────────────────────────────

    updateGameMeta() {
        const g = this.game;
        if (!g) return;
        const opRole = g.myRole === 'creator' ? 'joiner' : 'creator';
        const opponent = g.players[opRole]?.name || null;

        let status;
        switch (g.state) {
            case 'waiting': status = 'Waiting for opponent'; break;
            case 'setting': status = g.isSetter ? 'Your turn to record' : 'Waiting for their sound'; break;
            case 'matching': status = g.isSetter ? 'Waiting for their match' : 'Your turn to match'; break;
            case 'matched': status = 'Matched!'; break;
            default: status = '';
        }

        this.api.saveGameInfo(g.code, { opponent, status, round: g.round });
    }

    renderMyGames() {
        const container = document.getElementById('my-games');
        const codes = this.api.getAllGameCodes();

        if (codes.length === 0) { container.innerHTML = ''; return; }

        container.innerHTML = '<p class="my-games-title">My games</p>' +
            '<div class="my-games-scroll">' +
            codes.map(code => {
                const info = this.api.getGameInfo(code) || {};
                const name = info.opponent
                    ? `vs ${info.opponent}`
                    : 'Waiting for opponent';
                const detail = [
                    info.round ? `Round ${info.round}` : null,
                    info.status || null,
                ].filter(Boolean).join(' \u00b7 ') || 'Tap to rejoin';

                return `<div class="game-row" data-code="${code}">` +
                    `<div class="game-row-left">` +
                        `<span class="game-row-name">${name}</span>` +
                        `<span class="game-row-detail">${detail}</span>` +
                    `</div>` +
                    `<span class="game-row-code">${code}</span>` +
                    `<button class="game-row-delete" data-delete="${code}">\u00d7</button>` +
                `</div>`;
            }).join('') + '</div>';

        container.querySelectorAll('.game-row').forEach(row => {
            row.onclick = (e) => {
                if (e.target.closest('.game-row-delete')) return;
                this.openGame(row.dataset.code);
            };
        });

        container.querySelectorAll('.game-row-delete').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                this.deleteGame(btn.dataset.delete);
            };
        });

        // Pre-fill saved name
        const savedName = localStorage.getItem(PLAYER_NAME_KEY) || localStorage.getItem(LEGACY_PLAYER_NAME_KEY);
        if (savedName) document.getElementById('player-name').value = savedName;
    }

    deleteGame(code) {
        this.api.removeCredentials(code);
        this.renderMyGames();
    }

    async refreshGameList() {
        const codes = this.api.getAllGameCodes();
        if (codes.length === 0) return;

        const savedCode = this.api.gameCode;
        const savedToken = this.api.token;
        let changed = false;

        await Promise.allSettled(codes.map(async code => {
            const info = this.api.getGameInfo(code);
            if (!info || !info.token) return;
            try {
                const { game } = await fetch(`/api/games/${code}`, {
                    headers: { Authorization: `Bearer ${info.token}` },
                }).then(r => {
                    if (!r.ok) throw new Error();
                    return r.json();
                });

                const opRole = game.myRole === 'creator' ? 'joiner' : 'creator';
                const opponent = game.players[opRole]?.name || null;
                let status;
                switch (game.state) {
                    case 'waiting': status = 'Waiting for opponent'; break;
                    case 'setting': status = game.isSetter ? 'Your turn to record' : 'Waiting for their sound'; break;
                    case 'matching': status = game.isSetter ? 'Waiting for their match' : 'Your turn to match'; break;
                    case 'matched': status = 'Matched!'; break;
                    default: status = '';
                }
                this.api.saveGameInfo(code, { opponent, status, round: game.round });
                changed = true;
            } catch {
                this.api.removeCredentials(code);
                changed = true;
            }
        }));

        // Restore original credentials
        this.api.gameCode = savedCode;
        this.api.token = savedToken;

        if (changed) this.renderMyGames();
    }

    // ── Game screen ──────────────────────────────────────────

    async enter() {
        document.getElementById('screen-lobby').classList.add('hidden');
        document.getElementById('screen-game').classList.remove('hidden');
        await this.audio.init();
        if (!this.viz) this.viz = new Visualizer();
        if (!this._bound) {
            this._bound = true;
            document.getElementById('record-btn').onclick = () => this.onRecord();
            document.getElementById('play-target').onclick = () => this.playTarget();
            document.getElementById('play-recorded').onclick = () => this.playRec();
            document.getElementById('confirm-btn').onclick = () => this.onConfirm();
            document.getElementById('next-btn').onclick = () => this.onNextRound();
            document.getElementById('copy-code').onclick = () => this.copyCode();
            document.getElementById('back-btn').onclick = () => this.backToLobby();
        }
        this.render();
    }

    backToLobby() {
        this.stopPolling();
        if (this.audio.isRecording) this.audio.stopRecording();
        cancelAnimationFrame(this.liveAnimFrame);
        this.game = null;
        this.audio.targetBuffer = null;
        this.audio.recordedBuffer = null;
        this.targetEmbedding = null;
        document.getElementById('screen-game').classList.add('hidden');
        document.getElementById('screen-lobby').classList.remove('hidden');
        this.renderMyGames();
        this.refreshGameList();
    }

    // ── Polling ──────────────────────────────────────────────

    startPolling() {
        this.stopPolling();
        this._needsPoll = true;
        this._poll = setInterval(() => this.poll(), 4000);
    }

    stopPolling() {
        this._needsPoll = false;
        if (this._poll) { clearInterval(this._poll); this._poll = null; }
    }

    async poll() {
        try {
            const prev = this.game?.state;
            this.game = (await this.api.getGame()).game;
            if (this.game.state !== prev) this.render();
        } catch {}
    }

    // ── Render ───────────────────────────────────────────────

    render() {
        const g = this.game;
        if (!g || this.audio.isRecording) return;

        // Clear stale audio when the round advances (e.g. other player clicked "Next Round")
        if (g.round !== this._currentRound) {
            this.audio.targetBuffer = null;
            this.audio.recordedBuffer = null;
            this.targetEmbedding = null;
            if (this.viz) this.viz.clear();
            this._currentRound = g.round;
        }

        this.isSetter = g.isSetter;
        this.updateGameMeta();

        const matcherKey = g.currentSetter === 'creator' ? 'joiner' : 'creator';
        const opponent = (this.isSetter ? g.players[matcherKey]?.name : g.players[g.currentSetter]?.name) || 'opponent';
        document.getElementById('game-meta').textContent = `Round ${g.round}`;

        this.hideAll();

        const waiting = g.state === 'waiting'
            || (g.state === 'setting' && !this.isSetter)
            || (g.state === 'matching' && this.isSetter)
            || g.state === 'matched';

        if (waiting) this.startPolling(); else this.stopPolling();

        switch (g.state) {
            case 'waiting':
                this.showCode(g.code);
                this.msg('Send this code to a friend and tell them to join');
                document.getElementById('status-msg').classList.add('status-centered');
                break;

            case 'setting':
                if (this.isSetter) {
                    this.msg(`Record a sound for ${opponent}`);
                    this.show('record-btn');
                    this.showViz('target');
                } else {
                    this.msg(`Waiting for ${opponent} to pick a sound\u2026`);
                }
                break;

            case 'matching':
                if (!this.isSetter) {
                    const last = g.attempts.at(-1);
                    if (last && !last.matched) {
                        this.msg('Listen again and try to get closer');
                        this.showScore(last.score);
                    } else {
                        this.msg(`${opponent} sent you a sound`);
                    }
                    this.show('play-target', 'record-btn');
                    // Disable Record until target audio + embedding is ready
                    const recBtn = document.getElementById('record-btn');
                    if (!this.targetEmbedding) {
                        recBtn.disabled = true;
                        recBtn.textContent = 'Loading\u2026';
                        this.loadTargetAudio().then(() => {
                            recBtn.disabled = false;
                            recBtn.textContent = 'Record';
                        });
                    }
                    this.showViz('target');
                } else {
                    if (g.attempts.length > 0) {
                        const best = g.attempts.reduce((max, a) => Math.max(max, a.score || 0), 0);
                        this.msg(`Waiting for ${opponent} to match your sound\u2026 Best so far: ${Math.round(best * 100)}%`);
                        this.show('play-target', 'play-recorded');
                        this.showViz('target');
                        this.loadTargetAudio();
                        this.loadAttemptAudio();
                    } else {
                        this.msg(`Waiting for ${opponent} to match your sound\u2026`);
                    }
                }
                if (g.targetLocation) this.showMap(g.targetLocation);
                break;

            case 'matched': {
                const score = g.attempts.at(-1)?.score || 0;
                this.msg('Matched! Ready for the next round?');
                this.showScore(score);
                this.show('play-target', 'play-recorded', 'next-btn');
                this.showViz('target');
                this.loadTargetAudio();
                this.loadAttemptAudio();
                break;
            }
        }
    }

    // ── UI helpers ────────────────────────────────────────────

    msg(text) { document.getElementById('status-msg').textContent = text; }

    hideAll() {
        ['record-btn', 'play-target', 'play-recorded', 'confirm-btn', 'next-btn']
            .forEach(id => document.getElementById(id).classList.add('hidden'));
        const rec = document.getElementById('record-btn');
        rec.classList.remove('recording', 'analyzing');
        rec.textContent = 'Record';
        rec.disabled = false;
        document.getElementById('play-recorded').textContent = 'Play attempt';
        document.getElementById('status-msg').classList.remove('status-centered');
        document.getElementById('score-area').classList.add('hidden');
        document.getElementById('target-viz').classList.add('hidden');
        document.getElementById('recorded-viz').classList.add('hidden');
        document.getElementById('game-code-area').classList.add('hidden');
        this.hideMap();
    }

    show(...ids) { ids.forEach(id => document.getElementById(id).classList.remove('hidden')); }

    showViz(which) {
        if (which === 'target') document.getElementById('target-viz').classList.remove('hidden');
        if (which === 'recorded') document.getElementById('recorded-viz').classList.remove('hidden');
    }

    showScore(score) {
        const pct = Math.round(score * 100);
        const el = document.getElementById('score-value');
        el.textContent = pct + '%';
        el.className = score >= 0.8 ? 'good' : score >= 0.6 ? 'close' : 'low';
        document.getElementById('score-label').textContent =
            score >= 0.8 ? 'Match!' : score >= 0.6 ? 'Getting close' : 'Keep trying';
        document.getElementById('score-area').classList.remove('hidden');
    }

    showCode(code) {
        document.getElementById('game-code-big').textContent = code;
        document.getElementById('game-code-area').classList.remove('hidden');
    }

    async copyCode() {
        const code = this.game.code;
        if (navigator.clipboard) {
            await navigator.clipboard.writeText(code);
            const btn = document.getElementById('copy-code');
            btn.textContent = 'Copied!';
            setTimeout(() => btn.textContent = 'Copy', 1500);
        }
    }

    // ── Audio loading ────────────────────────────────────────

    async loadTargetAudio() {
        if (this.audio.targetBuffer) return;
        try {
            const buf = await this.audio.decodeBlob(await this.api.getTargetAudio());
            this.audio.targetBuffer = buf;
            if (this.viz) {
                const f = this.audio.extractFeatures(buf);
                this.viz.drawFingerprint(this.viz.targetCtx, this.viz.targetCanvas, f, 'TARGET');
            }
            const clean = this.audio.getCleanEventSamples(buf);
            this.targetEmbedding = await window.clapEngine.embed(clean, buf.sampleRate);
            if (this.game.targetLocation) this.showMap(this.game.targetLocation);
        } catch (e) { console.error('Target load error:', e); }
    }

    async loadAttemptAudio() {
        if (this.audio.recordedBuffer) return;
        try {
            const buf = await this.audio.decodeBlob(await this.api.getAttemptAudio());
            this.audio.recordedBuffer = buf;
            if (this.viz) {
                const f = this.audio.extractFeatures(buf);
                this.viz.drawFingerprint(this.viz.recordedCtx, this.viz.recordedCanvas, f, 'ATTEMPT');
            }
        } catch (e) { console.error('Attempt load error:', e); }
    }

    // ── Recording ────────────────────────────────────────────

    async onRecord() {
        if (this.audio.isRecording) return this.stopRecording();
        if (!this.isSetter) this.showViz('recorded');
        const btn = document.getElementById('record-btn');
        btn.classList.add('recording');
        btn.textContent = 'Stop';
        try {
            this.audio.onAutoStop = () => this.stopRecording();
            await this.audio.startRecording();
        } catch {
            btn.classList.remove('recording');
            btn.textContent = 'Record';
            return alert('Microphone access needed');
        }
        const setter = this.isSetter;
        const tick = () => {
            if (!this.audio.isRecording) return;
            const data = this.audio.getLiveFrequencyData();
            if (setter) this.viz.drawLiveWaveform(data, this.viz.targetCtx, this.viz.targetCanvas);
            else this.viz.drawLiveWaveform(data);
            this.liveAnimFrame = requestAnimationFrame(tick);
        };
        tick();
    }

    async stopRecording() {
        cancelAnimationFrame(this.liveAnimFrame);
        const btn = document.getElementById('record-btn');
        btn.classList.remove('recording');
        btn.classList.add('analyzing');
        btn.textContent = 'Analyzing\u2026';
        btn.disabled = true;

        try {
            const buffer = await this.audio.stopRecording();
            if (!buffer) return;

            if (this.isSetter) {
                this.audio.targetBuffer = buffer;
                const f = this.audio.extractFeatures(buffer);
                this.showViz('target');
                this.viz.drawFingerprint(this.viz.targetCtx, this.viz.targetCanvas, f, 'YOUR SOUND');
                btn.classList.remove('analyzing');
                btn.textContent = 'Re-record';
                btn.disabled = false;
                this.show('record-btn', 'play-recorded', 'confirm-btn');
                document.getElementById('play-recorded').textContent = 'Play back';
                this.msg('Sound good?');
            } else {
                const f = this.audio.extractFeatures(buffer);
                this.showViz('recorded');
                this.viz.drawFingerprint(this.viz.recordedCtx, this.viz.recordedCanvas, f, 'YOUR ATTEMPT');

                const clean = this.audio.getCleanEventSamples(buffer);
                const emb = await window.clapEngine.embed(clean, buffer.sampleRate);
                const score = window.clapEngine.similarity(this.targetEmbedding, emb);
                this.showScore(score);

                const ab = await this.audio.getRecordingArrayBuffer();
                const result = await this.api.reportResult(score, ab);
                this.game = result.game;

                if (result.matched) {
                    this.render();
                } else {
                    this.msg('Listen again and try to get closer');
                    btn.classList.remove('analyzing');
                    btn.textContent = 'Try again';
                    btn.disabled = false;
                    this.show('record-btn', 'play-target');
                }
            }
        } catch (e) {
            console.error('Recording error:', e);
            btn.classList.remove('analyzing');
            btn.textContent = 'Record';
            btn.disabled = false;
        }
    }

    async onConfirm() {
        const btn = document.getElementById('confirm-btn');
        btn.disabled = true;
        btn.textContent = 'Sending\u2026';
        try {
            const ab = await this.audio.getRecordingArrayBuffer();
            const loc = await this.captureLocation();
            this.game = (await this.api.uploadTarget(ab, loc)).game;
            this.render();
        } catch (e) {
            console.error('Upload error:', e);
            btn.disabled = false;
            btn.textContent = 'Send';
        }
    }

    async onNextRound() {
        try {
            this.game = (await this.api.nextRound()).game;
            this.audio.targetBuffer = null;
            this.audio.recordedBuffer = null;
            this.targetEmbedding = null;
            if (this.viz) this.viz.clear();
            this.hideMap();
            this.render();
        } catch (e) { console.error(e); }
    }

    // ── Playback ─────────────────────────────────────────────

    async playTarget() {
        if (!this.audio.targetBuffer) return;
        const btn = document.getElementById('play-target');
        btn.disabled = true; btn.textContent = 'Playing\u2026';
        try { await this.audio.playTarget(); } catch {}
        btn.disabled = false; btn.textContent = 'Play target';
    }

    async playRec() {
        const buf = (this.isSetter && this.game?.state === 'setting')
            ? this.audio.targetBuffer : this.audio.recordedBuffer;
        if (!buf) return;
        const btn = document.getElementById('play-recorded');
        const label = btn.textContent;
        btn.disabled = true; btn.textContent = 'Playing\u2026';
        try { await this.audio.playBuffer(buf); } catch {}
        btn.disabled = false; btn.textContent = label;
    }

    // ── Location ─────────────────────────────────────────────

    captureLocation() {
        return new Promise(r => {
            if (!navigator.geolocation) return r(null);
            navigator.geolocation.getCurrentPosition(
                pos => r({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                () => r(null), { enableHighAccuracy: true, timeout: 10000 }
            );
        });
    }

    showMap(loc) {
        if (!loc) return;
        document.getElementById('location-section').classList.remove('hidden');
        document.getElementById('location-label').textContent = 'Recorded here';
        if (!this.map) {
            this.map = L.map('map', { zoomControl: false, attributionControl: false }).setView([loc.lat, loc.lng], 15);
            L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(this.map);
        } else this.map.setView([loc.lat, loc.lng], 15);
        if (this.mapMarker) this.mapMarker.setLatLng([loc.lat, loc.lng]);
        else this.mapMarker = L.circleMarker([loc.lat, loc.lng], { radius: 8, color: '#111', fillColor: '#111', fillOpacity: 0.3, weight: 2 }).addTo(this.map);
        setTimeout(() => this.map.invalidateSize(), 100);
    }

    hideMap() { document.getElementById('location-section').classList.add('hidden'); }
}

new AudioTennis();
