// Audio classification via OpenRouter (Gemini 2.5 Flash).
// Records audio from the mic → encodes as WAV → sends to the LLM for
// natural-language sound identification.  Far more accurate than a
// fixed-category classifier like YAMNet.
//
// In production the request is proxied through /api/classify (Netlify Function)
// so the API key stays server-side. In local dev it calls OpenRouter directly
// using the VITE_OPENROUTER_KEY env var.

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'google/gemini-2.5-flash';

const IS_DEV = import.meta.env.DEV;
const DEV_KEY = import.meta.env.VITE_OPENROUTER_KEY;

// ── Init: validate that we can make API calls ───────────────────────

export function init() {
  if (IS_DEV && !DEV_KEY) {
    throw new Error(
      'Missing VITE_OPENROUTER_KEY — add it to your .env file.',
    );
  }
}

// ── Record audio from the microphone ────────────────────────────────
// Returns a base64-encoded WAV string (16 kHz mono 16-bit PCM).

export async function recordAudio(durationMs = 4000) {
  const TARGET_RATE = 16000;

  let audioCtx;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: TARGET_RATE,
    });
  } catch {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  const actualRate = audioCtx.sampleRate;

  // Modern browsers start AudioContexts suspended — must resume within a
  // user-gesture callback or onaudioprocess fires with zero-filled buffers.
  if (audioCtx.state === 'suspended') await audioCtx.resume();

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const source = audioCtx.createMediaStreamSource(stream);

  // ScriptProcessor collects raw PCM chunks.
  const processor = audioCtx.createScriptProcessor(4096, 1, 1);
  const chunks = [];

  // Pipe through a zero-gain node so the graph stays connected but
  // we don't play the mic input back through the speakers.
  const gain = audioCtx.createGain();
  gain.gain.value = 0;
  source.connect(processor);
  processor.connect(gain);
  gain.connect(audioCtx.destination);

  processor.onaudioprocess = (e) => {
    chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
    e.outputBuffer.getChannelData(0).fill(0);
  };

  await new Promise((r) => setTimeout(r, durationMs));

  // Tear down
  processor.disconnect();
  source.disconnect();
  stream.getTracks().forEach((t) => t.stop());
  await audioCtx.close().catch(() => {});

  // Concatenate all chunks
  const totalLen = chunks.reduce((n, c) => n + c.length, 0);
  let samples = new Float32Array(totalLen);
  let off = 0;
  for (const c of chunks) {
    samples.set(c, off);
    off += c.length;
  }

  // Resample to 16 kHz if the AudioContext ran at a different rate
  if (actualRate !== TARGET_RATE) {
    samples = resample(samples, actualRate, TARGET_RATE);
  }

  // Reject silence before wasting an API call.
  const rms = Math.sqrt(samples.reduce((sum, s) => sum + s * s, 0) / samples.length);
  if (rms < 0.005) {
    return { silent: true, base64: null };
  }

  return { silent: false, base64: arrayBufferToBase64(encodeWAV(samples, TARGET_RATE)) };
}

// ── Send audio to OpenRouter for classification ─────────────────────

