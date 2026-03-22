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
        this.lastRecordingBlob = null;
    }

    async init() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
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
        if (this.audioContext.state === 'suspended') await this.audioContext.resume();
        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(this.audioContext.destination);
        source.start();
        return new Promise(resolve => { source.onended = resolve; });
    }

    playTarget() { if (this.targetBuffer) return this.playBuffer(this.targetBuffer); }
    playRecorded() { if (this.recordedBuffer) return this.playBuffer(this.recordedBuffer); }

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
                    this.lastRecordingBlob = blob;
                    const arrayBuffer = await blob.arrayBuffer();
                    this.recordedBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
                    if (this.liveSource) this.liveSource.disconnect();
                    this.mediaStream.getTracks().forEach(t => t.stop());
                    this.liveSource = null;
                    this.liveAnalyser = null;
                    this.isRecording = false;
                    resolve(this.recordedBuffer);
                } catch (err) { this.isRecording = false; reject(err); }
            };
            this.mediaRecorder.stop();
        });
    }

    getLiveFrequencyData() {
        if (!this.liveAnalyser) return null;
        const data = new Uint8Array(this.liveAnalyser.frequencyBinCount);
        this.liveAnalyser.getByteFrequencyData(data);
        return data;
    }

    // ================================================================
    //  SIGNAL PROCESSING — noise removal pipeline
    // ================================================================

    /**
     * Second-order Butterworth high-pass filter (IIR).
     * Removes low-frequency room noise (AC hum, rumble, traffic).
     */
    highPassFilter(samples, cutoff, sampleRate) {
        const w0 = 2 * Math.PI * cutoff / sampleRate;
        const cosw = Math.cos(w0);
        const alpha = Math.sin(w0) / (2 * 0.7071); // Q = 0.7071 (Butterworth)

        const b0 = (1 + cosw) / 2 / (1 + alpha);
        const b1 = -(1 + cosw) / (1 + alpha);
        const b2 = (1 + cosw) / 2 / (1 + alpha);
        const a1 = (-2 * cosw) / (1 + alpha);
        const a2 = (1 - alpha) / (1 + alpha);

        const out = new Float32Array(samples.length);
        let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
        for (let i = 0; i < samples.length; i++) {
            const x0 = samples[i];
            out[i] = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
            x2 = x1; x1 = x0;
            y2 = y1; y1 = out[i];
        }
        return out;
    }

    /**
     * In-place Cooley-Tukey radix-2 FFT.
     * re/im are Float64Arrays of length N (must be power of 2).
     * Set inverse=true for IFFT.
     */
    fft(re, im, inverse) {
        const n = re.length;
        // Bit-reversal permutation
        for (let i = 1, j = 0; i < n; i++) {
            let bit = n >> 1;
            for (; j & bit; bit >>= 1) j ^= bit;
            j ^= bit;
            if (i < j) {
                [re[i], re[j]] = [re[j], re[i]];
                [im[i], im[j]] = [im[j], im[i]];
            }
        }
        // Butterfly stages
        const dir = inverse ? 1 : -1;
        for (let len = 2; len <= n; len *= 2) {
            const half = len / 2;
            const angle = dir * 2 * Math.PI / len;
            const wRe = Math.cos(angle);
            const wIm = Math.sin(angle);
            for (let i = 0; i < n; i += len) {
                let curRe = 1, curIm = 0;
                for (let j = 0; j < half; j++) {
                    const tRe = curRe * re[i + j + half] - curIm * im[i + j + half];
                    const tIm = curRe * im[i + j + half] + curIm * re[i + j + half];
                    re[i + j + half] = re[i + j] - tRe;
                    im[i + j + half] = im[i + j] - tIm;
                    re[i + j] += tRe;
                    im[i + j] += tIm;
                    const nRe = curRe * wRe - curIm * wIm;
                    curIm = curRe * wIm + curIm * wRe;
                    curRe = nRe;
                }
            }
        }
        if (inverse) {
            for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
        }
    }

    /**
     * Spectral subtraction — estimates the noise floor from the quietest
     * portions of the recording and subtracts it from every frame.
     *
     * Uses overlap-add reconstruction with a Hanning window.
     * Alpha (oversubtraction factor) controls aggressiveness.
     * Beta (spectral floor) prevents musical noise artifacts.
     */
    spectralSubtract(samples, sampleRate, fftSize = 512, alpha = 2.0, beta = 0.02) {
        const hopSize = fftSize / 2;
        const numFrames = Math.floor((samples.length - fftSize) / hopSize) + 1;
        if (numFrames < 2) return samples;

        // Build Hanning window
        const win = new Float64Array(fftSize);
        for (let i = 0; i < fftSize; i++)
            win[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (fftSize - 1)));

        // Step 1: compute magnitude spectra for all frames
        const magnitudes = [];
        const phases = [];
        const frameEnergies = [];

        for (let f = 0; f < numFrames; f++) {
            const offset = f * hopSize;
            const re = new Float64Array(fftSize);
            const im = new Float64Array(fftSize);
            for (let i = 0; i < fftSize; i++) re[i] = (samples[offset + i] || 0) * win[i];

            this.fft(re, im, false);

            const mag = new Float64Array(fftSize);
            const phase = new Float64Array(fftSize);
            let energy = 0;
            for (let i = 0; i < fftSize; i++) {
                mag[i] = Math.sqrt(re[i] * re[i] + im[i] * im[i]);
                phase[i] = Math.atan2(im[i], re[i]);
                energy += mag[i] * mag[i];
            }
            magnitudes.push(mag);
            phases.push(phase);
            frameEnergies.push(energy);
        }

        // Step 2: estimate noise floor from quietest 15% of frames
        const sorted = frameEnergies.map((e, i) => ({ e, i })).sort((a, b) => a.e - b.e);
        const noiseCount = Math.max(1, Math.floor(numFrames * 0.15));
        const noiseMag = new Float64Array(fftSize);
        for (let n = 0; n < noiseCount; n++) {
            const mag = magnitudes[sorted[n].i];
            for (let i = 0; i < fftSize; i++) noiseMag[i] += mag[i];
        }
        for (let i = 0; i < fftSize; i++) noiseMag[i] /= noiseCount;

        // Step 3: subtract noise and reconstruct via overlap-add
        const output = new Float32Array(samples.length);
        const windowSum = new Float32Array(samples.length);

        for (let f = 0; f < numFrames; f++) {
            const offset = f * hopSize;
            const mag = magnitudes[f];
            const phase = phases[f];
            const re = new Float64Array(fftSize);
            const im = new Float64Array(fftSize);

            for (let i = 0; i < fftSize; i++) {
                // Subtract with spectral floor
                const cleanMag = Math.max(beta * noiseMag[i], mag[i] - alpha * noiseMag[i]);
                re[i] = cleanMag * Math.cos(phase[i]);
                im[i] = cleanMag * Math.sin(phase[i]);
            }

            this.fft(re, im, true); // IFFT

            for (let i = 0; i < fftSize; i++) {
                output[offset + i] += re[i] * win[i];
                windowSum[offset + i] += win[i] * win[i];
            }
        }

        // Normalize by window overlap
        for (let i = 0; i < output.length; i++) {
            if (windowSum[i] > 1e-8) output[i] /= windowSum[i];
        }

        return output;
    }

    /**
     * Full denoising pipeline:
     *  1. High-pass filter (80 Hz) — removes room rumble
     *  2. Spectral subtraction — removes steady-state ambient noise
     */
    denoise(channelData, sampleRate) {
        // Step 1: high-pass filter at 80 Hz
        let cleaned = this.highPassFilter(channelData, 80, sampleRate);

        // Step 2: spectral subtraction
        cleaned = this.spectralSubtract(cleaned, sampleRate);

        return cleaned;
    }

    // ================================================================
    //  FEATURE EXTRACTION
    // ================================================================

    /** Trim leading/trailing silence using adaptive RMS threshold. */
    trimSilence(channelData) {
        // Compute overall RMS to set adaptive threshold
        let totalRms = 0;
        for (let i = 0; i < channelData.length; i++) totalRms += channelData[i] ** 2;
        totalRms = Math.sqrt(totalRms / channelData.length);
        const threshold = Math.max(0.005, totalRms * 0.15);

        const winSize = 256;
        let start = 0, end = channelData.length - 1;

        for (let i = 0; i + winSize <= channelData.length; i += winSize) {
            let rms = 0;
            for (let j = 0; j < winSize; j++) rms += channelData[i + j] ** 2;
            if (Math.sqrt(rms / winSize) > threshold) {
                start = Math.max(0, i - winSize);
                break;
            }
        }
        for (let i = channelData.length - winSize; i >= 0; i -= winSize) {
            let rms = 0;
            for (let j = 0; j < winSize; j++) rms += channelData[i + j] ** 2;
            if (Math.sqrt(rms / winSize) > threshold) {
                end = Math.min(channelData.length - 1, i + 2 * winSize);
                break;
            }
        }

        return start < end ? channelData.slice(start, end + 1) : channelData;
    }

    /** Z-score normalize each dimension across all frames. */
    zNormalize(frames) {
        if (frames.length === 0) return frames;
        const dim = frames[0].length;
        const means = new Float64Array(dim);
        const stds = new Float64Array(dim);

        for (const f of frames)
            for (let i = 0; i < dim; i++) means[i] += f[i];
        for (let i = 0; i < dim; i++) means[i] /= frames.length;

        for (const f of frames)
            for (let i = 0; i < dim; i++) stds[i] += (f[i] - means[i]) ** 2;
        for (let i = 0; i < dim; i++) stds[i] = Math.sqrt(stds[i] / frames.length) || 1;

        return frames.map(f => f.map((v, i) => (v - means[i]) / stds[i]));
    }

    /** First-order delta (velocity) of a feature sequence. */
    computeDeltas(frames) {
        return frames.map((_, i) => {
            const prev = frames[Math.max(0, i - 1)];
            const next = frames[Math.min(frames.length - 1, i + 1)];
            return next.map((v, j) => (v - prev[j]) / 2);
        });
    }

    /** Smooth an array with a moving average. */
    smooth(arr, windowSize) {
        const half = Math.floor(windowSize / 2);
        return arr.map((_, i) => {
            let sum = 0, count = 0;
            for (let j = Math.max(0, i - half); j <= Math.min(arr.length - 1, i + half); j++) {
                sum += arr[j]; count++;
            }
            return sum / count;
        });
    }

    /**
     * Detect the most prominent sound event in a set of features.
     * Uses a combined activity signal: RMS energy + MFCC flux (spectral change).
     * Returns { start, end } frame indices.
     */
    detectMainEvent(rmsFrames, mfccFrames) {
        const n = rmsFrames.length;
        if (n < 3) return { start: 0, end: n - 1 };

        // MFCC flux — frame-to-frame spectral change (onset detector)
        const flux = [0];
        for (let i = 1; i < n; i++) {
            let d = 0;
            for (let j = 0; j < mfccFrames[i].length; j++)
                d += (mfccFrames[i][j] - mfccFrames[i - 1][j]) ** 2;
            flux.push(Math.sqrt(d));
        }

        // Normalize both to [0, 1]
        const rmsMax = Math.max(...rmsFrames, 0.001);
        const fluxMax = Math.max(...flux, 0.001);

        // Combined activity: weighted mix of energy + spectral change
        const activity = rmsFrames.map((r, i) =>
            (r / rmsMax) * 0.6 + (flux[i] / fluxMax) * 0.4
        );

        // Smooth to avoid jitter
        const smoothed = this.smooth(activity, 7);

        // Find the peak
        let peakIdx = 0, peakVal = 0;
        for (let i = 0; i < smoothed.length; i++) {
            if (smoothed[i] > peakVal) { peakVal = smoothed[i]; peakIdx = i; }
        }

        // Expand outward from peak until activity drops below 15% of peak
        const threshold = peakVal * 0.15;
        let start = peakIdx, end = peakIdx;
        while (start > 0 && smoothed[start - 1] > threshold) start--;
        while (end < n - 1 && smoothed[end + 1] > threshold) end++;

        // Ensure a minimum event length (~10% of total or 5 frames)
        const minLen = Math.max(5, Math.floor(n * 0.1));
        if (end - start + 1 < minLen) {
            const pad = Math.ceil((minLen - (end - start + 1)) / 2);
            start = Math.max(0, start - pad);
            end = Math.min(n - 1, end + pad);
        }

        return { start, end };
    }

    /** Slice all feature arrays in a features object to [start, end]. */
    sliceFeatures(feat, start, end) {
        const s = (arr) => arr.slice(start, end + 1);
        const slicedMfcc = s(feat.mfccFrames);
        const slicedDelta = this.computeDeltas(slicedMfcc);
        const slicedCombined = slicedMfcc.map((m, i) => [...m, ...slicedDelta[i]]);
        const slicedChroma = s(feat.normalizedChroma.length ? feat.normalizedChroma : feat.mfccFrames.map(() => new Array(12).fill(0)));

        const slicedRaw = {
            rmsFrames: s(feat.rmsFrames),
            spectralCentroidFrames: s(feat.spectralCentroidFrames),
            spectralFlatnessFrames: s(feat.spectralFlatnessFrames),
            zcrFrames: s(feat.zcrFrames),
        };

        return {
            normalizedFrames: this.zNormalize(slicedCombined),
            normalizedChroma: this.zNormalize(slicedChroma),
            mfccFrames: slicedMfcc,
            ...slicedRaw,
            spectralRolloffFrames: s(feat.spectralRolloffFrames),
            frameCount: end - start + 1,
            spectralFlatnessMean: slicedRaw.spectralFlatnessFrames.reduce((a, b) => a + b, 0) / (end - start + 1),
            zcrMean: slicedRaw.zcrFrames.reduce((a, b) => a + b, 0) / (end - start + 1),
        };
    }

    /**
     * Full feature extraction pipeline:
     *  1. Denoise (high-pass + spectral subtraction)
     *  2. Trim silence (adaptive threshold)
     *  3. Extract Meyda features per frame (adaptive energy gate)
     *  4. Detect main sound event
     *  5. Build MFCC + delta vectors, z-normalize
     */
    extractFeatures(audioBuffer) {
        const sampleRate = audioBuffer.sampleRate;
        let channelData = audioBuffer.getChannelData(0);

        channelData = this.denoise(channelData, sampleRate);
        channelData = this.trimSilence(channelData);

        const bufferSize = 512;
        const hopSize = 256;

        Meyda.sampleRate = sampleRate;
        Meyda.bufferSize = bufferSize;
        Meyda.windowingFunction = 'hanning';
        Meyda.numberOfMFCCCoefficients = 13;

        const featureNames = [
            'mfcc', 'spectralCentroid', 'spectralFlatness',
            'spectralRolloff', 'zcr', 'rms', 'chroma',
        ];

        // Adaptive energy gate
        const frameEnergies = [];
        for (let i = 0; i + bufferSize <= channelData.length; i += hopSize) {
            let e = 0;
            for (let j = 0; j < bufferSize; j++) e += channelData[i + j] ** 2;
            frameEnergies.push(e / bufferSize);
        }
        const sortedEnergies = [...frameEnergies].sort((a, b) => a - b);
        const noiseFloorEnergy = sortedEnergies[Math.floor(sortedEnergies.length * 0.1)] || 0;
        const energyGate = Math.max(0.00003, noiseFloorEnergy * 3);

        const rawFrames = [];

        for (let i = 0; i + bufferSize <= channelData.length; i += hopSize) {
            const frame = channelData.slice(i, i + bufferSize);
            let energy = 0;
            for (let j = 0; j < bufferSize; j++) energy += frame[j] ** 2;
            if (energy / bufferSize < energyGate) continue;

            try {
                const f = Meyda.extract(featureNames, frame);
                if (f && f.mfcc && !f.mfcc.some(v => isNaN(v))) {
                    rawFrames.push(f);
                }
            } catch (e) { /* skip */ }
        }

        if (rawFrames.length === 0) return null;

        const mfccFrames = rawFrames.map(f => [...f.mfcc]);
        const deltaFrames = this.computeDeltas(mfccFrames);
        const combinedRaw = mfccFrames.map((m, i) => [...m, ...deltaFrames[i]]);
        const normalizedFrames = this.zNormalize(combinedRaw);

        const chromaFrames = rawFrames.map(f =>
            f.chroma ? [...f.chroma] : new Array(12).fill(0));
        const normalizedChroma = this.zNormalize(chromaFrames);

        const rmsFrames = rawFrames.map(f => f.rms);

        // Detect main event
        const mainEvent = this.detectMainEvent(rmsFrames, mfccFrames);

        const features = {
            normalizedFrames,
            normalizedChroma,
            mfccFrames,
            rmsFrames,
            spectralCentroidFrames: rawFrames.map(f => f.spectralCentroid),
            spectralFlatnessFrames: rawFrames.map(f => f.spectralFlatness || 0),
            spectralRolloffFrames:  rawFrames.map(f => f.spectralRolloff || 0),
            zcrFrames:              rawFrames.map(f => f.zcr || 0),
            frameCount: rawFrames.length,
            spectralFlatnessMean: rawFrames.reduce((s, f) => s + (f.spectralFlatness || 0), 0) / rawFrames.length,
            zcrMean:              rawFrames.reduce((s, f) => s + (f.zcr || 0), 0) / rawFrames.length,
            mainEvent, // { start, end } frame indices
        };

        return features;
    }

    /**
     * Get denoised audio samples for just the main event.
     * Used to feed clean audio to CLAP for embedding.
     */
    getCleanEventSamples(audioBuffer) {
        const sampleRate = audioBuffer.sampleRate;
        let samples = audioBuffer.getChannelData(0);

        // Denoise
        samples = this.denoise(samples, sampleRate);

        // Trim silence
        samples = this.trimSilence(samples);

        // We need the main event boundaries in sample space.
        // Extract features to get the event, then map back to samples.
        const hopSize = 256;
        const bufferSize = 512;

        // Quick RMS + MFCC pass to detect event (reuse logic)
        const rmsFrames = [];
        const mfccFrames = [];
        Meyda.sampleRate = sampleRate;
        Meyda.bufferSize = bufferSize;
        Meyda.windowingFunction = 'hanning';
        Meyda.numberOfMFCCCoefficients = 13;

        for (let i = 0; i + bufferSize <= samples.length; i += hopSize) {
            const frame = samples.slice(i, i + bufferSize);
            let energy = 0;
            for (let j = 0; j < bufferSize; j++) energy += frame[j] ** 2;
            if (energy / bufferSize < 0.00003) {
                rmsFrames.push(0);
                mfccFrames.push(new Array(13).fill(0));
                continue;
            }
            try {
                const f = Meyda.extract(['rms', 'mfcc'], frame);
                rmsFrames.push(f ? f.rms : 0);
                mfccFrames.push(f && f.mfcc ? [...f.mfcc] : new Array(13).fill(0));
            } catch (e) {
                rmsFrames.push(0);
                mfccFrames.push(new Array(13).fill(0));
            }
        }

        const event = this.detectMainEvent(rmsFrames, mfccFrames);

        // Convert frame indices to sample indices
        const startSample = event.start * hopSize;
        const endSample = Math.min(samples.length, (event.end + 1) * hopSize + bufferSize);

        // Ensure minimum length for CLAP (~0.5 seconds)
        const minSamples = Math.floor(sampleRate * 0.5);
        let eventSamples = samples.slice(startSample, endSample);
        if (eventSamples.length < minSamples) {
            // Pad with the surrounding audio or zeros
            const padded = new Float32Array(minSamples);
            const offset = Math.floor((minSamples - eventSamples.length) / 2);
            padded.set(eventSamples, offset);
            eventSamples = padded;
        }

        return eventSamples;
    }

    // ================================================================
    //  DTW ENGINE (kept for potential fallback / Meyda comparison)
    // ================================================================

    euclidean(a, b) {
        let sum = 0;
        for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2;
        return Math.sqrt(sum);
    }

    downsample(frames, maxLen) {
        if (frames.length <= maxLen) return frames;
        const step = frames.length / maxLen;
        const out = [];
        for (let i = 0; i < maxLen; i++) out.push(frames[Math.floor(i * step)]);
        return out;
    }

    /** Standard DTW — end-to-end alignment. */
    dtw(seqA, seqB, distFn) {
        const n = seqA.length, m = seqB.length;
        let prev = new Float64Array(m + 1).fill(Infinity);
        let curr = new Float64Array(m + 1).fill(Infinity);
        prev[0] = 0;
        for (let i = 1; i <= n; i++) {
            curr[0] = Infinity;
            for (let j = 1; j <= m; j++) {
                curr[j] = distFn(seqA[i - 1], seqB[j - 1])
                    + Math.min(prev[j], curr[j - 1], prev[j - 1]);
            }
            [prev, curr] = [curr, prev];
            curr.fill(Infinity);
        }
        return prev[m] / ((n + m) / 2);
    }

    /** Subsequence DTW — finds the pattern anywhere in the sequence. */
    subsequenceDTW(pattern, sequence, distFn) {
        const n = pattern.length, m = sequence.length;
        let prev = new Float64Array(m + 1).fill(0); // free entry
        let curr = new Float64Array(m + 1);
        for (let i = 1; i <= n; i++) {
            curr[0] = Infinity;
            for (let j = 1; j <= m; j++) {
                curr[j] = distFn(pattern[i - 1], sequence[j - 1])
                    + Math.min(prev[j], curr[j - 1], prev[j - 1]);
            }
            [prev, curr] = [curr, prev];
        }
        let minCost = Infinity;
        for (let j = 1; j <= m; j++) if (prev[j] < minCost) minCost = prev[j];
        return minCost / n;
    }

    /** Sliding-window best cosine similarity of mean vectors. */
    slidingWindowMatch(targetFrames, seqFrames, step) {
        const targetMean = this.meanVector(targetFrames);
        const winLen = targetFrames.length;
        step = step || Math.max(1, Math.floor(winLen / 4));
        if (seqFrames.length <= winLen) {
            return this.cosineSim(targetMean, this.meanVector(seqFrames));
        }
        let best = -1;
        for (let i = 0; i <= seqFrames.length - winLen; i += step) {
            const sim = this.cosineSim(targetMean, this.meanVector(seqFrames.slice(i, i + winLen)));
            if (sim > best) best = sim;
        }
        return Math.max(0, best);
    }

    meanVector(frames) {
        const dim = frames[0].length;
        const mean = new Float64Array(dim);
        for (const f of frames) for (let i = 0; i < dim; i++) mean[i] += f[i];
        for (let i = 0; i < dim; i++) mean[i] /= frames.length;
        return mean;
    }

    cosineSim(a, b) {
        let dot = 0, mA = 0, mB = 0;
        for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; mA += a[i] ** 2; mB += b[i] ** 2; }
        mA = Math.sqrt(mA); mB = Math.sqrt(mB);
        if (mA === 0 || mB === 0) return 0;
        return Math.max(0, dot / (mA * mB));
    }

    // ================================================================
    //  COMPARISON
    // ================================================================

    /**
     * Compare the main events from two recordings.
     * Extracts the most prominent sound from each, then compares those.
     */
    compareSounds(featTarget, featRecording) {
        if (!featTarget || !featRecording) return 0;

        // Extract main events from both recordings
        const tEvent = featTarget.mainEvent;
        const rEvent = featRecording.mainEvent;
        const t = this.sliceFeatures(featTarget, tEvent.start, tEvent.end);
        const r = this.sliceFeatures(featRecording, rEvent.start, rEvent.end);

        return this._compareFeatures(t, r);
    }

    /** Internal: compare two (already-sliced) feature sets. */
    _compareFeatures(t, r) {
        const maxFrames = 250;
        const tFrames = this.downsample(t.normalizedFrames, maxFrames);
        const rFrames = this.downsample(r.normalizedFrames, maxFrames);

        // 1) DTW on MFCC+delta — timbre + temporal shape (0.50)
        //    Z-normed 26-d vectors: similar sounds ≈ dist 3-6, different ≈ 8+
        const mfccDist = this.dtw(tFrames, rFrames, (a, b) => this.euclidean(a, b));
        const mfccSim = Math.exp(-mfccDist / 6);

        // 2) Chroma cosine similarity — pitch content (0.15)
        const tChroma = this.downsample(t.normalizedChroma, maxFrames);
        const rChroma = this.downsample(r.normalizedChroma, maxFrames);
        const chromaSim = this.cosineSim(this.meanVector(tChroma), this.meanVector(rChroma));

        // 3) Spectral centroid DTW — brightness contour (0.15)
        const tCent = this.downsample(t.spectralCentroidFrames.map(v => [v]), maxFrames);
        const rCent = this.downsample(r.spectralCentroidFrames.map(v => [v]), maxFrames);
        const centDist = this.dtw(tCent, rCent, (a, b) => Math.abs(a[0] - b[0]));
        const centSim = Math.exp(-centDist / 800);

        // 4) Spectral flatness — noisy vs tonal (0.10)
        const flatDiff = Math.abs(t.spectralFlatnessMean - r.spectralFlatnessMean);
        const flatSim = Math.exp(-flatDiff * 5);

        // 5) ZCR — texture (0.10)
        const maxZcr = Math.max(t.zcrMean, r.zcrMean, 0.001);
        const zcrDiff = Math.abs(t.zcrMean - r.zcrMean) / maxZcr;
        const zcrSim = Math.exp(-zcrDiff * 3);

        return Math.max(0, Math.min(1,
            mfccSim   * 0.50 +
            chromaSim * 0.15 +
            centSim   * 0.15 +
            flatSim   * 0.10 +
            zcrSim    * 0.10
        ));
    }

    featureBreakdown(featTarget, featRecording) {
        if (!featTarget || !featRecording) return null;

        const tEvent = featTarget.mainEvent;
        const rEvent = featRecording.mainEvent;
        const t = this.sliceFeatures(featTarget, tEvent.start, tEvent.end);
        const r = this.sliceFeatures(featRecording, rEvent.start, rEvent.end);

        const maxFrames = 250;
        const tFrames = this.downsample(t.normalizedFrames, maxFrames);
        const rFrames = this.downsample(r.normalizedFrames, maxFrames);

        const mfccDist = this.dtw(tFrames, rFrames, (a, b) => this.euclidean(a, b));

        const tChroma = this.downsample(t.normalizedChroma, maxFrames);
        const rChroma = this.downsample(r.normalizedChroma, maxFrames);

        const tCent = this.downsample(t.spectralCentroidFrames.map(v => [v]), maxFrames);
        const rCent = this.downsample(r.spectralCentroidFrames.map(v => [v]), maxFrames);
        const centDist = this.dtw(tCent, rCent, (a, b) => Math.abs(a[0] - b[0]));

        const flatDiff = Math.abs(t.spectralFlatnessMean - r.spectralFlatnessMean);
        const maxZcr = Math.max(t.zcrMean, r.zcrMean, 0.001);
        const zcrDiff = Math.abs(t.zcrMean - r.zcrMean) / maxZcr;

        return {
            timbre:     Math.exp(-mfccDist / 6),
            pitch:      this.cosineSim(this.meanVector(tChroma), this.meanVector(rChroma)),
            brightness: Math.exp(-centDist / 800),
            tonality:   Math.exp(-flatDiff * 5),
            texture:    Math.exp(-zcrDiff * 3),
        };
    }

    // ================================================================
    //  NETWORK HELPERS — blob export/import for multiplayer
    // ================================================================

    async getRecordingArrayBuffer() {
        if (!this.lastRecordingBlob) return null;
        return this.lastRecordingBlob.arrayBuffer();
    }

    async decodeBlob(arrayBuffer) {
        if (!this.audioContext) await this.init();
        const copy = arrayBuffer instanceof ArrayBuffer
            ? arrayBuffer.slice(0)
            : new Uint8Array(arrayBuffer).buffer;
        return this.audioContext.decodeAudioData(copy);
    }
}
