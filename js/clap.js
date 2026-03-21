/**
 * CLAP (Contrastive Language-Audio Pretraining) embedding engine.
 *
 * Uses the Xenova/clap-htsat-unfused model via Transformers.js to produce
 * 512-dimensional audio embeddings optimized for similarity comparison.
 * The quantized audio-only model is ~33 MB, loaded once and cached by the browser.
 */
import { AutoProcessor, ClapAudioModelWithProjection } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3';

const MODEL_ID = 'Xenova/clap-htsat-unfused';

class ClapEngine {
    constructor() {
        this.processor = null;
        this.model = null;
        this.ready = false;
    }

    /** Load the CLAP model. Call once at startup. */
    async load(onProgress) {
        if (this.ready) return;

        this.processor = await AutoProcessor.from_pretrained(MODEL_ID, {
            progress_callback: onProgress || (() => {}),
        });
        this.model = await ClapAudioModelWithProjection.from_pretrained(MODEL_ID, {
            dtype: 'q8',  // quantized — ~33 MB
            progress_callback: onProgress || (() => {}),
        });

        this.ready = true;
    }

    /**
     * Extract a 512-d embedding from raw audio samples.
     * @param {Float32Array} samples — mono audio samples
     * @param {number} sampleRate — sample rate of the audio
     * @returns {Float32Array} — 512-dimensional embedding vector
     */
    async embed(samples, sampleRate) {
        if (!this.ready) throw new Error('CLAP model not loaded');

        // CLAP expects 48 kHz — resample if needed
        let resampled = samples;
        if (sampleRate !== 48000) {
            resampled = this.resample(samples, sampleRate, 48000);
        }

        const inputs = await this.processor(resampled, {
            sampling_rate: 48000,
        });

        const output = await this.model(inputs);
        // output.audio_embeds is a Tensor of shape [1, 512]
        return new Float32Array(output.audio_embeds.data);
    }

    /**
     * Cosine similarity between two embedding vectors. Returns [0, 1].
     */
    similarity(embedA, embedB) {
        let dot = 0, mA = 0, mB = 0;
        for (let i = 0; i < embedA.length; i++) {
            dot += embedA[i] * embedB[i];
            mA += embedA[i] * embedA[i];
            mB += embedB[i] * embedB[i];
        }
        mA = Math.sqrt(mA);
        mB = Math.sqrt(mB);
        if (mA === 0 || mB === 0) return 0;
        // CLAP cosine sim can range [-1, 1]; clamp to [0, 1]
        return Math.max(0, dot / (mA * mB));
    }

    /**
     * Simple linear resampling.
     */
    resample(samples, fromRate, toRate) {
        if (fromRate === toRate) return samples;
        const ratio = fromRate / toRate;
        const newLen = Math.round(samples.length / ratio);
        const out = new Float32Array(newLen);
        for (let i = 0; i < newLen; i++) {
            const srcIdx = i * ratio;
            const lo = Math.floor(srcIdx);
            const hi = Math.min(lo + 1, samples.length - 1);
            const frac = srcIdx - lo;
            out[i] = samples[lo] * (1 - frac) + samples[hi] * frac;
        }
        return out;
    }
}

// Export as a global singleton so non-module scripts can access it
window.clapEngine = new ClapEngine();
