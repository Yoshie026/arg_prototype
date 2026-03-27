// Generative SVG scribbles for each sound.
// The visual is derived from the sound's match description (keywords like
// "loud", "rhythmic", "chirp") and seeded by its ID, so each sound gets a
// unique but deterministic mark that hints at its character.

const SIZE = 64;
const PAD = 6;
const DRAW = SIZE - PAD * 2;

// ── Seeded PRNG ─────────────────────────────────────────────────────

function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return h;
}

function rng(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Analyse the match description for visual cues ───────────────────

function analyse(match) {
  const m = match.toLowerCase();

  let type = 'wave';
  if (/snap|pop|crack|bang|burst|slam|explos|sudden|abrupt|thud|clang|crash|jolt|punch/.test(m))
    type = 'burst';
  else if (/rhythmic|repetitive|tick|click|tap|beep|pulse|beat|knock|typing|hammer|drip|rap|stapl/.test(m))
    type = 'pulse';
  else if (/crowd|chatter|many|babble|crinkl|crunch|grind|scrape|rustle|rattle|clatter|scatter|sizzl|fry|crackl/.test(m))
    type = 'scatter';
  else if (/chirp|tweet|whistle|ring|alarm|siren|sing|trill|squeak|whir|buzz|hiss|beep|vibrat|melodic/.test(m))
    type = 'trill';
  else if (/continuous|sustained|flow|stream|pour|spray|rush|shower|running|wash|hum|drone|motor|fan|blow/.test(m))
    type = 'flow';

  const loud  = /loud|roar|bang|slam|crash|blast|heavy|aggressive|piercing|powerful|forceful|dense/.test(m);
  const quiet = /soft|gentle|quiet|subtle|faint|muffled/.test(m);
  const intensity = loud ? 0.9 : quiet ? 0.3 : 0.55;

  return { type, intensity };
}

// ── Smooth path through points (Catmull-Rom → cubic bezier) ─────────

const f = (n) => n.toFixed(1);

function smooth(pts) {
  if (pts.length < 2) return '';
  let d = `M${f(pts[0][0])},${f(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)},${f(p1[1] + (p2[1] - p0[1]) / 6)} `;
    d += `${f(p2[0] - (p3[0] - p1[0]) / 6)},${f(p2[1] - (p3[1] - p1[1]) / 6)} `;
    d += `${f(p2[0])},${f(p2[1])}`;
  }
  return d;
}

function noisyLoop(r, radius, wobble, points = 16) {
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const pts = [];
  for (let i = 0; i <= points; i++) {
    const a = (i / points) * Math.PI * 2;
    const rr = radius + (r() - 0.5) * wobble;
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  return smooth(pts);
}

// ── Generators ──────────────────────────────────────────────────────

function wave(r, intensity) {
  const amp  = DRAW * 0.35 * intensity;
  const freq = 2 + r() * 2;
  const steps = 10;
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = PAD + t * DRAW;
    const y = SIZE / 2 + Math.sin(t * Math.PI * 2 * freq) * amp * (0.6 + r() * 0.4);
    pts.push([x + (r() - 0.5) * 1.5, y + (r() - 0.5) * 1.5]);
  }
  const sw = 1.2 + intensity * 1.2;
  return `<path d="${smooth(pts)}" stroke-width="${f(sw)}"/>`;
}

function pulse(r, intensity) {
  const n  = 3 + Math.floor(r() * 4);
  const h  = DRAW * 0.4 * intensity;
  const sw = 1.2 + intensity * 1.0;
  const baseline = SIZE / 2 + h * 0.3;
  const spacing  = DRAW / (n + 1);
  let d = `M${f(PAD)},${f(baseline)}`;
  for (let i = 1; i <= n; i++) {
    const x = PAD + i * spacing + (r() - 0.5) * 2;
    const barH = h * (0.5 + r() * 0.5);
    d += `L${f(x)},${f(baseline)} L${f(x)},${f(baseline - barH)} L${f(x)},${f(baseline)}`;
  }
  d += `L${f(SIZE - PAD)},${f(baseline)}`;
  return `<path d="${d}" stroke-width="${f(sw)}"/>`;
}

