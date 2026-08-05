/**
 * Generate a realistic pealess/coach-style fire whistle (dual-tone warble).
 * Writes a seamless-ish short WAV suitable for looping.
 */
const fs = require("fs");
const path = require("path");

const SAMPLE_RATE = 44100;
const DURATION_SEC = 2.4;
const OUT = path.join(__dirname, "..", "assets", "audio", "fire_whistle.wav");

function writeWav(filePath, samples) {
  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE((s * 32767) | 0, 44 + i * 2);
  }
  fs.writeFileSync(filePath, buffer);
}

const n = Math.floor(SAMPLE_RATE * DURATION_SEC);
const samples = new Float64Array(n);

// Classic metal whistle: two close highs + soft breath noise; pea warble ~18Hz
const f1 = 2680;
const f2 = 2910;
const warbleHz = 18.5;

for (let i = 0; i < n; i++) {
  const t = i / SAMPLE_RATE;
  const warble = 0.55 + 0.45 * Math.sin(2 * Math.PI * warbleHz * t);
  const vib = 1 + 0.012 * Math.sin(2 * Math.PI * 6.5 * t);
  const tone =
    0.55 * Math.sin(2 * Math.PI * f1 * vib * t) +
    0.42 * Math.sin(2 * Math.PI * f2 * vib * t) +
    0.12 * Math.sin(2 * Math.PI * (f1 * 2) * t) * 0.35;
  const breath = (Math.random() * 2 - 1) * 0.04;
  // Soft attack / release so loops aren't clicky
  const attack = Math.min(1, t / 0.045);
  const release = Math.min(1, (DURATION_SEC - t) / 0.06);
  const env = attack * release * warble;
  samples[i] = (tone + breath) * env * 0.72;
}

writeWav(OUT, samples);
console.log("wrote", OUT, "samples", n);
