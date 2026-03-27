import { scribbleSvg } from './scribble.js';
import { SOUND_POOL, generateGrid, GRID_VERSION } from './sounds.js';
import { init as initClassifier, recordAudio, classifyAudio } from './classifier.js';
import './style.css';

// ── State ───────────────────────────────────────────────────────────

const STORAGE_KEY = 'sound-bingo-state';

const state = {
  date: null,
  sounds: [],
  found: Array(9).fill(false),
  listening: -1,
  phase: 'idle',
  countdown: 0,
  micAllowed: false,
  modelReady: false,
  bingo: false,
  lastMiss: null,  // { name, heard }
};

// ── Helpers ─────────────────────────────────────────────────────────

function getToday() {
  return new Date().toISOString().split('T')[0];
}

function formatDate(iso) {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }).toUpperCase();
}

const BINGO_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

function findBingoLine() {
  for (const line of BINGO_LINES) {
    if (line.every((i) => state.found[i])) return line;
  }
  return null;
}

function fitSquareToViewport() {
  const app = document.getElementById('app');
  if (!app) return;

  const square = app.querySelector('.grid-wrapper, .mic-gate');
  if (!square) return;

  square.style.width = '';

  const bodyStyle = getComputedStyle(document.body);
  const bodyPadTop = parseFloat(bodyStyle.paddingTop) || 0;
  const bodyPadBottom = parseFloat(bodyStyle.paddingBottom) || 0;
  const viewportHeight = window.innerHeight;

  const nonSquareHeight = app.scrollHeight - square.offsetHeight;
  const availableHeight = viewportHeight - bodyPadTop - bodyPadBottom - nonSquareHeight - 6;
  const availableWidth = app.clientWidth;
  const maxSquare = square.classList.contains('grid-wrapper') ? 640 : availableWidth;
  const target = Math.floor(Math.min(availableWidth, availableHeight, maxSquare));

  if (target > 0) {
    square.style.width = `${Math.max(140, target)}px`;
  }
}

// ── Emoji progress string ───────────────────────────────────────────

function emojiString() {
  return state.sounds.map((s, i) => state.found[i] ? s.emoji : '\u2013').join('');
}

function shareResult() {
  const text = `NOISE BINGO ${formatDate(state.date)}\n${emojiString()}`;
  if (navigator.share) {
    navigator.share({ text }).catch(() => {});
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => {
      const btn = document.getElementById('shareBtn');
      if (btn) { btn.textContent = 'Copied'; setTimeout(() => { btn.textContent = 'Share'; }, 1500); }
    });
  }
}

// ── Persistence ─────────────────────────────────────────────────────

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved?.date === getToday() && saved?.version === GRID_VERSION) {
      state.date = saved.date;
      state.sounds = saved.sounds.map((id) => SOUND_POOL.find((s) => s.id === id)).filter(Boolean);
      if (state.sounds.length === 9) {
        state.found = saved.found;
        state.bingo = saved.bingo ?? false;
        return;
      }
    }
  } catch { /* ignore */ }

  state.date   = getToday();
  state.sounds = generateGrid(state.date);
  state.found  = Array(9).fill(false);
  state.bingo  = false;
  saveState();
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    date: state.date, version: GRID_VERSION,
    sounds: state.sounds.map((s) => s.id),
    found: state.found, bingo: state.bingo,
  }));
}

// ── Audio chime ─────────────────────────────────────────────────────

function playSuccessChime() {
  try {
    const ctx = new AudioContext();
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.connect(gain);
      osc.start(ctx.currentTime + i * 0.1);
      osc.stop(ctx.currentTime + 0.5);
    });
  } catch { /* ignore */ }
}

// ── Mic permission gate ─────────────────────────────────────────────

async function requestMic() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    state.micAllowed = true;
    render();
  } catch {
    // permission denied — stay on gate screen
  }
}

async function checkMicPermission() {
  try {
    const result = await navigator.permissions.query({ name: 'microphone' });
    if (result.state === 'granted') state.micAllowed = true;
  } catch { /* permissions API not supported, will gate on first use */ }
}

// ── Rendering ───────────────────────────────────────────────────────

