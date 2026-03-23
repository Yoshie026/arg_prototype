class Visualizer {
    constructor() {
        this.targetCanvas = document.getElementById('target-canvas');
        this.recordedCanvas = document.getElementById('recorded-canvas');
        this.targetCtx = this.targetCanvas.getContext('2d');
        this.recordedCtx = this.recordedCanvas.getContext('2d');

        this.scaleCanvas(this.targetCanvas, this.targetCtx);
        this.scaleCanvas(this.recordedCanvas, this.recordedCtx);

        // Dummy refs for match canvas (hidden, unused)
        this.matchCanvas = document.getElementById('match-canvas');
        this.matchCtx = this.matchCanvas.getContext('2d');
        this.matchCanvas._w = 1;
        this.matchCanvas._h = 1;
    }

    scaleCanvas(canvas, ctx) {
        const dpr = window.devicePixelRatio || 1;
        const w = canvas.width;
        const h = canvas.height;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        ctx.scale(dpr, dpr);
        canvas._w = w;
        canvas._h = h;
    }

    drawFingerprint(ctx, canvas, features, label) {
        const w = canvas._w;
        const h = canvas._h;
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#f8fbff';
        ctx.fillRect(0, 0, w, h);

        if (!features || !features.rmsFrames || features.rmsFrames.length === 0) {
            ctx.fillStyle = '#ccc';
            ctx.font = '13px -apple-system, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label || 'No audio', w / 2, h / 2);
            return;
        }

        const rms = features.rmsFrames;
        const totalFrames = rms.length;
        const event = features.mainEvent || { start: 0, end: totalFrames - 1 };
        const centerY = Math.round(h * 0.5);
        const ampMax = Math.max(10, Math.floor(h * 0.43));

        // Soft baseline so users can orient quickly.
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(18, 28, 45, 0.16)';
        ctx.lineWidth = 1;
        ctx.moveTo(0, centerY);
        ctx.lineTo(w, centerY);
        ctx.stroke();

        const displayCount = Math.max(8, Math.min(totalFrames, w));
        const frameStep = totalFrames / displayCount;
        const normalized = new Float32Array(displayCount);
        let rmsPeak = 0.001;

        for (let i = 0; i < displayCount; i++) {
            const idx = Math.min(totalFrames - 1, Math.floor(i * frameStep));
            const val = rms[idx] || 0;
            normalized[i] = val;
            if (val > rmsPeak) rmsPeak = val;
        }

        // Light smoothing improves readability without hiding rhythm.
        for (let i = 1; i < displayCount - 1; i++) {
            normalized[i] = (normalized[i - 1] + normalized[i] * 2 + normalized[i + 1]) / 4;
        }

        const xScale = displayCount > 1 ? w / (displayCount - 1) : w;
        const eventStartX = Math.max(0, Math.min(w, (event.start / Math.max(1, totalFrames - 1)) * w));
        const eventEndX = Math.max(0, Math.min(w, (event.end / Math.max(1, totalFrames - 1)) * w));

        // Shade the main event region subtly.
        ctx.fillStyle = 'rgba(18, 28, 45, 0.05)';
        ctx.fillRect(eventStartX, 2, Math.max(1, eventEndX - eventStartX), h - 4);

        // Main mirrored waveform silhouette.
        ctx.beginPath();
        ctx.moveTo(0, centerY);
        for (let i = 0; i < displayCount; i++) {
            const x = i * xScale;
            const a = (normalized[i] / rmsPeak) * ampMax;
            ctx.lineTo(x, centerY - a);
        }
        for (let i = displayCount - 1; i >= 0; i--) {
            const x = i * xScale;
            const a = (normalized[i] / rmsPeak) * ampMax;
            ctx.lineTo(x, centerY + a);
        }
        ctx.closePath();
        ctx.fillStyle = 'rgba(18, 28, 45, 0.20)';
        ctx.fill();

        // Crisp contour on top.
        ctx.beginPath();
        for (let i = 0; i < displayCount; i++) {
            const x = i * xScale;
            const a = (normalized[i] / rmsPeak) * ampMax;
            const y = centerY - a;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = 'rgba(12, 18, 32, 0.72)';
        ctx.lineWidth = 1.4;
        ctx.stroke();

        // Label
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.font = '500 10px -apple-system, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText(label, 5, h - 2);
    }

    drawLiveWaveform(frequencyData, ctx, canvas) {
        ctx = ctx || this.recordedCtx;
        canvas = canvas || this.recordedCanvas;
        const w = canvas._w;
        const h = canvas._h;

        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#fafafa';
        ctx.fillRect(0, 0, w, h);

        if (!frequencyData) return;

        const barCount = Math.min(frequencyData.length, 64);
        const step = Math.floor(frequencyData.length / barCount);
        const gap = 1.5;
        const barW = (w - barCount * gap) / barCount;

        for (let i = 0; i < barCount; i++) {
            const val = frequencyData[i * step] / 255;
            const barH = val * (h - 8);
            ctx.fillStyle = `rgba(0,0,0,${0.12 + val * 0.65})`;
            ctx.fillRect(
                Math.round(i * (barW + gap)),
                h - 4 - barH,
                Math.round(barW),
                barH
            );
        }
    }

    clear() {
        for (const [ctx, canvas] of [
            [this.targetCtx, this.targetCanvas],
            [this.recordedCtx, this.recordedCanvas],
        ]) {
            ctx.clearRect(0, 0, canvas._w, canvas._h);
            ctx.fillStyle = '#fafafa';
            ctx.fillRect(0, 0, canvas._w, canvas._h);
        }
    }
}
