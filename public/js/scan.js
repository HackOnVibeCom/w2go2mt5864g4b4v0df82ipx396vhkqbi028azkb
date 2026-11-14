// Receipt photo → items. Uses Claude on the server when enabled, otherwise
// on-device OCR (Tesseract.js, loaded on first use) + our receipt text parser.
import { api } from './core.js';
import { parseReceipt, addsUp, mergeReadings } from '../lib/parse.js';

const TESSERACT = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
let aiEnabled = null;

export async function aiAvailable() {
  if (aiEnabled === null) {
    try {
      aiEnabled = Boolean((await api('GET', '/config'))?.aiParse);
    } catch {
      aiEnabled = false;
    }
  }
  return aiEnabled;
}

export async function readReceiptImage(file, onProgress = () => {}) {
  onProgress(0.05, 'Opening photo…');
  const img = await loadImage(file);
  if (await aiAvailable()) {
    onProgress(0.25, 'Reading your receipt…');
    try {
      const data = toJpegBase64(img, 1600);
      const result = await api('POST', '/parse', { mediaType: 'image/jpeg', data });
      onProgress(1, 'Done');
      return { ...result, via: 'ai' };
    } catch {
      onProgress(0.3, 'Switching to on-device scan…');
    }
  }
  const { parsed, text } = await ocr(img, onProgress);
  onProgress(1, 'Done');
  return { ...parsed, rawText: text, via: 'ocr' };
}

async function loadImage(file) {
  if (!file || !/^image\//.test(file.type || 'image/')) throw new Error('Pick a photo of the receipt.');
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.decoding = 'async';
      img.src = url;
      await img.decode();
      return img;
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }
}

function drawScaled(img, scale) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return { canvas, ctx };
}

function toJpegBase64(img, maxSide) {
  const { canvas } = drawScaled(img, Math.min(1, maxSide / Math.max(img.width, img.height)));
  return canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
}

// Tesseract reads best when letters are ~30 px tall. Receipt text is roughly 1/40 of the
// receipt's width, so bring the short side to ~1400 px: shrink big phone photos, and
// enlarge small ones (a 330 px wide screenshot loses its price column otherwise).
const OCR_SHORT_SIDE = 1400;
const OCR_MAX_SIDE = 3200;
function ocrScale(img) {
  const short = Math.min(img.width, img.height);
  const long = Math.max(img.width, img.height);
  return Math.min(OCR_SHORT_SIDE / short, OCR_MAX_SIDE / long, 5);
}

// Grayscale, then either a contrast stretch (good for evenly lit receipts) or Sauvola
// thresholding, which copes with shadows and the fading at the edges of thermal paper.
function preprocess(img, mode) {
  const { canvas, ctx } = drawScaled(img, ocrScale(img));
  const W = canvas.width;
  const H = canvas.height;
  const image = ctx.getImageData(0, 0, W, H);
  const d = image.data;
  const g = new Float32Array(W * H);
  for (let i = 0, p = 0; i < d.length; i += 4, p++) g[p] = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000;
  const out = mode === 'sauvola' ? sauvola(g, W, H) : stretch(g);
  for (let i = 0, p = 0; i < d.length; i += 4, p++) d[i] = d[i + 1] = d[i + 2] = out[p];
  ctx.putImageData(image, 0, 0);
  return canvas;
}

function stretch(g) {
  const hist = new Uint32Array(256);
  for (const v of g) hist[v | 0]++;
  let lo = 0;
  let hi = 255;
  for (let acc = 0; lo < 255 && (acc += hist[lo]) < g.length * 0.02; lo++);
  for (let acc = 0; hi > 0 && (acc += hist[hi]) < g.length * 0.02; hi--);
  const range = Math.max(1, hi - lo);
  const out = new Uint8ClampedArray(g.length);
  for (let p = 0; p < g.length; p++) out[p] = ((g[p] - lo) * 255) / range;
  return out;
}

function sauvola(g, W, H, k = 0.2) {
  const r = Math.max(7, Math.round(Math.min(W, H) / 40));
  const W1 = W + 1;
  const I = new Float64Array(W1 * (H + 1));
  const I2 = new Float64Array(W1 * (H + 1));
  for (let y = 0; y < H; y++) {
    let row = 0;
    let row2 = 0;
    for (let x = 0; x < W; x++) {
      const v = g[y * W + x];
      row += v;
      row2 += v * v;
      I[(y + 1) * W1 + x + 1] = I[y * W1 + x + 1] + row;
      I2[(y + 1) * W1 + x + 1] = I2[y * W1 + x + 1] + row2;
    }
  }
  const out = new Uint8ClampedArray(W * H);
  for (let y = 0; y < H; y++) {
    const y0 = Math.max(0, y - r);
    const y1 = Math.min(H, y + r + 1);
    for (let x = 0; x < W; x++) {
      const x0 = Math.max(0, x - r);
      const x1 = Math.min(W, x + r + 1);
      const n = (x1 - x0) * (y1 - y0);
      const s = I[y1 * W1 + x1] - I[y0 * W1 + x1] - I[y1 * W1 + x0] + I[y0 * W1 + x0];
      const s2 = I2[y1 * W1 + x1] - I2[y0 * W1 + x1] - I2[y1 * W1 + x0] + I2[y0 * W1 + x0];
      const m = s / n;
      const sd = Math.sqrt(Math.max(0, s2 / n - m * m));
      out[y * W + x] = g[y * W + x] > m * (1 + k * (sd / 128 - 1)) ? 255 : 0;
    }
  }
  return out;
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Could not load the scanner. Paste or type the items instead.'));
    document.head.appendChild(s);
  });
}

// Readings to try, in order. The first is usually right; if its lines don't add up to the
// printed total, the others often catch what it missed (a lost price column, a faded total).
const PASSES = [
  { image: 'stretch', psm: '4' }, // one column of variable-size text
  { image: 'sauvola', psm: '4' },
  { image: 'stretch', psm: '6' }, // a single uniform block
];

async function ocr(img, onProgress) {
  if (!window.Tesseract) {
    onProgress(0.1, 'Loading the scanner (first time only)…');
    await loadScript(TESSERACT);
  }
  let pass = 0;
  const worker = await window.Tesseract.createWorker('eng', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') {
        if (pass === 0) onProgress(0.35 + 0.45 * m.progress, 'Reading the text…');
        else onProgress(0.8 + 0.08 * (pass - 1 + m.progress), 'Double-checking the numbers…');
      } else if (typeof m.progress === 'number' && pass === 0) onProgress(0.1 + 0.25 * m.progress, 'Loading the scanner…');
    },
  });
  const images = {};
  const readings = [];
  try {
    for (; pass < PASSES.length; pass++) {
      const { image, psm } = PASSES[pass];
      images[image] ||= preprocess(img, image);
      await worker.setParameters({ tessedit_pageseg_mode: psm, preserve_interword_spaces: '1' });
      const { data } = await worker.recognize(images[image]);
      const text = data.text || '';
      const parsed = parseReceipt(text);
      readings.push({ text, parsed });
      if (addsUp(parsed) && !parsed.unread) break;
    }
  } finally {
    await worker.terminate();
  }
  const parsed = mergeReadings(readings.map((r) => r.parsed));
  const text = readings[readings.findIndex((r) => r.parsed === parsed)]?.text ?? readings[0].text;
  return { parsed, text };
}