function render() {
  const app       = document.getElementById('app');
  const bingoLine = findBingoLine();
  const allFound  = state.found.every(Boolean);
  const count     = state.found.filter(Boolean).length;
  const busy      = state.phase !== 'idle';

  app.innerHTML = `
    <div class="game-shell">
      <div class="game-top">
        <header>
          <h1>NOISE BINGO FOR ${formatDate(state.date)}</h1>
        </header>
      </div>

      <div class="game-middle">
        ${!state.micAllowed ? `
          <div class="mic-gate">
            <button class="mic-gate-btn" id="micBtn">Enable microphone</button>
          </div>
        ` : `
          <div class="grid-wrapper">
            <div class="bingo-grid">
              ${state.sounds.map((sound, i) => `
                <button
                  class="cell${state.found[i] ? ' found' : ''}${state.listening === i ? ' listening' : ''}${bingoLine?.includes(i) ? ' bingo-line' : ''}"
                  data-index="${i}"
                  ${!state.modelReady || busy || state.found[i] ? 'disabled' : ''}
                >
                  <div class="cell-icon">${scribbleSvg(sound)}</div>
                  <span class="cell-name">${sound.name}</span>
                  ${state.found[i] ? '<span class="cell-check">&#10003;</span>' : ''}
                </button>`).join('')}
            </div>
            ${state.phase === 'recording'
              ? `<div class="grid-overlay" id="feedback">
                  <div class="listening-info">
                    <div class="rec-indicator"><span class="countdown" id="countdown">${state.countdown}</span></div>
                    <p class="listening-target">Recording for <strong>${state.sounds[state.listening]?.name}</strong></p>
                    <p class="detected">(Hold your device near the sound)</p>
                  </div>
                </div>`
              : state.phase === 'analyzing'
                ? `<div class="grid-overlay" id="feedback">
                    <div class="listening-info">
                      <div class="loader-large"></div>
                      <p class="listening-target">Analyzing audio</p>
                    </div>
                  </div>`
                : ''
            }
          </div>
        `}
      </div>

      <div class="game-bottom">
        ${!state.micAllowed ? '' : `
          ${state.lastMiss
            ? `<div class="result-info">
                <p class="result-no">NO</p>
                <p class="result-heard">(HEARD ${(state.lastMiss.heard.length ? state.lastMiss.heard.join(', ') : 'NOTHING').toUpperCase()})</p>
              </div>`
            : allFound
              ? `<div class="bingo-celebration"><h2>full board</h2><p>you found every sound today.</p></div>`
              : ''
          }

          <div class="progress-row">
            <span class="emoji-string">${emojiString()}</span>
            <button class="share-btn" id="shareBtn">Share</button>
          </div>
        `}
      </div>
    </div>
  `;

  fitSquareToViewport();

  // ── Bind events ───────────────────────────────────────────────
  document.getElementById('micBtn')?.addEventListener('click', requestMic);
  document.getElementById('shareBtn')?.addEventListener('click', shareResult);

  app.querySelectorAll('.cell:not([disabled])').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.index, 10);
      if (!state.found[idx] && state.phase === 'idle') listenForSound(idx);
    });
  });
}

// ── Listening flow ──────────────────────────────────────────────────

const RECORD_SECONDS = 4;

async function listenForSound(index) {
  const sound = state.sounds[index];
  state.listening = index;
  state.phase     = 'recording';
  state.lastMiss  = null;
  state.countdown = RECORD_SECONDS;
  render();

  const cdInterval = setInterval(() => {
    state.countdown--;
    const el = document.getElementById('countdown');
    if (el) el.textContent = state.countdown;
    if (state.countdown <= 0) clearInterval(cdInterval);
  }, 1000);

  try {
    const recording = await recordAudio(RECORD_SECONDS * 1000);
    clearInterval(cdInterval);

    if (recording.silent) {
      state.listening = -1;
      state.phase     = 'idle';
      render();
      showMissed(sound.name, ['silence']);
      return;
    }

    state.phase = 'analyzing';
    render();

    const result = await classifyAudio(recording.base64, sound.name, sound.match);

    if (result.match) {
      onSoundFound(index);
    } else {
      state.listening = -1;
      state.phase     = 'idle';
      render();
      showMissed(sound.name, result.heard);
    }
  } catch (err) {
    clearInterval(cdInterval);
    console.error('[sound-bingo]', err);
    state.listening = -1;
    state.phase     = 'idle';
    render();
    const bottom = document.querySelector('.game-bottom');
    if (bottom) {
      const msg = err.message.includes('Permission') || err.message.includes('NotAllowed')
        ? 'Microphone access is required. Please allow mic permissions.'
        : err.message;
      const el = document.createElement('p');
      el.className = 'error-msg';
      el.textContent = msg;
      bottom.insertBefore(el, bottom.firstChild);
    }
  }
}

function onSoundFound(index) {
  state.found[index] = true;
  state.listening    = -1;
  state.phase        = 'idle';
  if (findBingoLine() && !state.bingo) state.bingo = true;
  saveState();
  render();
  playSuccessChime();
}

function showMissed(name, heard) {
  state.lastMiss = { name, heard };
  render();
}

// ── Bootstrap ───────────────────────────────────────────────────────

async function main() {
  loadState();
  await checkMicPermission();
  render();
  try {
    initClassifier();
    state.modelReady = true;
    render();
  } catch (err) {
    console.error('[sound-bingo] init failed', err);
    const el = document.querySelector('.subtitle');
    if (el) el.textContent = err.message;
  }
}

window.addEventListener('resize', fitSquareToViewport);
main();