export async function classifyAudio(wavBase64, targetName, matchHint) {
  // Single call — the model needs the audio AND the target together to use
  // timbral/tonal cues for discrimination. Confirmation bias is counteracted
  // by adversarial framing: the model's job is to REJECT, not confirm.
  const prompt = [
    'You are a strict audio verification system. Your job is to REJECT false matches.',
    'Users will try to trick you with similar-sounding substitutes. Be skeptical.',
    '',
    'Step 1: List every distinct sound you hear. Be as specific as possible',
    '(e.g. "violin" not "music", "dog bark" not "animal sound").',
    '',
    `Step 2: The target sound is "${targetName}"` +
      (matchHint ? ` (described as: ${matchHint})` : '') + '.',
    'Does any sound you identified in Step 1 SPECIFICALLY match this target?',
    '',
    'Rules:',
    '- If you heard a DIFFERENT specific sound in the same category, that is NOT a match.',
    '  (e.g. guitar ≠ violin, dog ≠ cat, clapping ≠ knocking)',
    '- If your identification is vague or uncertain, that is NOT a match.',
    '- Ambient noise, background hum, or silence is NEVER a match.',
    '- Only return match:true if you are confident the EXACT target sound is present.',
    '',
    'Reply with ONLY valid JSON (no markdown fences):',
    '{"heard": ["sound1", "sound2"], "match": true or false, "confidence": 0.0 to 1.0}',
  ].join('\n');

  const requestBody = {
    model: MODEL,
    max_tokens: 200,
    temperature: 0,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          {
            type: 'input_audio',
            input_audio: { data: wavBase64, format: 'wav' },
          },
        ],
      },
    ],
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  let response;
  try {
    if (IS_DEV) {
      // Local dev: call OpenRouter directly with the dev key
      response = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${DEV_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://sound-bingo.app',
          'X-Title': 'Sound Bingo',
        },
        signal: controller.signal,
        body: JSON.stringify(requestBody),
      });
    } else {
      // Production: proxy through Netlify Function (key stays server-side)
      response = await fetch('/api/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify(requestBody),
      });
    }
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError')
      throw new Error('Analysis timed out — please try again.');
    throw err;
  }

  clearTimeout(timeout);

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(
      body?.error?.message || `OpenRouter error ${response.status}`,
    );
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content ?? '';
  return parseResult(content);
}

// ── Parse the LLM's JSON response ────────────────────────────────────

const CONFIDENCE_THRESHOLD = 0.75;

function parseResult(content) {
  console.log('[sound-bingo] raw LLM response:', content);

  const jsonMatch = content.match(/\{[\s\S]*?\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      const confidence = Number(parsed.confidence) || 0;
      const match = !!parsed.match && confidence >= CONFIDENCE_THRESHOLD;
      console.log('[sound-bingo] parsed:', { match: parsed.match, confidence, threshold: CONFIDENCE_THRESHOLD, finalMatch: match });
      return {
        match,
        heard: Array.isArray(parsed.heard) ? parsed.heard : [],
      };
    } catch {
      /* fall through */
    }
  }
  console.log('[sound-bingo] failed to parse JSON, defaulting to no match');
  return { match: false, heard: [] };
}

// ── WAV encoder (16-bit PCM mono) ───────────────────────────────────

function encodeWAV(samples, sampleRate) {
  const dataBytes = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const v = new DataView(buffer);

  writeStr(v, 0, 'RIFF');
  v.setUint32(4, 36 + dataBytes, true);
  writeStr(v, 8, 'WAVE');
  writeStr(v, 12, 'fmt ');
  v.setUint32(16, 16, true);           // PCM chunk size
  v.setUint16(20, 1, true);            // PCM format
  v.setUint16(22, 1, true);            // mono
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true); // byte rate
  v.setUint16(32, 2, true);            // block align
  v.setUint16(34, 16, true);           // bits per sample
  writeStr(v, 36, 'data');
  v.setUint32(40, dataBytes, true);

  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return buffer;
}

function writeStr(view, offset, str) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

// ── Helpers ─────────────────────────────────────────────────────────

function resample(data, fromRate, toRate) {
  if (fromRate === toRate) return data;
  const ratio = fromRate / toRate;
  const len = Math.round(data.length / ratio);
  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const src = i * ratio;
    const lo = Math.floor(src);
    const frac = src - lo;
    out[i] = data[lo] * (1 - frac) + (data[lo + 1] ?? 0) * frac;
  }
  return out;
}

function arrayBufferToBase64(buf) {
  const bytes = new Uint8Array(buf);
  const parts = [];
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    parts.push(String.fromCharCode.apply(null, bytes.subarray(i, i + chunk)));
  }
  return btoa(parts.join(''));
}
