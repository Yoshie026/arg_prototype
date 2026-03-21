class Visualizer {
    constructor() {
        this.targetCanvas = document.getElementById('target-canvas');
        this.matchCanvas = document.getElementById('match-canvas');
        this.recordedCanvas = document.getElementById('recorded-canvas');
        this.targetCtx = this.targetCanvas.getContext('2d');
        this.matchCtx = this.matchCanvas.getContext('2d');
        this.recordedCtx = this.recordedCanvas.getContext('2d');
        this.animFrameId = null;

        // HiDPI support
        this.scaleCanvas(this.targetCanvas, this.targetCtx);
        this.scaleCanvas(this.matchCanvas, this.matchCtx);
        this.scaleCanvas(this.recordedCanvas, this.recordedCtx);
    }

    scaleCanvas(canvas, ctx) {
        const dpr = window.devicePixelRatio || 1;
        const w = canvas.width;
        const h = canvas.height;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
        ctx.scale(dpr, dpr);
        // Store logical size
        canvas._w = w;
        canvas._h = h;
    }

    /**
     * Draw an MFCC heatmap fingerprint for a sound.
     */
    drawFingerprint(ctx, canvas, features, label, hueBase) {
        const w = canvas._w;
        const h = canvas._h;
        ctx.clearRect(0, 0, w, h);

        // Background
        ctx.fillStyle = '#0d0d14';
        ctx.fillRect(0, 0, w, h);

        if (!features || !features.mfccFrames || features.mfccFrames.length === 0) {
            ctx.fillStyle = '#333';
            ctx.font = '13px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label || 'Waiting...', w / 2, h / 2);
            return;
        }

        const frames = features.mfccFrames;
        const numCoeffs = frames[0].length;

        // Downsample frames if too many
        const maxFrames = Math.floor(w / 2);
        let displayFrames = frames;
        if (frames.length > maxFrames) {
            const step = frames.length / maxFrames;
            displayFrames = [];
            for (let i = 0; i < maxFrames; i++) {
                displayFrames.push(frames[Math.floor(i * step)]);
            }
        }

        const cellW = w / displayFrames.length;
        const cellH = (h - 20) / numCoeffs; // Leave room for label

        // Find min/max across all MFCC values for normalization
        let min = Infinity, max = -Infinity;
        for (const frame of displayFrames) {
            for (const val of frame) {
                if (val < min) min = val;
                if (val > max) max = val;
            }
        }
        const range = max - min || 1;

        // Draw heatmap
        for (let f = 0; f < displayFrames.length; f++) {
            for (let c = 0; c < numCoeffs; c++) {
                const normalized = (displayFrames[f][c] - min) / range;
                const hue = hueBase + normalized * 50;
                const lightness = 8 + normalized * 45;
                const saturation = 60 + normalized * 30;
                ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
                ctx.fillRect(
                    Math.floor(f * cellW),
                    Math.floor(c * cellH),
                    Math.ceil(cellW) + 1,
                    Math.ceil(cellH) + 1
                );
            }
        }

        // RMS envelope overlay
        if (features.rmsFrames) {
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
            ctx.lineWidth = 1.5;
            const rmsMax = Math.max(...features.rmsFrames, 0.001);
            const rmsStep = features.rmsFrames.length > maxFrames
                ? features.rmsFrames.length / maxFrames : 1;
            for (let i = 0; i < displayFrames.length; i++) {
                const ri = Math.floor(i * rmsStep);
                const val = (features.rmsFrames[ri] || 0) / rmsMax;
                const x = i * cellW + cellW / 2;
                const y = (h - 20) - val * (h - 30);
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
        }

        // Label
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = '11px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText(label, 8, h - 4);
    }

    /**
     * Draw the circular match meter with score and breakdown.
     */
    drawMatchMeter(score, breakdown) {
        const ctx = this.matchCtx;
        const w = this.matchCanvas._w;
        const h = this.matchCanvas._h;
        const cx = w / 2;
        const cy = h / 2;
        const radius = Math.min(w, h) / 2 - 20;

        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#0d0d14';
        ctx.fillRect(0, 0, w, h);

        // Background ring
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.strokeStyle = '#1a1a2a';
        ctx.lineWidth = 10;
        ctx.stroke();

        // Score color: red(0) -> yellow(0.5) -> green(1)
        const hue = score < 0.5 ? score * 2 * 60 : 60 + (score - 0.5) * 2 * 60;
        const color = `hsl(${hue}, 75%, 55%)`;

        // Score arc
        const startAngle = -Math.PI / 2;
        const endAngle = startAngle + Math.PI * 2 * score;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, startAngle, endAngle);
        ctx.strokeStyle = color;
        ctx.lineWidth = 10;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Glow
        ctx.shadowColor = color;
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, startAngle, endAngle);
        ctx.strokeStyle = color;
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Percentage text
        const pct = Math.round(score * 100);
        ctx.fillStyle = color;
        ctx.font = 'bold 32px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${pct}%`, cx, cy - 6);

        // Sub-label
        ctx.fillStyle = '#555';
        ctx.font = '10px monospace';
        ctx.fillText('MATCH', cx, cy + 18);

        // Collected badge
        if (score >= 0.7) {
            ctx.fillStyle = color;
            ctx.font = 'bold 12px monospace';
            ctx.fillText('COLLECTED!', cx, cy + 38);
        }

        // Feature breakdown bars (if available)
        if (breakdown) {
            this.drawBreakdownBars(ctx, breakdown, w, h);
        }
    }

    drawBreakdownBars(ctx, breakdown, w, h) {
        const labels = ['timbre', 'brightness', 'tonality', 'texture', 'energy'];
        const barH = 3;
        const barW = w - 40;
        const startX = 20;
        const startY = h - 8 - labels.length * (barH + 5);

        ctx.font = '8px monospace';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';

        for (let i = 0; i < labels.length; i++) {
            const key = labels[i];
            const val = breakdown[key] || 0;
            const y = startY + i * (barH + 5);

            // Background bar
            ctx.fillStyle = '#1a1a2a';
            ctx.fillRect(startX, y, barW, barH);

            // Value bar
            const hue = val < 0.5 ? val * 2 * 60 : 60 + (val - 0.5) * 2 * 60;
            ctx.fillStyle = `hsl(${hue}, 70%, 50%)`;
            ctx.fillRect(startX, y, barW * val, barH);
        }
    }

    /**
     * Draw a centered text message on any canvas.
     */
    drawMessage(ctx, canvas, text) {
        const w = canvas._w;
        const h = canvas._h;
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#0d0d14';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#333';
        ctx.font = '12px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, w / 2, h / 2);
    }

    /**
     * Draw live frequency bars during recording.
     * Optionally pass a different ctx/canvas to draw on (e.g. target canvas for P1).
     */
    drawLiveWaveform(frequencyData, ctx, canvas) {
        ctx = ctx || this.recordedCtx;
        canvas = canvas || this.recordedCanvas;
        const w = canvas._w;
        const h = canvas._h;

        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#0d0d14';
        ctx.fillRect(0, 0, w, h);

        if (!frequencyData) return;

        const barCount = Math.min(frequencyData.length, 64);
        const step = Math.floor(frequencyData.length / barCount);
        const barW = (w - barCount) / barCount;
        const gap = 1;

        for (let i = 0; i < barCount; i++) {
            const val = frequencyData[i * step] / 255;
            const barH = val * (h - 24);
            const hue = 350 + val * 30;
            const lightness = 15 + val * 40;
            ctx.fillStyle = `hsl(${hue}, 70%, ${lightness}%)`;
            ctx.fillRect(
                i * (barW + gap),
                h - 20 - barH,
                barW,
                barH
            );
        }

        // Label
        ctx.fillStyle = '#ff6b6b';
        ctx.font = '11px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText('RECORDING...', 8, h - 4);
    }

    /**
     * Show idle state on the match canvas.
     */
    drawIdle() {
        const ctx = this.matchCtx;
        const w = this.matchCanvas._w;
        const h = this.matchCanvas._h;

        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#0d0d14';
        ctx.fillRect(0, 0, w, h);

        ctx.fillStyle = '#222';
        ctx.font = '12px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Record a sound', w / 2, h / 2 - 8);
        ctx.fillText('to compare', w / 2, h / 2 + 8);
    }

    /**
     * Clear all canvases to initial state.
     */
    clear() {
        for (const [ctx, canvas] of [
            [this.targetCtx, this.targetCanvas],
            [this.matchCtx, this.matchCanvas],
            [this.recordedCtx, this.recordedCanvas],
        ]) {
            ctx.clearRect(0, 0, canvas._w, canvas._h);
            ctx.fillStyle = '#0d0d14';
            ctx.fillRect(0, 0, canvas._w, canvas._h);
        }
    }
}
