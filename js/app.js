const MATCH_THRESHOLD = 0.85;

const PHASE = {
    P1_RECORD: 'p1_record',
    P1_CONFIRM: 'p1_confirm',
    P2_READY: 'p2_ready',
    P2_RECORD: 'p2_record',
    P2_RESULT: 'p2_result',
};

class SoundMatchGame {
    constructor() {
        this.audio = new AudioEngine();
        this.viz = new Visualizer();
        this.score = 0;
        this.total = 0;
        this.phase = null;
        this.targetFeatures = null;   // Meyda features (for visualization)
        this.targetEmbedding = null;  // CLAP 512-d embedding (for comparison)
        this.liveAnimFrame = null;
        this.targetLocation = null;
        this.map = null;
        this.mapMarker = null;

        this.bindEvents();
    }

    bindEvents() {
        document.getElementById('start-btn').addEventListener('click', () => this.start());
        document.getElementById('record-btn').addEventListener('click', () => this.onRecord());
        document.getElementById('play-target').addEventListener('click', () => this.playTarget());
        document.getElementById('play-recorded').addEventListener('click', () => this.playRecorded());
        document.getElementById('confirm-btn').addEventListener('click', () => this.onConfirm());
        document.getElementById('next-btn').addEventListener('click', () => this.nextRound());
    }

    async start() {
        const startBtn = document.getElementById('start-btn');
        const loadingEl = document.getElementById('loading-status');

        startBtn.disabled = true;

        try {
            // Init audio
            await this.audio.init();

            // Load CLAP model (cached after first download)
            loadingEl.classList.remove('hidden');
            loadingEl.textContent = 'Loading sound model (~33 MB, first time only)...';

            await window.clapEngine.load((progress) => {
                if (progress.status === 'progress' && progress.total) {
                    const pct = Math.round((progress.loaded / progress.total) * 100);
                    loadingEl.textContent = `Loading model... ${pct}%`;
                }
            });

            loadingEl.textContent = 'Model ready!';
        } catch (err) {
            loadingEl.textContent = 'Error loading model: ' + err.message;
            startBtn.disabled = false;
            console.error(err);
            return;
        }

        document.getElementById('setup').classList.add('hidden');
        document.getElementById('game').classList.remove('hidden');

        this.nextRound();
    }

    // --- Location ---

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
        const label = document.getElementById('location-label');
        if (!location) { section.classList.add('hidden'); return; }

        section.classList.remove('hidden');
        label.textContent = 'Recorded here';

