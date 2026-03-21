class AudioEngine {
    constructor() {
        this.audioContext = null;
        this.targetBuffer = null;
        this.recordedBuffer = null;
        this.mediaStream = null;
        this.mediaRecorder = null;
        this.isRecording = false;
        this.recordedChunks = [];
        this.liveSource = null;
        this.liveAnalyser = null;
    }

    async init() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        // Resume context (browser autoplay policy)
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
    }

    async loadSound(url) {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch sound: ${response.status}`);
        const arrayBuffer = await response.arrayBuffer();
        this.targetBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
        return this.targetBuffer;
    }

    async playBuffer(buffer) {
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(this.audioContext.destination);
        source.start();
        return new Promise(resolve => {
            source.onended = resolve;
        });
    }

    playTarget() {
        if (this.targetBuffer) return this.playBuffer(this.targetBuffer);
    }

    playRecorded() {
        if (this.recordedBuffer) return this.playBuffer(this.recordedBuffer);
    }

    async startRecording() {
        if (this.isRecording) return;

        this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.mediaRecorder = new MediaRecorder(this.mediaStream);
        this.recordedChunks = [];

        this.mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) this.recordedChunks.push(e.data);
        };

        this.mediaRecorder.start();
        this.isRecording = true;

        // Live analyser for waveform visualization
        this.liveSource = this.audioContext.createMediaStreamSource(this.mediaStream);
        this.liveAnalyser = this.audioContext.createAnalyser();
        this.liveAnalyser.fftSize = 256;
        this.liveSource.connect(this.liveAnalyser);
    }

    async stopRecording() {
        if (!this.isRecording) return null;

        return new Promise((resolve, reject) => {
            this.mediaRecorder.onstop = async () => {
                try {
                    const blob = new Blob(this.recordedChunks, { type: this.mediaRecorder.mimeType });
                    const arrayBuffer = await blob.arrayBuffer();
                    this.recordedBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

                    // Cleanup
                    if (this.liveSource) this.liveSource.disconnect();
                    this.mediaStream.getTracks().forEach(t => t.stop());
                    this.liveSource = null;
                    this.liveAnalyser = null;
                    this.isRecording = false;

                    resolve(this.recordedBuffer);
                } catch (err) {
                    this.isRecording = false;
                    reject(err);
                }
            };
            this.mediaRecorder.stop();
        });
    }

    /**
     * Extract audio features from an AudioBuffer using Meyda.
     * Returns aggregated feature statistics across all active frames.
     */
    extractFeatures(audioBuffer) {
        const channelData = audioBuffer.getChannelData(0);
        const sampleRate = audioBuffer.sampleRate;
        const bufferSize = 512;
        const hopSize = 256;

        Meyda.sampleRate = sampleRate;
        Meyda.bufferSize = bufferSize;
        Meyda.windowingFunction = 'hanning';
        Meyda.numberOfMFCCCoefficients = 13;

        const featureNames = ['mfcc', 'spectralCentroid', 'spectralFlatness', 'zcr', 'rms'];
        const frames = [];

        for (let i = 0; i + bufferSize <= channelData.length; i += hopSize) {
            const frame = channelData.slice(i, i + bufferSize);

            // Skip near-silent frames
            let energy = 0;
            for (let j = 0; j < frame.length; j++) energy += frame[j] * frame[j];
            if (energy / frame.length < 0.00005) continue;

            try {
                const features = Meyda.extract(featureNames, frame);
                if (features && features.mfcc && !features.mfcc.some(v => isNaN(v))) {
                    frames.push(features);
                }
            } catch (e) {
                // Skip frames that Meyda can't process
            }
        }

        if (frames.length === 0) return null;

        const numMfcc = frames[0].mfcc.length;
        const result = {
            mfccMean: new Array(numMfcc).fill(0),
            spectralCentroidMean: 0,
            spectralFlatnessMean: 0,
            zcrMean: 0,
            rmsMean: 0,
            frameCount: frames.length,
            // Per-frame data for visualization
            mfccFrames: frames.map(f => [...f.mfcc]),
            rmsFrames: frames.map(f => f.rms),
            spectralCentroidFrames: frames.map(f => f.spectralCentroid),
        };

        // Compute means
        for (const f of frames) {
            for (let i = 0; i < numMfcc; i++) result.mfccMean[i] += f.mfcc[i];
            result.spectralCentroidMean += f.spectralCentroid || 0;
            result.spectralFlatnessMean += f.spectralFlatness || 0;
            result.zcrMean += f.zcr || 0;
            result.rmsMean += f.rms || 0;
        }

        const n = frames.length;
        for (let i = 0; i < numMfcc; i++) result.mfccMean[i] /= n;
        result.spectralCentroidMean /= n;
        result.spectralFlatnessMean /= n;
        result.zcrMean /= n;
        result.rmsMean /= n;

        return result;
    }

    /**
     * Compare two feature sets and return a similarity score [0, 1].
     */
    compareSounds(featA, featB) {
        if (!featA || !featB) return 0;

        // MFCC cosine similarity — primary measure (weight: 0.55)
        const mfccSim = this.cosineSimilarity(featA.mfccMean, featB.mfccMean);

        // Spectral centroid — bright vs dark (weight: 0.15)
        const maxCentroid = Math.max(featA.spectralCentroidMean, featB.spectralCentroidMean, 0.001);
        const centroidSim = 1 - Math.abs(featA.spectralCentroidMean - featB.spectralCentroidMean) / maxCentroid;

        // Spectral flatness — noisy vs tonal (weight: 0.12)
        const flatnessSim = 1 - Math.abs(featA.spectralFlatnessMean - featB.spectralFlatnessMean);

        // Zero crossing rate (weight: 0.10)
        const maxZcr = Math.max(featA.zcrMean, featB.zcrMean, 0.001);
        const zcrSim = 1 - Math.abs(featA.zcrMean - featB.zcrMean) / maxZcr;

        // RMS energy — volume envelope (weight: 0.08)
        const maxRms = Math.max(featA.rmsMean, featB.rmsMean, 0.001);
        const rmsSim = 1 - Math.abs(featA.rmsMean - featB.rmsMean) / maxRms;

        const score = mfccSim * 0.55 +
                      Math.max(0, centroidSim) * 0.15 +
                      Math.max(0, flatnessSim) * 0.12 +
                      Math.max(0, zcrSim) * 0.10 +
                      Math.max(0, rmsSim) * 0.08;

        return Math.max(0, Math.min(1, score));
    }

    /**
     * Compute per-feature breakdown for detailed visual feedback.
     */
    featureBreakdown(featA, featB) {
        if (!featA || !featB) return null;

        const maxCentroid = Math.max(featA.spectralCentroidMean, featB.spectralCentroidMean, 0.001);
        const maxZcr = Math.max(featA.zcrMean, featB.zcrMean, 0.001);
        const maxRms = Math.max(featA.rmsMean, featB.rmsMean, 0.001);

        return {
            timbre: this.cosineSimilarity(featA.mfccMean, featB.mfccMean),
            brightness: Math.max(0, 1 - Math.abs(featA.spectralCentroidMean - featB.spectralCentroidMean) / maxCentroid),
            tonality: Math.max(0, 1 - Math.abs(featA.spectralFlatnessMean - featB.spectralFlatnessMean)),
            texture: Math.max(0, 1 - Math.abs(featA.zcrMean - featB.zcrMean) / maxZcr),
            energy: Math.max(0, 1 - Math.abs(featA.rmsMean - featB.rmsMean) / maxRms),
        };
    }

    cosineSimilarity(a, b) {
        let dot = 0, magA = 0, magB = 0;
        for (let i = 0; i < a.length; i++) {
            dot += a[i] * b[i];
            magA += a[i] * a[i];
            magB += b[i] * b[i];
        }
        magA = Math.sqrt(magA);
        magB = Math.sqrt(magB);
        if (magA === 0 || magB === 0) return 0;
        return (dot / (magA * magB) + 1) / 2; // Map [-1, 1] to [0, 1]
    }

    getLiveFrequencyData() {
        if (!this.liveAnalyser) return null;
        const data = new Uint8Array(this.liveAnalyser.frequencyBinCount);
        this.liveAnalyser.getByteFrequencyData(data);
        return data;
    }
}
