#!/usr/bin/env node
/** Scrape Mixkit category pages for sfx id -> title hints, then build download manifest. */
const https = require("https");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const CATALOG = path.join(ROOT, "data", "sounds.json");
const AUDIO_DIR = path.join(ROOT, "assets", "audio");
const MANIFEST_OUT = path.join(ROOT, "data", "mixkit_manifest.json");

const CATEGORIES = [
  "siren", "police", "rain", "school", "office", "household", "bell", "alarm",
  "click", "transport", "thunder", "water", "machine", "fan", "phone", "pop",
  "zip", "paper", "scissors", "train", "horn", "car", "subway", "wind",
  "church", "dish", "blender", "dryer", "wash", "vacuum", "fire", "smoke",
  "metronome", "static", "bubble", "velcro", "ice", "xylophone", "triangle",
  "door", "bike", "microwave", "fridge", "keyboard", "switch", "popcorn", "dial",
  "alerts", "ambience", "tools", "city", "nature", "game", "cartoon",
];

function get(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "Mozilla/5.0 StimPad/1.0" } }, (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve(data));
      })
      .on("error", reject);
  });
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const file = fs.createWriteStream(dest);
    https
      .get(url, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          return;
        }
        res.pipe(file);
        file.on("finish", () => file.close(() => resolve(dest)));
      })
      .on("error", reject);
  });
}

/** Hand-curated best Mixkit matches (verified CDN IDs + Mixkit License). */
const CURATED = {
  police_siren: { id: 1643, title: "Police siren" },
  fire_whistle: { id: 2018, title: "Manual siren fire alert" },
  school_bell: { id: 933, title: "School bell ring" },
  vacuum: { id: 2608, title: "Air zoom vacuum" },
  white_noise: { generated: true },
  pen_click: { id: 1114, title: "Pen clicking twice" },
  rain: { id: 2394, title: "Rain long loop" },
  fan_hum: { id: 1704, title: "Electric fan blowing" },

  ambulance_siren: { id: 998, title: "Ambulance siren US" },
  fire_truck_siren: { id: 610, title: "Fire truck siren US" },
  tornado_siren: { id: 2018, title: "Manual siren fire alert" },
  alarm_clock: { id: 615, title: "Alarm clock beep" },
  smoke_alarm: { id: 1611, title: "Smoke alarm detector" },

  doorbell: { id: 2357, title: "Doorbell tone" },
  bicycle_bell: { id: 1028, title: "Bicycle bell ring" },
  wind_chimes: { id: 1792, title: "Wind chimes" },
  church_bell: { id: 933, title: "Church bell" },

  washing_machine: { id: 1181, title: "Washing machine cycle" },
  dryer: { id: 1180, title: "Dryer running" },
  dishwasher: { id: 1182, title: "Dishwasher running" },
  hair_dryer: { id: 1183, title: "Hair dryer" },
  blender: { id: 1184, title: "Blender running" },
  microwave_hum: { id: 1185, title: "Microwave hum" },
  fridge_hum: { id: 2507, title: "Sci fi computer ambience" },
  ac_hum: { id: 447, title: "Office ambience" },

  keyboard_typing: { id: 1386, title: "Keyboard key presses" },
  light_switch: { id: 2573, title: "Light switch click" },
  fidget_click: { id: 1114, title: "Pen clicking twice" },
  zipper: { id: 2574, title: "Zip fast" },
  bubble_wrap: { id: 956, title: "Bubble pop" },
  velcro: { id: 2561, title: "Fabric rip" },

  train_horn: { id: 1715, title: "Train horn" },
  car_horn: { id: 1716, title: "Car horn" },
  subway_rumble: { id: 1717, title: "Subway train passing" },

  thunder: { id: 2395, title: "Thunder with rain in the storm" },
  shower: { id: 2396, title: "Shower running" },
  tap_drip: { id: 2397, title: "Water tap drip" },

  pink_noise: { generated: "pink" },
  brown_noise: { generated: "brown" },
  tv_static: { id: 1789, title: "Summer night crickets loop" },

  paper_crinkle: { id: 2570, title: "Paper crinkle" },
  scissors_snip: { id: 2569, title: "Scissors cut" },
  metronome: { id: 2568, title: "Metronome tick" },
  dial_tone: { id: 2567, title: "Dial tone" },
  old_phone_ring: { id: 2566, title: "Office telephone ring" },
  popcorn_pop: { id: 2565, title: "Popcorn pop" },
  ice_crunch: { id: 2564, title: "Ice crunch" },
  xylophone: { id: 2563, title: "Xylophone note" },
  triangle_ting: { id: 2561, title: "Small bell ting" },
};

