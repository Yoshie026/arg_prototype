const MATCH_THRESHOLD = 0.70;

// Phases of the game
const PHASE = {
    P1_RECORD: 'p1_record',   // Player 1 records the target sound
    P1_CONFIRM: 'p1_confirm', // Player 1 reviews and confirms
    P2_READY: 'p2_ready',     // Hand off to Player 2
    P2_RECORD: 'p2_record',   // Player 2 records their attempt
    P2_RESULT: 'p2_result',   // Show comparison results
};

class SoundMatchGame {
    constructor() {
        this.audio = new AudioEngine();
        this.viz = new Visualizer();
        this.score = 0;
        this.total = 0;
        this.phase = null;
        this.targetFeatures = null;
        this.liveAnimFrame = null;

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
        try {
            await this.audio.init();
        } catch (err) {
            alert('Could not initialize audio: ' + err.message);
            return;
        }

        document.getElementById('setup').classList.add('hidden');
        document.getElementById('game').classList.remove('hidden');

        this.nextRound();
    }

    // --- Phase transitions ---

    nextRound() {
        this.audio.targetBuffer = null;
        this.audio.recordedBuffer = null;
        this.targetFeatures = null;

        this.viz.clear();
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

        // Reset all controls
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
                break;

            case PHASE.P2_READY:
                playerLabel.textContent = 'Player 2';
                playerLabel.className = 'p2';
                phaseLabel.textContent = 'Your turn! Listen, then match the sound';
                playTarget.classList.remove('hidden');
                recordBtn.classList.remove('hidden');
                recordBtn.disabled = false;
                // Hide P1's fingerprint so P2 only has the audio to go on
                this.viz.drawMessage(this.viz.targetCtx, this.viz.targetCanvas, 'Press "Play Target" to listen');
                this.viz.drawIdle();
                this.viz.drawMessage(this.viz.recordedCtx, this.viz.recordedCanvas, 'Your attempt');
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
                // Show target fingerprint now that comparison is done
                this.viz.drawFingerprint(
                    this.viz.targetCtx, this.viz.targetCanvas,
                    this.targetFeatures, 'TARGET (P1)', 200
                );
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
                // Player 1 just recorded the target
                this.audio.targetBuffer = buffer;
                this.targetFeatures = this.audio.extractFeatures(buffer);
                this.viz.drawFingerprint(
                    this.viz.targetCtx, this.viz.targetCanvas,
                    this.targetFeatures, 'YOUR SOUND', 200
                );
                this.setPhase(PHASE.P1_CONFIRM);
            } else {
                // Player 2 recorded their attempt
                const recordedFeatures = this.audio.extractFeatures(this.audio.recordedBuffer);
                this.viz.drawFingerprint(
                    this.viz.recordedCtx, this.viz.recordedCanvas,
                    recordedFeatures, 'YOUR ATTEMPT', 15
                );

                const score = this.audio.compareSounds(this.targetFeatures, recordedFeatures);
                const breakdown = this.audio.featureBreakdown(this.targetFeatures, recordedFeatures);
                this.viz.drawMatchMeter(score, breakdown);

                if (score >= MATCH_THRESHOLD) {
                    this.score++;
                    this.updateScore();
                    document.getElementById('phase-label').textContent = 'Matched! Nice work.';
                    document.getElementById('next-btn').classList.remove('hidden');
                } else {
                    document.getElementById('phase-label').textContent =
                        `${Math.round(score * 100)}% — not quite. Try again!`;
                }

                this.setPhase(PHASE.P2_RESULT);
                // Restore the right label after setPhase overwrites it
                if (score >= MATCH_THRESHOLD) {
                    document.getElementById('phase-label').textContent = 'Matched! Nice work.';
                    document.getElementById('next-btn').classList.remove('hidden');
                    document.getElementById('record-btn').classList.add('hidden');
                } else {
                    document.getElementById('phase-label').textContent =
                        `${Math.round(score * 100)}% — not quite. Try again!`;
                }
            }
        } catch (err) {
            console.error('Recording error:', err);
            btn.classList.remove('analyzing');
            btn.textContent = 'Record';
            btn.disabled = false;
        }
    }

    // --- Confirm (Player 1 done) ---

    onConfirm() {
        // Hand the device to Player 2
        this.setPhase(PHASE.P2_READY);
    }

    // --- Playback ---

    async playTarget() {
        if (!this.audio.targetBuffer) return;
        const btn = document.getElementById('play-target');
        btn.disabled = true;
        btn.textContent = 'Playing...';
        try {
            await this.audio.playTarget();
        } catch (e) {
            console.warn('Playback error:', e);
        }
        btn.disabled = false;
        btn.textContent = 'Play Target';
    }

    async playRecorded() {
        const buffer = this.phase === PHASE.P1_CONFIRM
            ? this.audio.targetBuffer
            : this.audio.recordedBuffer;
        if (!buffer) return;
        const btn = document.getElementById('play-recorded');
        btn.disabled = true;
        btn.textContent = 'Playing...';
        try {
            await this.audio.playBuffer(buffer);
        } catch (e) {
            console.warn('Playback error:', e);
        }
        btn.disabled = false;
        btn.textContent = this.phase === PHASE.P1_CONFIRM ? 'Play Back' : 'Play Recording';
    }

    updateScore() {
        document.getElementById('score').textContent = this.score;
        document.getElementById('total').textContent = this.total;
    }
}

const game = new SoundMatchGame();
