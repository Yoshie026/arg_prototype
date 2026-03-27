/* Persistent motif: paddles flanking the app with traveling waveform */
(function () {
  'use strict';

  const canvas = document.getElementById('side-motif');
  const app = document.getElementById('app');
  const lobbyScreen = document.getElementById('screen-lobby');
  if (!canvas || !app) return;

  const ctx = canvas.getContext('2d');
  let audioCtx = null;
  let audioUnlocked = false;
  let pendingSyllable = null;
  let running = false;
  let raf = null;
  let lastT = 0;
  let simAcc = 0;
  let t = 0;
  let syllable = '';
  let syllableAge = 1;
  let syllableIdx = 0;

  const SYLLABLES = ['aa', 'beh', 'geh', 'deh', 'feh', 'keh', 'mah', 'noh', 'pah', 'seh'];

  let w = 0;
  let h = 0;
  const leftPad = { x: 0, y: 0, w: 10, h: 96, phase: 0.35 };
  const rightPad = { x: 0, y: 0, w: 10, h: 96, phase: 1.65 };
  const packet = { x: 0, y: 0, vx: 360, vy: 170, angle: 0 };
  let paddlesInitialized = false;

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const ww = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
    const hh = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);

    canvas.width = Math.max(1, Math.floor(ww * dpr));
    canvas.height = Math.max(1, Math.floor(hh * dpr));
    canvas.style.width = ww + 'px';
    canvas.style.height = hh + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    w = ww;
    h = hh;

    const appRect = app.getBoundingClientRect();
    const gap = Math.max(10, Math.min(30, w * 0.02));
    const padW = Math.max(6, Math.floor(w * 0.012));

    leftPad.w = padW;
    rightPad.w = padW;
    leftPad.h = Math.max(62, Math.floor(h * 0.14));
    rightPad.h = leftPad.h;

    // On narrow screens the app fills the viewport, so place paddles
    // just inside the edges rather than outside the app.
    const narrow = appRect.left < gap + padW + 12;
    if (narrow) {
      leftPad.x = 6;
      rightPad.x = w - rightPad.w - 6;
    } else {
      leftPad.x = Math.max(8, appRect.left - gap - leftPad.w);
      rightPad.x = Math.min(w - rightPad.w - 8, appRect.right + gap);
    }

    if (!paddlesInitialized) {
      leftPad.y = h * 0.24;
      rightPad.y = h * 0.67;
      paddlesInitialized = true;
    } else {
      leftPad.y = Math.max(10, Math.min(h - leftPad.h - 10, leftPad.y));
      rightPad.y = Math.max(10, Math.min(h - rightPad.h - 10, rightPad.y));
    }

    if (packet.x <= 0 || packet.x >= w || packet.y <= 0 || packet.y >= h) {
      packet.x = (leftPad.x + leftPad.w + rightPad.x) * 0.5;
      packet.y = h * 0.5;
    }
  }

  function ensureAudio() {
    if (!audioCtx) {
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      } catch {
        return false;
      }
    }
    return true;
  }

  const FORMANTS = {
    aa:  [{ f: 800, g: 1.0 }, { f: 1200, g: 0.7 }, { f: 2500, g: 0.25 }],
    beh: [{ f: 500, g: 0.9 }, { f: 1800, g: 0.55 }, { f: 2500, g: 0.25 }],
    geh: [{ f: 600, g: 0.8 }, { f: 2000, g: 0.55 }, { f: 2800, g: 0.2 }],
    deh: [{ f: 550, g: 0.85 }, { f: 1900, g: 0.5 }, { f: 2700, g: 0.2 }],
    feh: [{ f: 500, g: 0.6 }, { f: 1800, g: 0.5 }, { f: 3500, g: 0.35 }],
    keh: [{ f: 600, g: 0.7 }, { f: 2200, g: 0.55 }, { f: 3200, g: 0.25 }],
    mah: [{ f: 700, g: 1.0, q: 3 }, { f: 1100, g: 0.55 }, { f: 2500, g: 0.15 }],
    noh: [{ f: 450, g: 0.85 }, { f: 800, g: 0.65, q: 4 }, { f: 2300, g: 0.15 }],
    pah: [{ f: 750, g: 1.0 }, { f: 1100, g: 0.5 }, { f: 2500, g: 0.2 }],
    seh: [{ f: 500, g: 0.55 }, { f: 1800, g: 0.5 }, { f: 4000, g: 0.4 }],
  };

  function playRobotSyllable(syl) {
    if (!audioCtx || audioCtx.state !== 'running') return;

    const now = audioCtx.currentTime;
    const dur = 0.18;
    const fundamental = 110;
    const formants = FORMANTS[syl] || FORMANTS.aa;

    if (syl !== 'aa') {
      const len = Math.floor(audioCtx.sampleRate * 0.03);
      const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
      const ch = buf.getChannelData(0);
      for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * 0.15;

      const src = audioCtx.createBufferSource();
      src.buffer = buf;

      const nFilt = audioCtx.createBiquadFilter();
      nFilt.type = 'bandpass';
      nFilt.frequency.value = formants[0].f;
      nFilt.Q.value = 2;

      const nGain = audioCtx.createGain();
      nGain.gain.setValueAtTime(0.04, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

      src.connect(nFilt);
      nFilt.connect(nGain);
      nGain.connect(audioCtx.destination);
      src.start(now);
      src.stop(now + 0.03);
    }

    formants.forEach((fm) => {
      const osc = audioCtx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = fundamental;

      const filt = audioCtx.createBiquadFilter();
      filt.type = 'bandpass';
      filt.frequency.value = fm.f;
      filt.Q.value = fm.q || 6;

      const gain = audioCtx.createGain();
      const attack = syl === 'aa' ? 0.01 : 0.03;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(fm.g * 0.06, now + attack);
      gain.gain.setValueAtTime(fm.g * 0.06, now + dur - 0.04);
      gain.gain.linearRampToValueAtTime(0, now + dur);

      osc.connect(filt);
      filt.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + dur + 0.01);
    });
  }

  function tryUnlockAudio() {
    if (!ensureAudio()) return;
    audioCtx.resume().then(() => {
      audioUnlocked = audioCtx.state === 'running';
      if (audioUnlocked && pendingSyllable) {
        playRobotSyllable(pendingSyllable);
        pendingSyllable = null;
      }
    }).catch(() => {});
  }

  function ping(side) {
    syllable = SYLLABLES[syllableIdx++ % SYLLABLES.length];
    syllableAge = 0;

    if (!isLobbyActive()) return;

    if (!ensureAudio()) return;
    if (audioCtx.state === 'running') {
      audioUnlocked = true;
      playRobotSyllable(syllable);
      return;
    }
    pendingSyllable = syllable;
    tryUnlockAudio();
  }

  function isLobbyActive() {
    return !!lobbyScreen && !lobbyScreen.classList.contains('hidden');
  }

  function movePaddleSmooth(currentY, targetCenterY, paddleH, minY, maxY, dt, maxSpeed, gain) {
    const center = currentY + paddleH * 0.5;
    const err = targetCenterY - center;
    const vel = Math.max(-maxSpeed, Math.min(maxSpeed, err * gain));
    const next = currentY + vel * dt;
    return Math.max(minY, Math.min(maxY, next));
  }

  function update(dt) {
    t += dt;

    const minY = 10;
    const maxY = Math.max(minY, h - leftPad.h - 10);
    const centerY = h * 0.5;
    const leftTarget = packet.vx < 0
      ? packet.y + 10
      : centerY + Math.sin(t * 1.8 + 0.4) * 56;
    const rightTarget = packet.vx > 0
      ? packet.y - 12
      : centerY + Math.sin(t * 1.37 + 2.1) * 72;

    leftPad.y = movePaddleSmooth(leftPad.y, leftTarget, leftPad.h, minY, maxY, dt, 600, 10.5);
    rightPad.y = movePaddleSmooth(rightPad.y, rightTarget, rightPad.h, minY, maxY, dt, 510, 8.7);

    packet.x += packet.vx * dt;
    packet.y += packet.vy * dt;

    const top = 8;
    const bottom = h - 8;
    if (packet.y <= top) {
      packet.y = top;
      packet.vy = Math.abs(packet.vy);
    } else if (packet.y >= bottom) {
      packet.y = bottom;
      packet.vy = -Math.abs(packet.vy);
    }

    const packetHalf = Math.max(10, Math.min(26, (rightPad.x - (leftPad.x + leftPad.w)) * 0.12));
    const leftFace = leftPad.x + leftPad.w + 4;
    const rightFace = rightPad.x - 4;

    if (
      packet.vx < 0 &&
      packet.x - packetHalf <= leftFace &&
      packet.y >= leftPad.y - 4 &&
      packet.y <= leftPad.y + leftPad.h + 4
    ) {
      packet.x = leftFace + packetHalf;
      packet.vx = Math.abs(packet.vx);
      const rel = (packet.y - (leftPad.y + leftPad.h * 0.5)) / (leftPad.h * 0.5);
      packet.vy += rel * 105;
      packet.vy = Math.max(-330, Math.min(330, packet.vy));
      packet.vx = Math.min(520, packet.vx * 1.03);
      ping('left');
    }

    if (
      packet.vx > 0 &&
      packet.x + packetHalf >= rightFace &&
      packet.y >= rightPad.y - 4 &&
      packet.y <= rightPad.y + rightPad.h + 4
    ) {
      packet.x = rightFace - packetHalf;
      packet.vx = -Math.abs(packet.vx);
      const rel = (packet.y - (rightPad.y + rightPad.h * 0.5)) / (rightPad.h * 0.5);
      packet.vy += rel * 105;
      packet.vy = Math.max(-330, Math.min(330, packet.vy));
      packet.vx = -Math.min(520, Math.abs(packet.vx) * 1.03);
      ping('right');
    }

    // Reset round if either side misses.
    if (packet.x < leftPad.x - 80 || packet.x > rightPad.x + 80) {
      packet.x = (leftPad.x + leftPad.w + rightPad.x) * 0.5;
      packet.y = h * 0.5;
      packet.vx = (Math.random() > 0.5 ? 1 : -1) * 360;
      packet.vy = (Math.random() * 2 - 1) * 160;
    }

    packet.angle = Math.atan2(packet.vy, packet.vx);

    syllableAge += dt;
  }

  function drawPacketWave() {
    const span = Math.max(26, rightPad.x - (leftPad.x + leftPad.w));
    const halfW = Math.max(10, Math.min(26, span * 0.12));
    const segs = 17;
    const amp = 5.2 + Math.sin(t * 7.4) * 1.1;
    const dir = packet.vx >= 0 ? 1 : -1;
    const phase = t * 20 * dir;

    ctx.save();
    ctx.translate(packet.x, packet.y);
    ctx.rotate(packet.angle);
    ctx.beginPath();
    for (let i = 0; i <= segs; i++) {
      const p = i / segs;
      const x = -halfW + p * halfW * 2;
      const y = Math.sin(p * Math.PI * 2.45 + phase) * amp;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = '#1f2d43';
    ctx.fillRect(leftPad.x, leftPad.y, leftPad.w, leftPad.h);
    ctx.fillRect(rightPad.x, rightPad.y, rightPad.w, rightPad.h);

    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    drawPacketWave();

    if (syllable && syllableAge < 0.42) {
      const alpha = Math.max(0, 1 - syllableAge / 0.42);
      const isRight = packet.vx < 0;
      const hitPad = isRight ? rightPad : leftPad;
      const tx = isRight ? (hitPad.x - 8) : (hitPad.x + hitPad.w + 8);
      const ty = hitPad.y + hitPad.h * 0.5 - syllableAge * 16;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#000';
      ctx.font = '700 11px "JetBrains Mono", monospace';
      ctx.textAlign = isRight ? 'right' : 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('"' + syllable + '"', tx, ty);
      ctx.restore();
    }
  }

  function tick() {
    if (!running) return;
    const now = performance.now();
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    // Fixed-step simulation for smoother motion across frame-rate variance.
    simAcc += dt;
    const fixed = 1 / 120;
    while (simAcc >= fixed) {
      update(fixed);
      simAcc -= fixed;
    }
    draw();
    raf = requestAnimationFrame(tick);
  }

  function start() {
    if (running) return;
    resize();
    running = true;
    lastT = performance.now();
    simAcc = 0;
    tick();
  }

  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = null;
  }

  window.addEventListener('resize', resize);
  const unlockEvents = ['pointerdown', 'touchstart', 'keydown'];
  unlockEvents.forEach((evt) => {
    document.addEventListener(evt, tryUnlockAudio, { passive: true });
  });

  start();
  window.pongDemo = { start, stop };
})();