        if (!this.map) {
            this.map = L.map('map', { zoomControl: false, attributionControl: false })
                .setView([location.lat, location.lng], 15);
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                maxZoom: 19,
            }).addTo(this.map);
        } else {
            this.map.setView([location.lat, location.lng], 15);
        }

        if (this.mapMarker) {
            this.mapMarker.setLatLng([location.lat, location.lng]);
        } else {
            this.mapMarker = L.circleMarker([location.lat, location.lng], {
                radius: 10, color: '#00d4ff', fillColor: '#00d4ff', fillOpacity: 0.5, weight: 2,
            }).addTo(this.map);
        }
        setTimeout(() => this.map.invalidateSize(), 100);
    }

    hideMap() {
        document.getElementById('location-section').classList.add('hidden');
    }

    // --- Phase transitions ---

    nextRound() {
        this.audio.targetBuffer = null;
        this.audio.recordedBuffer = null;
        this.targetFeatures = null;
        this.targetEmbedding = null;
        this.targetLocation = null;

        this.viz.clear();
        this.hideMap();
        this.setPhase(PHASE.P1_RECORD);
    }

    setPhase(phase) {
        this.phase = phase;
        const playerLabel = document.getElementById('player-label');
        const phaseLabel = document.getElementById('phase-label');
        const recordBtn = document.getElementById('record-btn');
        const playTarget = document.getElementById('play-target');
        const playRecorded = document.getElementById('play-recorded');
        const confirmBtn = document.getElementById('confirm-btn');
        const nextBtn = document.getElementById('next-btn');

        recordBtn.classList.remove('recording', 'analyzing');
        recordBtn.textContent = 'Record';
        [playTarget, playRecorded, confirmBtn, nextBtn].forEach(b => b.classList.add('hidden'));

        switch (phase) {
            case PHASE.P1_RECORD:
                playerLabel.textContent = 'Player 1';
                playerLabel.className = 'p1';
                phaseLabel.textContent = 'Record a sound for Player 2 to match';
                recordBtn.classList.remove('hidden');
                recordBtn.disabled = false;
                this.hideMap();
                this.viz.clear();
                this.viz.drawMessage(this.viz.targetCtx, this.viz.targetCanvas, 'Player 1\'s sound');
                this.viz.drawIdle();
                this.viz.drawMessage(this.viz.recordedCtx, this.viz.recordedCanvas, 'Player 2\'s sound');
                break;

            case PHASE.P1_CONFIRM:
                playerLabel.textContent = 'Player 1';
                playerLabel.className = 'p1';
                phaseLabel.textContent = 'Happy with your sound?';
                recordBtn.classList.remove('hidden');
                recordBtn.disabled = false;
                recordBtn.textContent = 'Re-record';
                playRecorded.classList.remove('hidden');
                playRecorded.textContent = 'Play Back';
                confirmBtn.classList.remove('hidden');
                this.hideMap();
                break;

            case PHASE.P2_READY:
                playerLabel.textContent = 'Player 2';
                playerLabel.className = 'p2';
                phaseLabel.textContent = 'Your turn! Listen, then match the sound';
                playTarget.classList.remove('hidden');
                recordBtn.classList.remove('hidden');
                recordBtn.disabled = false;
                this.viz.drawMessage(this.viz.targetCtx, this.viz.targetCanvas, 'Press "Play Target" to listen');
                this.viz.drawIdle();
                this.viz.drawMessage(this.viz.recordedCtx, this.viz.recordedCanvas, 'Your attempt');
                this.showMap(this.targetLocation);
                this.total++;
                this.updateScore();
                break;

            case PHASE.P2_RESULT:
                playerLabel.textContent = 'Result';
                playerLabel.className = 'result';
                recordBtn.classList.remove('hidden');
                recordBtn.disabled = false;
                recordBtn.textContent = 'Try Again';
                playTarget.classList.remove('hidden');
                playRecorded.classList.remove('hidden');
                playRecorded.textContent = 'Play Recording';
                this.viz.drawFingerprint(
                    this.viz.targetCtx, this.viz.targetCanvas,
                    this.targetFeatures, 'TARGET (P1)', 200
                );
                this.showMap(this.targetLocation);
                break;
        }
    }

    // --- Recording ---

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
        } catch (err) {
            btn.classList.remove('recording');
            btn.textContent = 'Record';
            alert('Microphone access denied. Please allow mic access and try again.');
            return;
        }

        const targetCanvas = this.phase === PHASE.P1_RECORD || this.phase === PHASE.P1_CONFIRM;
        const drawLive = () => {
            if (!this.audio.isRecording) return;
            const data = this.audio.getLiveFrequencyData();
            if (targetCanvas) {
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
        btn.textContent = 'Analyzing...';
        btn.disabled = true;

        try {
            const buffer = await this.audio.stopRecording();

            if (this.phase === PHASE.P1_RECORD || this.phase === PHASE.P1_CONFIRM) {
                // Player 1 recorded the target
                this.audio.targetBuffer = buffer;

                // Meyda features for visualization
                this.targetFeatures = this.audio.extractFeatures(buffer);
                this.viz.drawFingerprint(
                    this.viz.targetCtx, this.viz.targetCanvas,
                    this.targetFeatures, 'YOUR SOUND', 200
                );

                // CLAP embedding for comparison — denoise + extract main event first
                const cleanSamples = this.audio.getCleanEventSamples(buffer);
                this.targetEmbedding = await window.clapEngine.embed(
                    cleanSamples, buffer.sampleRate
                );

                // Capture location
                this.targetLocation = await this.captureLocation();

                this.setPhase(PHASE.P1_CONFIRM);
            } else {
                // Player 2 recorded their attempt
                const recordedFeatures = this.audio.extractFeatures(this.audio.recordedBuffer);
                this.viz.drawFingerprint(
                    this.viz.recordedCtx, this.viz.recordedCanvas,
                    recordedFeatures, 'YOUR ATTEMPT', 15
                );

                // CLAP embedding for comparison
                const cleanSamples = this.audio.getCleanEventSamples(this.audio.recordedBuffer);
                const recordedEmbedding = await window.clapEngine.embed(
                    cleanSamples, this.audio.recordedBuffer.sampleRate
                );

                // Compare using CLAP embeddings
                const score = window.clapEngine.similarity(this.targetEmbedding, recordedEmbedding);
                this.viz.drawMatchMeter(score, null);

                this.setPhase(PHASE.P2_RESULT);

                if (score >= MATCH_THRESHOLD) {
                    this.score++;
                    this.updateScore();
                    document.getElementById('phase-label').textContent = `${Math.round(score * 100)}% — Matched!`;
                    document.getElementById('next-btn').classList.remove('hidden');
                    document.getElementById('record-btn').classList.add('hidden');
                } else {
                    document.getElementById('phase-label').textContent =
                        `${Math.round(score * 100)}% — not quite. Try again!`;
                }
            }
        } catch (err) {
            console.error('Recording/analysis error:', err);
            btn.classList.remove('analyzing');
            btn.textContent = 'Record';
            btn.disabled = false;
        }
    }

    onConfirm() {
        this.setPhase(PHASE.P2_READY);
    }

    // --- Playback ---

    async playTarget() {
        if (!this.audio.targetBuffer) return;
        const btn = document.getElementById('play-target');
        btn.disabled = true; btn.textContent = 'Playing...';
        try { await this.audio.playTarget(); } catch (e) { console.warn(e); }
        btn.disabled = false; btn.textContent = 'Play Target';
    }

    async playRecorded() {
        const buffer = this.phase === PHASE.P1_CONFIRM
            ? this.audio.targetBuffer : this.audio.recordedBuffer;
        if (!buffer) return;
        const btn = document.getElementById('play-recorded');
        btn.disabled = true; btn.textContent = 'Playing...';
        try { await this.audio.playBuffer(buffer); } catch (e) { console.warn(e); }
        btn.disabled = false;
        btn.textContent = this.phase === PHASE.P1_CONFIRM ? 'Play Back' : 'Play Recording';
    }

    updateScore() {
        document.getElementById('score').textContent = this.score;
        document.getElementById('total').textContent = this.total;
    }
}

const game = new SoundMatchGame();
