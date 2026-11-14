// Receipt photo → items. Uses Claude on the server when enabled, otherwise
// on-device OCR (Tesseract.js, loaded on first use) + our receipt text parser.
import { api } from './core.js';
import { parseReceipt } from '../lib/parse.js';

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
  const text = await ocr(img, onProgress);
  onProgress(1, 'Done');
  return { ...parseReceipt(text), rawText: text, via: 'ocr' };
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

function drawScaled(img, maxSide) {
  const w = img.width;
  const h = img.height;
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return { canvas, ctx };
}

function toJpegBase64(img, maxSide) {
  const { canvas } = drawScaled(img, maxSide);
  return canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
}

// Grayscale + contrast stretch: thermal receipts photographed in restaurants are
// low-contrast and unevenly lit, and this alone noticeably helps OCR.
function preprocess(img) {
  const { canvas, ctx } = drawScaled(img, 2000);
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = image.data;
  const hist = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 4) {
    const g = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000;
    d[i] = g;
    hist[g | 0]++;
  }
  const total = d.length / 4;
  let lo = 0;
  let hi = 255;
  for (let acc = 0; lo < 255 && (acc += hist[lo]) < total * 0.02; lo++);
  for (let acc = 0; hi > 0 && (acc += hist[hi]) < total * 0.02; hi--);
  const range = Math.max(1, hi - lo);
  for (let i = 0; i < d.length; i += 4) {
    const v = Math.max(0, Math.min(255, ((d[i] - lo) * 255) / range));
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
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

async function ocr(img, onProgress) {
  if (!window.Tesseract) {
    onProgress(0.1, 'Loading the scanner (first time only)…');
    await loadScript(TESSERACT);
  }
  const canvas = preprocess(img);
  const worker = await window.Tesseract.createWorker('eng', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') onProgress(0.35 + 0.6 * m.progress, 'Reading the text…');
      else if (typeof m.progress === 'number') onProgress(0.1 + 0.25 * m.progress, 'Loading the scanner…');
    },
  });
  try {
    await worker.setParameters({ tessedit_pageseg_mode: '4', preserve_interword_spaces: '1' });
    const { data } = await worker.recognize(canvas);
    return data.text || '';
  } finally {
    await worker.terminate();
  }
}