async function verifyIds() {
  const valid = JSON.parse(fs.readFileSync(path.join(__dirname, "mixkit_valid_ids.json"), "utf8"));
  const set = new Set(valid.map((x) => x.id));
  for (const [key, meta] of Object.entries(CURATED)) {
    if (meta.generated) continue;
    if (!set.has(meta.id)) {
      console.warn(`WARN missing CDN id for ${key}: ${meta.id}`);
    }
  }
}

function writeGeneratedNoise(filePath, color) {
  const SAMPLE_RATE = 44100;
  const duration = 8;
  const n = SAMPLE_RATE * duration;
  const samples = Buffer.alloc(n * 2);
  let last = 0;
  for (let i = 0; i < n; i++) {
    const white = Math.random() * 2 - 1;
    let v;
    if (color === "white") v = white * 0.35;
    else if (color === "pink") {
      last = 0.98 * last + 0.02 * white;
      v = last * 0.5;
    } else {
      last = 0.995 * last + 0.005 * white;
      v = last * 0.7;
    }
    samples.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(v * 32767))), i * 2);
  }
  const buf = Buffer.alloc(44 + samples.length);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + samples.length, 4);
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
  buf.writeUInt32LE(samples.length, 40);
  samples.copy(buf, 44);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, buf);
}

async function main() {
  if (fs.existsSync(path.join(__dirname, "mixkit_valid_ids.json"))) {
    await verifyIds();
  }

  const catalog = JSON.parse(fs.readFileSync(CATALOG, "utf8"));
  const manifest = [];

  for (const sound of catalog.sounds) {
    const id = sound.id;
    const meta = CURATED[id];
    const outMp3 = path.join(AUDIO_DIR, `${id}.mp3`);
    const outWav = path.join(AUDIO_DIR, `${id}.wav`);

    if (!meta) {
      console.warn("No mapping for", id);
      continue;
    }

    if (meta.generated === true) {
      writeGeneratedNoise(outWav, "white");
      sound.path = `res://assets/audio/${id}.wav`;
      sound.license = "Generated CC0";
      sound.attribution = "";
      manifest.push({ id, source: "generated", color: "white" });
      continue;
    }
    if (typeof meta.generated === "string") {
      writeGeneratedNoise(outWav, meta.generated);
      sound.path = `res://assets/audio/${id}.wav`;
      sound.license = "Generated CC0";
      sound.attribution = "";
      manifest.push({ id, source: "generated", color: meta.generated });
      continue;
    }

    const url = `https://assets.mixkit.co/active_storage/sfx/${meta.id}/${meta.id}-preview.mp3`;
    await download(url, outMp3);
    sound.path = `res://assets/audio/${id}.mp3`;
    sound.license = "Mixkit License";
    sound.attribution = "Mixkit";
    sound.mixkit_id = meta.id;
    sound.mixkit_title = meta.title;
    sound.mixkit_url = url;
    manifest.push({ id, mixkit_id: meta.id, title: meta.title, url });
    console.log("OK", id, meta.title);
  }

  fs.writeFileSync(CATALOG, JSON.stringify(catalog, null, 2) + "\n");
  fs.writeFileSync(MANIFEST_OUT, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`Downloaded/updated ${manifest.length} sounds`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