function burst(r, intensity) {
  const n  = 5 + Math.floor(r() * 4);
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const maxR = DRAW * 0.45 * intensity;
  const sw = 1.4 + intensity * 1.0;
  let els = '';
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2 + (r() - 0.5) * 0.5;
    const len = maxR * (0.4 + r() * 0.6);
    const x1 = cx + Math.cos(angle) * 2;
    const y1 = cy + Math.sin(angle) * 2;
    const x2 = cx + Math.cos(angle) * len;
    const y2 = cy + Math.sin(angle) * len;
    els += `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke-width="${f(sw * (0.7 + r() * 0.5))}"/>`;
  }
  return els;
}

function scatter(r, intensity) {
  const n  = 6 + Math.floor(r() * 5);
  const sw = 1.0 + intensity * 0.8;
  let els = '';
  for (let i = 0; i < n; i++) {
    const x = PAD + r() * DRAW;
    const y = PAD + r() * DRAW;
    const angle = r() * Math.PI * 2;
    const len = (DRAW * 0.15) * (0.3 + r() * 0.7) * (0.5 + intensity);
    els += `<line x1="${f(x)}" y1="${f(y)}" x2="${f(x + Math.cos(angle) * len)}" y2="${f(y + Math.sin(angle) * len)}" stroke-width="${f(sw * (0.6 + r() * 0.6))}"/>`;
  }
  return els;
}

function trill(r, intensity) {
  const amp  = DRAW * 0.15 * (0.5 + intensity * 0.5);
  const freq = 5 + r() * 4;
  const steps = 20;
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = PAD + t * DRAW;
    const env = Math.sin(t * Math.PI); // envelope: fade in and out
    const y = SIZE / 2 + Math.sin(t * Math.PI * 2 * freq) * amp * env;
    pts.push([x + (r() - 0.5) * 0.8, y + (r() - 0.5) * 0.8]);
  }
  const sw = 1.0 + intensity * 0.8;
  return `<path d="${smooth(pts)}" stroke-width="${f(sw)}"/>`;
}

function flow(r, intensity) {
  const nLines = 2 + Math.floor(r() * 2);
  const sw = 1.0 + intensity * 0.6;
  let els = '';
  for (let l = 0; l < nLines; l++) {
    const offsetY = (l - (nLines - 1) / 2) * (5 + r() * 3);
    const pts = [];
    const steps = 8;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = PAD + t * DRAW + (r() - 0.5) * 2;
      const y = SIZE / 2 + offsetY + Math.sin(t * 3 + l * 2) * DRAW * 0.08 + (r() - 0.5) * 2;
      pts.push([x, y]);
    }
    els += `<path d="${smooth(pts)}" stroke-width="${f(sw * (0.7 + r() * 0.4))}"/>`;
  }
  return els;
}

// ── Public API ──────────────────────────────────────────────────────

const GENERATORS = { wave, pulse, burst, scatter, trill, flow };

export function scribbleSvg(sound) {
  const r = rng(hash(sound.id));
  const { type, intensity } = analyse(sound.match);
  const inner = GENERATORS[type](r, intensity);
  const halo = r() > 0.38
    ? `<path d="${noisyLoop(r, DRAW * (0.28 + r() * 0.08), DRAW * 0.18, 14)}" stroke-width="${f(0.9 + intensity * 0.7)}" opacity="0.35"/>`
    : '';
  const orbit = r() > 0.5
    ? `<path d="${noisyLoop(r, DRAW * (0.4 + r() * 0.08), DRAW * 0.08, 12)}" stroke-width="${f(0.7 + intensity * 0.5)}" opacity="0.25"/>`
    : '';

  return `<svg viewBox="0 0 ${SIZE} ${SIZE}" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
    <g opacity="0.3" transform="translate(${f((r() - 0.5) * 2)}, ${f((r() - 0.5) * 2)})">${inner}</g>
    <g>${inner}</g>
    ${halo}
    ${orbit}
  </svg>`;
}
