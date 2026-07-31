#!/usr/bin/env node
/** Generate bundled placeholder audio (WAV) and per-sound button art (PNG) for StimPad. */

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const ROOT = path.resolve(__dirname, "..");
const CATALOG = path.join(ROOT, "data", "sounds.json");
const SAMPLE_RATE = 44100;

const CATEGORY_COLORS = {
  Alarms: [220, 80, 70],
  Bells: [230, 180, 60],
  Household: [120, 150, 190],
  Clicks: [180, 190, 200],
  Vehicles: [90, 110, 150],
  Water: [70, 150, 210],
  Noise: [140, 140, 150],
  Misc: [160, 120, 200],
};

function writeWav(filePath, samples) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const buf = Buffer.alloc(44 + samples.length * 2);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + samples.length * 2, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(SAMPLE_RATE, 24);
  buf.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  fs.writeFileSync(filePath, buf);
}

function genNoise(duration, color = "white") {
  const n = Math.floor(SAMPLE_RATE * duration);
  const out = [];
  let last = 0;
  for (let i = 0; i < n; i++) {
    const white = Math.random() * 2 - 1;
    if (color === "white") out.push(white * 0.35);
    else if (color === "pink") {
      last = 0.98 * last + 0.02 * white;
      out.push(last * 0.5);
    } else {
      last = 0.995 * last + 0.005 * white;
      out.push(last * 0.7);
    }
  }
  return out;
}

function genTone(duration, freq, pulse = false) {
  const n = Math.floor(SAMPLE_RATE * duration);
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    let env = 1;
    if (pulse) env = 0.5 + 0.5 * Math.sin(2 * Math.PI * 2.5 * t);
    let s = Math.sin(2 * Math.PI * freq * t) * env;
    if (i < 500) s *= i / 500;
    if (i > n - 500) s *= (n - i) / 500;
    out.push(s * 0.45);
  }
  return out;
}

function genSiren(duration) {
  const n = Math.floor(SAMPLE_RATE * duration);
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const freq = 600 + 400 * (0.5 + 0.5 * Math.sin(2 * Math.PI * 0.8 * t));
    out.push(Math.sin(2 * Math.PI * freq * t) * 0.35);
  }
  return out;
}

function genAudio(id, category, mode) {
  const duration = mode === "loop" ? 3.0 : 1.2;
  if (id.includes("noise")) {
    if (id.includes("pink")) return genNoise(duration, "pink");
    if (id.includes("brown")) return genNoise(duration, "brown");
    return genNoise(duration, "white");
  }
  if (id.includes("siren") || id.includes("alarm")) return genSiren(duration);
  if (category === "Clicks" || mode === "oneshot")
    return genTone(0.8, [440, 660, 880, 1200][Math.floor(Math.random() * 4)]);
  if (category === "Water") return genNoise(duration, "pink");
  if (category === "Household") return genNoise(duration, "brown");
  if (category === "Bells") return genTone(duration, [880, 990, 1175][Math.floor(Math.random() * 3)], true);
  return genTone(duration, [300, 450, 600][Math.floor(Math.random() * 3)], true);
}

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return ~c >>> 0;
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function writePng(filePath, rgb) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const w = 256;
  const h = 256;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[(w * 3 + 1) * y] = 0;
    for (let x = 0; x < w; x++) {
      const t = y / h;
      let r = Math.min(255, Math.floor(rgb[0] * (0.7 + 0.3 * t)));
      let g = Math.min(255, Math.floor(rgb[1] * (0.7 + 0.3 * t)));
      let b = Math.min(255, Math.floor(rgb[2] * (0.7 + 0.3 * t)));
      if ((x - 128) ** 2 + (y - 128) ** 2 < 70 ** 2) {
        r = Math.min(255, r + 40);
        g = Math.min(255, g + 40);
        b = Math.min(255, b + 40);
      }
      const o = (w * 3 + 1) * y + 1 + x * 3;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const png = Buffer.concat([
    sig,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
  fs.writeFileSync(filePath, png);
}

const data = JSON.parse(fs.readFileSync(CATALOG, "utf8"));
for (const sound of data.sounds) {
  const relAudio = sound.path.replace("res://", "");
  const wavPath = path.join(ROOT, relAudio.replace(/\.ogg$/, ".wav"));
  const artPath = path.join(ROOT, sound.art.replace("res://", ""));
  const samples = genAudio(sound.id, sound.category, sound.mode);
  writeWav(wavPath, samples);
  writePng(artPath, CATEGORY_COLORS[sound.category] || [130, 130, 130]);
}
console.log(`Generated audio/art for ${data.sounds.length} sounds`);
