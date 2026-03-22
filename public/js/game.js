import Api from './api.js';

const MATCH_THRESHOLD = 0.85;

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
        this._gameEventsBound = false;

        this.bindLobbyEvents();
        this.preloadClap();
        this.checkUrlHash();
    }

    // ================================================================
    //  LOBBY
    // ================================================================

    checkUrlHash() {
        const hash = location.hash.slice(1).toUpperCase();
        if (hash && hash.length === 4) {
            document.getElementById('join-code').value = hash;
        }
    }

    bindLobbyEvents() {
        document.getElementById('create-btn').addEventListener('click', () => this.createGame());
        document.getElementById('join-btn').addEventListener('click', () => this.joinGame());
        document.getElementById('join-code').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.joinGame();
        });
    }

    async preloadClap() {
        const el = document.getElementById('clap-status');
        try {
            await window.clapEngine.load((progress) => {
                if (progress.status === 'progress' && progress.total) {
                    const pct = Math.round((progress.loaded / progress.total) * 100);
                    el.textContent = `Loading sound model... ${pct}%`;
                }
            });
            this.clapReady = true;
            el.textContent = 'Sound model ready';
            el.classList.add('ready');
        } catch (err) {
            el.textContent = 'Model error: ' + err.message;
            console.error(err);
        }
    }

    showError(msg) {
        document.getElementById('lobby-error').textContent = msg;
    }

    async createGame() {
        const name = document.getElementById('player-name').value.trim();
        if (!name) { this.showError('Enter your name'); return; }
        try {
            const data = await this.api.createGame(name);
            this.game = data.game;
            location.hash = data.code;
            await this.enterGame();
        } catch (err) {
            this.showError(err.message);
        }
    }

    async joinGame() {
        const name = document.getElementById('player-name').value.trim();
        const code = document.getElementById('join-code').value.trim().toUpperCase();
        if (!code || code.length !== 4) { this.showError('Enter a 4-character code'); return; }

        // Try rejoin with saved token first
        if (this.api.loadCredentials(code)) {
            try {
                const data = await this.api.getGame();
                this.game = data.game;
                location.hash = code;
                await this.enterGame();
                return;
            } catch {
                // Token invalid, fall through to fresh join
            }
        }

        if (!name) { this.showError('Enter your name to join'); return; }

        try {
            const data = await this.api.joinGame(code, name);
            this.game = data.game;
            location.hash = code;
            await this.enterGame();
        } catch (err) {
            this.showError(err.message);
        }
    }

    // ================================================================
    //  GAME SCREEN
    // ================================================================

    async enterGame() {
        this.showScreen('game');
        await this.audio.init();
        if (!this.viz) this.viz = new Visualizer();
        this.bindGameEvents();
        this.renderGame();
    }

    bindGameEvents() {
        if (this._gameEventsBound) return;
        this._gameEventsBound = true;

        document.getElementById('record-btn').addEventListener('click', () => this.onRecord());
        document.getElementById('play-target').addEventListener('click', () => this.playTarget());
        document.getElementById('play-recorded').addEventListener('click', () => this.playRecorded());
        document.getElementById('confirm-btn').addEventListener('click', () => this.onConfirm());
        document.getElementById('next-btn').addEventListener('click', () => this.onNextRound());
        document.getElementById('refresh-btn').addEventListener('click', () => this.refreshGame());
        document.getElementById('share-btn').addEventListener('click', () => this.shareCode());
    }

    async refreshGame() {
        const btn = document.getElementById('refresh-btn');
        btn.disabled = true;
        btn.textContent = 'Checking...';
        try {
            const data = await this.api.getGame();
            this.game = data.game;
            this.renderGame();
        } catch (err) {
            console.error('Refresh error:', err);
        }
        btn.disabled = false;
        btn.textContent = 'Check for updates';
    }

    renderGame() {
        const game = this.game;
        if (!game || this.audio.isRecording) return;

        this.isSetter = game.isSetter;

        const playerLabel = document.getElementById('player-label');
        const phaseLabel = document.getElementById('phase-label');
        const recordBtn = document.getElementById('record-btn');
        const playTarget = document.getElementById('play-target');
        const playRecorded = document.getElementById('play-recorded');
        const confirmBtn = document.getElementById('confirm-btn');
        const nextBtn = document.getElementById('next-btn');
        const refreshBtn = document.getElementById('refresh-btn');
        const shareBtn = document.getElementById('share-btn');

        // Hide all action buttons
        [recordBtn, playTarget, playRecorded, confirmBtn, nextBtn, refreshBtn, shareBtn]
            .forEach(b => b.classList.add('hidden'));
        recordBtn.classList.remove('recording', 'analyzing');
        recordBtn.textContent = 'Record';
        recordBtn.disabled = false;

        this.updateScoreDisplay();

        const setterName = game.players[game.currentSetter]?.name || 'Setter';
        const matcherKey = game.currentSetter === 'creator' ? 'joiner' : 'creator';
        const matcherName = game.players[matcherKey]?.name || 'Matcher';
        const opponentName = this.isSetter ? matcherName : setterName;

        document.getElementById('game-code-display').textContent = game.code;

        switch (game.state) {
            case 'waiting':
                playerLabel.textContent = 'WAITING FOR OPPONENT';
                playerLabel.className = 'waiting';
                phaseLabel.textContent = `Share code ${game.code} with a friend`;
                shareBtn.classList.remove('hidden');
                refreshBtn.classList.remove('hidden');
                if (this.viz) {
                    this.viz.clear();
                    this.viz.drawIdle();
                }
                break;

            case 'setting':
                if (this.isSetter) {
                    playerLabel.textContent = 'YOUR TURN \u2014 SET';
                    playerLabel.className = 'setter';
                    phaseLabel.textContent = `Record a sound for ${opponentName} to match`;
                    recordBtn.classList.remove('hidden');
                    if (this.viz) {
                        this.viz.clear();
                        this.viz.drawMessage(this.viz.targetCtx, this.viz.targetCanvas, 'Your sound');
                        this.viz.drawIdle();
                        this.viz.drawMessage(this.viz.recordedCtx, this.viz.recordedCanvas, opponentName + '\u2019s attempt');
                    }
                } else {
                    playerLabel.textContent = 'WAITING';
                    playerLabel.className = 'waiting';
                    phaseLabel.textContent = `Waiting for ${opponentName} to record a sound\u2026`;
                    refreshBtn.classList.remove('hidden');
                    if (this.viz) {
                        this.viz.clear();
                        this.viz.drawIdle();
                    }
                }
                this.hideMap();
                break;

            case 'matching':
                if (!this.isSetter) {
                    playerLabel.textContent = 'YOUR TURN \u2014 MATCH';
                    playerLabel.className = 'matcher';

                    const lastAttempt = game.attempts.length > 0
                        ? game.attempts[game.attempts.length - 1] : null;
                    if (lastAttempt && !lastAttempt.matched) {
                        phaseLabel.textContent = `${Math.round(lastAttempt.score * 100)}% \u2014 not quite! Try again`;
                    } else {
                        phaseLabel.textContent = 'Listen to the target, then record your match!';
                    }

                    playTarget.classList.remove('hidden');
                    recordBtn.classList.remove('hidden');
                    this.loadTargetAudio();
                } else {
                    playerLabel.textContent = 'WAITING';
                    playerLabel.className = 'waiting';
                    if (game.attempts.length > 0) {
                        const last = game.attempts[game.attempts.length - 1];
                        phaseLabel.textContent = `${opponentName}\u2019s last attempt: ${Math.round(last.score * 100)}%`;
                        playRecorded.classList.remove('hidden');
                        playRecorded.textContent = 'Play Attempt';
                        this.loadAttemptAudio();
                    } else {
                        phaseLabel.textContent = `Waiting for ${opponentName} to match your sound\u2026`;
                    }
                    playTarget.classList.remove('hidden');
                    refreshBtn.classList.remove('hidden');
                    this.loadTargetAudio();
                }
                if (game.targetLocation) this.showMap(game.targetLocation);
                break;

            case 'matched': {
                playerLabel.textContent = 'MATCHED!';
                playerLabel.className = 'result';
                const matchScore = game.attempts.length > 0
                    ? game.attempts[game.attempts.length - 1].score : 0;
                phaseLabel.textContent = `${Math.round(matchScore * 100)}% \u2014 Round ${game.round} complete!`;
                nextBtn.classList.remove('hidden');
                playTarget.classList.remove('hidden');
                playRecorded.classList.remove('hidden');
                playRecorded.textContent = 'Play Attempt';
                this.loadTargetAudio();
                this.loadAttemptAudio();
                if (this.viz) this.viz.drawMatchMeter(matchScore, null);
                break;
            }
        }
    }

    async loadTargetAudio() {
        if (this.audio.targetBuffer) return;
        try {
            const arrayBuffer = await this.api.getTargetAudio();
            const buffer = await this.audio.decodeBlob(arrayBuffer);
            this.audio.targetBuffer = buffer;

            if (this.viz) {
                const features = this.audio.extractFeatures(buffer);
                this.viz.drawFingerprint(
                    this.viz.targetCtx, this.viz.targetCanvas,
                    features, 'TARGET', 200
                );
            }

            // Pre-compute CLAP embedding while user listens
            const cleanSamples = this.audio.getCleanEventSamples(buffer);
            this.targetEmbedding = await window.clapEngine.embed(cleanSamples, buffer.sampleRate);

            if (this.game.targetLocation) this.showMap(this.game.targetLocation);
        } catch (err) {
            console.error('Error loading target audio:', err);
        }
    }

    async loadAttemptAudio() {
        if (this.audio.recordedBuffer) return;
        try {
            const arrayBuffer = await this.api.getAttemptAudio();
            const buffer = await this.audio.decodeBlob(arrayBuffer);
            this.audio.recordedBuffer = buffer;

            if (this.viz) {
                const features = this.audio.extractFeatures(buffer);
                this.viz.drawFingerprint(
                    this.viz.recordedCtx, this.viz.recordedCanvas,
                    features, 'ATTEMPT', 15
                );
            }
        } catch (err) {
            console.error('Error loading attempt audio:', err);
        }
    }

    // ================================================================
    //  RECORDING (purely client-side until upload/compare)
    // ================================================================

    async onRecord() {
        if (this.audio.isRecording) {
            await this.stopRecording();
        } else {
            await this.startRecording();
        }
    }

    async startRecording() {
        const btn = document.getElementById('record-btn');
        btn.classList.add('recording');
        btn.textContent = 'Stop';

        try {
            await this.audio.startRecording();
        } catch {
            btn.classList.remove('recording');
            btn.textContent = 'Record';
            alert('Microphone access denied.');
            return;
        }

        const isSetter = this.isSetter;
        const drawLive = () => {
            if (!this.audio.isRecording) return;
            const data = this.audio.getLiveFrequencyData();
            if (isSetter) {
                this.viz.drawLiveWaveform(data, this.viz.targetCtx, this.viz.targetCanvas);
            } else {
                this.viz.drawLiveWaveform(data);
            }
            this.liveAnimFrame = requestAnimationFrame(drawLive);
        };
        drawLive();
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

            if (this.isSetter) {
                this.audio.targetBuffer = buffer;
                const features = this.audio.extractFeatures(buffer);
                this.viz.drawFingerprint(
                    this.viz.targetCtx, this.viz.targetCanvas,
                    features, 'YOUR SOUND', 200
                );
                this.showSetterConfirm();
            } else {
                const features = this.audio.extractFeatures(buffer);
                this.viz.drawFingerprint(
                    this.viz.recordedCtx, this.viz.recordedCanvas,
                    features, 'YOUR ATTEMPT', 15
                );

                // CLAP comparison
                const cleanSamples = this.audio.getCleanEventSamples(buffer);
                const recordedEmbedding = await window.clapEngine.embed(
                    cleanSamples, buffer.sampleRate
                );
                const score = window.clapEngine.similarity(this.targetEmbedding, recordedEmbedding);
                this.viz.drawMatchMeter(score, null);

                // Report to server (include audio so setter can listen)
                const attemptArrayBuffer = await this.audio.getRecordingArrayBuffer();
                const result = await this.api.reportResult(score, attemptArrayBuffer);
                this.game = result.game;

                if (result.matched) {
                    this.renderGame();
                } else {
                    const phaseLabel = document.getElementById('phase-label');
                    phaseLabel.textContent = `${Math.round(score * 100)}% \u2014 not quite! Try again`;
                    btn.classList.remove('analyzing');
                    btn.textContent = 'Try Again';
                    btn.disabled = false;
                    btn.classList.remove('hidden');
                    document.getElementById('play-target').classList.remove('hidden');
                }
            }
        } catch (err) {
            console.error('Recording error:', err);
            btn.classList.remove('analyzing');
            btn.textContent = 'Record';
            btn.disabled = false;
        }
    }

    showSetterConfirm() {
        const recordBtn = document.getElementById('record-btn');
        const playRecorded = document.getElementById('play-recorded');
        const confirmBtn = document.getElementById('confirm-btn');

        recordBtn.classList.remove('analyzing');
        recordBtn.textContent = 'Re-record';
        recordBtn.disabled = false;
        recordBtn.classList.remove('hidden');

        playRecorded.classList.remove('hidden');
        playRecorded.textContent = 'Play Back';
        confirmBtn.classList.remove('hidden');

        document.getElementById('phase-label').textContent = 'Happy with your sound?';
    }

    async onConfirm() {
        const confirmBtn = document.getElementById('confirm-btn');
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Uploading\u2026';

        try {
            const arrayBuffer = await this.audio.getRecordingArrayBuffer();
            const location = await this.captureLocation();
            const result = await this.api.uploadTarget(arrayBuffer, location);
            this.game = result.game;
            this.renderGame();
        } catch (err) {
            console.error('Upload error:', err);
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Confirm Sound';
        }
    }

    async onNextRound() {
        try {
            const result = await this.api.nextRound();
            this.game = result.game;
            this.audio.targetBuffer = null;
            this.audio.recordedBuffer = null;
            this.targetEmbedding = null;
            if (this.viz) this.viz.clear();
            this.hideMap();
            this.renderGame();
        } catch (err) {
            console.error('Next round error:', err);
        }
    }

    // ================================================================
    //  PLAYBACK
    // ================================================================

    async playTarget() {
        if (!this.audio.targetBuffer) return;
        const btn = document.getElementById('play-target');
        btn.disabled = true;
        btn.textContent = 'Playing\u2026';
        try { await this.audio.playTarget(); } catch (e) { console.warn(e); }
        btn.disabled = false;
        btn.textContent = 'Play Target';
    }

    async playRecorded() {
        // In setter-confirm, this plays back the setter's own recording
        // Otherwise, it plays the matcher's attempt
        const isSetterConfirm = this.isSetter && this.game?.state === 'setting';
        const buffer = isSetterConfirm ? this.audio.targetBuffer : this.audio.recordedBuffer;
        if (!buffer) return;
        const btn = document.getElementById('play-recorded');
        const label = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Playing\u2026';
        try { await this.audio.playBuffer(buffer); } catch (e) { console.warn(e); }
        btn.disabled = false;
        btn.textContent = label;
    }

    // ================================================================
    //  SHARE
    // ================================================================

    async shareCode() {
        const code = this.game.code;
        const url = `${location.origin}#${code}`;
        if (navigator.share) {
            try { await navigator.share({ title: 'Audio Tennis', text: `Join my game: ${code}`, url }); }
            catch { /* user cancelled */ }
        } else if (navigator.clipboard) {
            await navigator.clipboard.writeText(url);
            document.getElementById('phase-label').textContent = 'Link copied to clipboard!';
        }
    }

    // ================================================================
    //  LOCATION / MAP
    // ================================================================

    captureLocation() {
        return new Promise((resolve) => {
            if (!navigator.geolocation) { resolve(null); return; }
            navigator.geolocation.getCurrentPosition(
                (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                () => resolve(null),
                { enableHighAccuracy: true, timeout: 10000 }
            );
        });
    }

    showMap(location) {
        const section = document.getElementById('location-section');
        if (!location) { section.classList.add('hidden'); return; }

        section.classList.remove('hidden');
        document.getElementById('location-label').textContent = 'Recorded here';

        if (!this.map) {
            this.map = L.map('map', { zoomControl: false, attributionControl: false })
                .setView([location.lat, location.lng], 15);
            L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                maxZoom: 19,
            }).addTo(this.map);
        } else {
            this.map.setView([location.lat, location.lng], 15);
        }

        if (this.mapMarker) {
            this.mapMarker.setLatLng([location.lat, location.lng]);
        } else {
            this.mapMarker = L.circleMarker([location.lat, location.lng], {
                radius: 10, color: '#2563eb', fillColor: '#2563eb',
                fillOpacity: 0.4, weight: 2,
            }).addTo(this.map);
        }
        setTimeout(() => this.map.invalidateSize(), 100);
    }

    hideMap() {
        document.getElementById('location-section').classList.add('hidden');
    }

    // ================================================================
    //  SCREENS
    // ================================================================

    showScreen(name) {
        for (const s of ['lobby', 'game']) {
            document.getElementById(`screen-${s}`).classList.toggle('hidden', s !== name);
        }
    }

    updateScoreDisplay() {
        if (!this.game) return;
        const myScore = this.game.players[this.game.myRole]?.score || 0;
        document.getElementById('round-display').textContent = `Round ${this.game.round}`;
        document.getElementById('score-display').textContent = `Score: ${myScore}`;
    }
}

const game = new AudioTennis();
