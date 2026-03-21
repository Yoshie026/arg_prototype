/**
 * Procedural sound generator using Web Audio API.
 * Each function returns an AudioBuffer containing a synthetic sound.
 */
class SoundGenerator {
    constructor(audioContext) {
        this.ctx = audioContext;
        this.sampleRate = audioContext.sampleRate;
    }

    /** Create a buffer and fill it with a generator function */
    makeBuffer(duration, fn) {
        const length = Math.floor(this.sampleRate * duration);
        const buffer = this.ctx.createBuffer(1, length, this.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < length; i++) {
            data[i] = fn(i / this.sampleRate, i, length);
        }
        return buffer;
    }

    /** Short burst of filtered noise — like a hand clap */
    clap() {
        return this.makeBuffer(0.3, (t) => {
            const noise = Math.random() * 2 - 1;
            const env = Math.exp(-t * 25);
            // Band-pass feel: attenuate lowest frequencies via differencing
            return noise * env * 0.8;
        });
    }

    /** Sine with harmonics and exponential decay — bell/chime */
    bell() {
        return this.makeBuffer(1.5, (t) => {
            const env = Math.exp(-t * 3);
            return (
                Math.sin(2 * Math.PI * 880 * t) * 0.5 +
                Math.sin(2 * Math.PI * 1568 * t) * 0.25 +
                Math.sin(2 * Math.PI * 2640 * t) * 0.15 +
                Math.sin(2 * Math.PI * 3520 * t) * 0.1
            ) * env * 0.6;
        });
    }

    /** Steady sine tone — like a whistle */
    whistle() {
        const freq = 1200 + Math.random() * 600;
        return this.makeBuffer(0.8, (t) => {
            const env = Math.sin(Math.PI * t / 0.8); // fade in/out
            const vibrato = Math.sin(2 * Math.PI * 5 * t) * 15;
            return Math.sin(2 * Math.PI * (freq + vibrato) * t) * env * 0.5;
        });
    }

    /** Low-frequency thump with quick decay — door knock */
    knock() {
        return this.makeBuffer(0.2, (t) => {
            const env = Math.exp(-t * 35);
            const freq = 120 * Math.exp(-t * 15); // pitch drops
            return Math.sin(2 * Math.PI * freq * t) * env * 0.9;
        });
    }

    /** Sawtooth-ish wave — buzzing insect */
    buzz() {
        const freq = 150 + Math.random() * 80;
        return this.makeBuffer(0.7, (t, i, len) => {
            const env = Math.min(1, t * 20) * Math.min(1, (len - i) / (0.05 * len));
            const saw = 2 * ((t * freq) % 1) - 1;
            return saw * env * 0.3;
        });
    }

    /** Rising frequency sweep — bird chirp */
    chirp() {
        return this.makeBuffer(0.35, (t) => {
            const env = Math.sin(Math.PI * t / 0.35);
            const freq = 1500 + 3000 * (t / 0.35);
            return Math.sin(2 * Math.PI * freq * t) * env * 0.5;
        });
    }

    /** Very short sine pulse — pop */
    pop() {
        return this.makeBuffer(0.08, (t) => {
            const env = Math.exp(-t * 60);
            return Math.sin(2 * Math.PI * 400 * t) * env * 0.9;
        });
    }

    /** Sine drop with noise layer — snare-like drum */
    drum() {
        return this.makeBuffer(0.4, (t) => {
            const toneEnv = Math.exp(-t * 20);
            const noiseEnv = Math.exp(-t * 12);
            const tone = Math.sin(2 * Math.PI * 150 * Math.exp(-t * 8) * t) * toneEnv;
            const noise = (Math.random() * 2 - 1) * noiseEnv * 0.4;
            return (tone * 0.7 + noise) * 0.8;
        });
    }

    /** Low continuous tone — hum */
    hum() {
        return this.makeBuffer(1.0, (t, i, len) => {
            const env = Math.min(1, t * 10) * Math.min(1, (len - i) / (0.1 * len));
            return (
                Math.sin(2 * Math.PI * 120 * t) * 0.6 +
                Math.sin(2 * Math.PI * 240 * t) * 0.25 +
                Math.sin(2 * Math.PI * 360 * t) * 0.1
            ) * env * 0.4;
        });
    }

    /** Metallic crash — noise with resonant filter feel */
    crash() {
        return this.makeBuffer(0.6, (t) => {
            const env = Math.exp(-t * 6);
            const noise = Math.random() * 2 - 1;
            const ring = Math.sin(2 * Math.PI * 3200 * t) * 0.3 +
                         Math.sin(2 * Math.PI * 5100 * t) * 0.2 +
                         Math.sin(2 * Math.PI * 7400 * t) * 0.1;
            return (noise * 0.4 + ring) * env * 0.6;
        });
    }

    /** Scratchy texture — vinyl crackle */
    scratch() {
        return this.makeBuffer(0.5, (t, i, len) => {
            const env = Math.min(1, t * 15) * Math.min(1, (len - i) / (0.08 * len));
            // Sparse random clicks
            const click = Math.random() < 0.03 ? (Math.random() * 2 - 1) * 0.8 : 0;
            const hiss = (Math.random() * 2 - 1) * 0.1;
            return (click + hiss) * env;
        });
    }

    /** Bouncing ball — series of quickening thumps */
    bounce() {
        return this.makeBuffer(1.2, (t) => {
            let val = 0;
            let hitTime = 0;
            let gap = 0.3;
            for (let hit = 0; hit < 8; hit++) {
                const dt = t - hitTime;
                if (dt >= 0 && dt < 0.08) {
                    const amp = Math.pow(0.7, hit);
                    val += Math.sin(2 * Math.PI * 200 * dt) * Math.exp(-dt * 50) * amp;
                }
                hitTime += gap;
                gap *= 0.65;
            }
            return val * 0.8;
        });
    }
}

/** Catalog of available sounds with display metadata */
const SOUND_CATALOG = [
    { id: 'clap',    name: 'Hand Clap',     hint: 'A short, sharp slap', method: 'clap' },
    { id: 'bell',    name: 'Bell',          hint: 'A ringing chime',     method: 'bell' },
    { id: 'whistle', name: 'Whistle',       hint: 'A steady, high tone', method: 'whistle' },
    { id: 'knock',   name: 'Knock',         hint: 'A dull thump',        method: 'knock' },
    { id: 'buzz',    name: 'Buzz',          hint: 'A low droning hum',   method: 'buzz' },
    { id: 'chirp',   name: 'Chirp',         hint: 'A quick rising call', method: 'chirp' },
    { id: 'pop',     name: 'Pop',           hint: 'A tiny burst',        method: 'pop' },
    { id: 'drum',    name: 'Drum Hit',      hint: 'A punchy thwack',     method: 'drum' },
    { id: 'hum',     name: 'Hum',           hint: 'A low, warm drone',   method: 'hum' },
    { id: 'crash',   name: 'Crash',         hint: 'A metallic smash',    method: 'crash' },
    { id: 'scratch', name: 'Scratch',       hint: 'Crackly texture',     method: 'scratch' },
    { id: 'bounce',  name: 'Bouncing Ball', hint: 'Quickening thumps',   method: 'bounce' },
];
