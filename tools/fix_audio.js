/**
 * Fix mismatched StimPad audio:
 * - Re-download verified Mixkit CDN IDs
 * - Generate CC0 replacements where Mixkit mapping was wrong / missing
 */
const https = require("https");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const AUDIO = path.join(ROOT, "assets", "audio");
const SOUNDS_JSON = path.join(ROOT, "data", "sounds.json");
const MANIFEST = path.join(ROOT, "data", "mixkit_manifest.json");
const SR = 44100;

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(url, { headers: { "User-Agent": "StimPad/1.0" } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.close();
          fs.unlinkSync(dest);
          download(res.headers.location, dest).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode !== 200) {
          file.close();
          fs.unlink(dest, () => {});
          reject(new Error(`HTTP ${res.statusCode} ${url}`));
          return;
        }
        res.pipe(file);
        file.on("finish", () => file.close(() => resolve(dest)));
      })
      .on("error", reject);
  });
}

function headOk(url) {
  return new Promise((resolve) => {
    const req = https.request(url, { method: "HEAD", headers: { "User-Agent": "StimPad/1.0" } }, (res) => {
      resolve(res.statusCode === 200);
      res.resume();
    });
    req.on("error", () => resolve(false));
    req.setTimeout(8000, () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
}

function writeWav(filePath, samples) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE((s * 32767) | 0, 44 + i * 2);
  }
  fs.writeFileSync(filePath, buf);
}

function envAttackRelease(t, dur, a = 0.02, r = 0.05) {
  return Math.min(1, t / a) * Math.min(1, (dur - t) / r);
}

/** Classic electric school hall bell: harsh buzz + metallic ring. */
function genSchoolBell() {
  const dur = 2.8;
  const n = Math.floor(SR * dur);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const buzz =
      Math.sign(Math.sin(2 * Math.PI * 480 * t)) * 0.22 * Math.exp(-t * 1.6) +
      Math.sin(2 * Math.PI * 960 * t) * 0.18 * Math.exp(-t * 1.2);
    const clang =
      Math.sin(2 * Math.PI * 1850 * t) * Math.exp(-t * 3.2) * 0.35 +
      Math.sin(2 * Math.PI * 2450 * t) * Math.exp(-t * 4.0) * 0.22 +
      Math.sin(2 * Math.PI * 3100 * t) * Math.exp(-t * 5.5) * 0.12;
    const pulse = t < 0.85 ? 1 : Math.exp(-(t - 0.85) * 2.2);
    out[i] = (buzz + clang) * pulse * envAttackRelease(t, dur, 0.01, 0.08) * 0.85;
  }
  return out;
}

/** Soft desk fan: broadband whoosh + slow blade flutter. */
function genFan() {
  const dur = 4.0;
  const n = Math.floor(SR * dur);
  const out = new Float64Array(n);
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const noise = Math.random() * 2 - 1;
    lp = lp * 0.92 + noise * 0.08;
    const flutter = 0.75 + 0.25 * Math.sin(2 * Math.PI * 22 * t);
    const hum = Math.sin(2 * Math.PI * 58 * t) * 0.08 + Math.sin(2 * Math.PI * 116 * t) * 0.04;
    out[i] = (lp * 0.7 * flutter + hum) * envAttackRelease(t, dur, 0.15, 0.15) * 0.9;
  }
  return out;
}

function genNoise(kind, dur = 3.5) {
  const n = Math.floor(SR * dur);
  const out = new Float64Array(n);
  let b0 = 0,
    b1 = 0,
    b2 = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const white = Math.random() * 2 - 1;
    let s = white;
    if (kind === "pink") {
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      s = b0 + b1 + b2 + white * 0.2;
    } else if (kind === "brown") {
      b0 = (b0 + white * 0.02) * 0.998;
      s = b0 * 3.5;
    } else if (kind === "tv") {
      // hiss + sparse crackle pops
      s = white * 0.55;
      if (Math.random() < 0.002) s += (Math.random() * 2 - 1) * 0.9;
      b0 = b0 * 0.85 + s * 0.15;
      s = b0;
    }
    out[i] = s * envAttackRelease(t, dur, 0.05, 0.08) * 0.55;
  }
  return out;
}

function genHum(baseHz, dur = 4.0) {
  const n = Math.floor(SR * dur);
  const out = new Float64Array(n);
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const noise = (Math.random() * 2 - 1) * 0.04;
    lp = lp * 0.97 + noise * 0.03;
    const hum =
      Math.sin(2 * Math.PI * baseHz * t) * 0.35 +
      Math.sin(2 * Math.PI * baseHz * 2 * t) * 0.18 +
      Math.sin(2 * Math.PI * baseHz * 3 * t) * 0.08;
    const wobble = 1 + 0.03 * Math.sin(2 * Math.PI * 0.35 * t);
    out[i] = (hum * wobble + lp) * envAttackRelease(t, dur, 0.2, 0.2) * 0.7;
  }
  return out;
}

function genTornadoSiren() {
  const dur = 6.0;
  const n = Math.floor(SR * dur);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const cycle = (t % 4.5) / 4.5;
    const f = 420 + 380 * Math.sin(cycle * Math.PI * 2);
    const tone =
      Math.sin(2 * Math.PI * f * t) * 0.45 +
      Math.sin(2 * Math.PI * f * 1.5 * t) * 0.2;
    out[i] = tone * envAttackRelease(t, dur, 0.1, 0.15) * 0.8;
  }
  return out;
}

function genTriangle() {
  const dur = 1.6;
  const n = Math.floor(SR * dur);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const s =
      Math.sin(2 * Math.PI * 2200 * t) * Math.exp(-t * 2.8) * 0.5 +
      Math.sin(2 * Math.PI * 4400 * t) * Math.exp(-t * 4.5) * 0.25 +
      Math.sin(2 * Math.PI * 6600 * t) * Math.exp(-t * 6.0) * 0.1;
    out[i] = s * envAttackRelease(t, dur, 0.002, 0.05);
  }
  return out;
}

function genChurchBell() {
  const dur = 3.2;
  const n = Math.floor(SR * dur);
  const out = new Float64Array(n);
  const partials = [
    [220, 1],
    [440, 0.55],
    [660, 0.28],
    [880, 0.18],
    [1100, 0.1],
  ];
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let s = 0;
    for (const [f, a] of partials) {
      s += Math.sin(2 * Math.PI * f * t) * a * Math.exp(-t * (1.1 + f / 2000));
    }
    out[i] = s * envAttackRelease(t, dur, 0.005, 0.1) * 0.55;
  }
  return out;
}

/** Verified / better Mixkit CDN mappings (skip if HEAD fails). */
const MIXKIT_FIXES = {
  // Keep known-good where titles match
  police_siren: { id: 1643, title: "Police siren" },
  ambulance_siren: { id: 998, title: "Ambulance siren US" },
  fire_truck_siren: { id: 610, title: "Fire truck siren US" },
  alarm_clock: { id: 615, title: "Alarm clock beep" },
  smoke_alarm: { id: 1611, title: "Smoke alarm detector" },
  doorbell: { id: 2357, title: "Doorbell tone" },
  bicycle_bell: { id: 1028, title: "Bicycle bell ring" },
  wind_chimes: { id: 1792, title: "Wind chimes" },
  vacuum: { id: 2608, title: "Air zoom vacuum" },
  pen_click: { id: 1114, title: "Pen clicking twice" },
  rain: { id: 2394, title: "Rain long loop" },
  keyboard_typing: { id: 1386, title: "Keyboard key presses" },
  light_switch: { id: 2573, title: "Light switch click" },
  train_horn: { id: 1715, title: "Train horn" },
  car_horn: { id: 1716, title: "Car horn" },
  thunder: { id: 2395, title: "Thunder with rain in the storm" },
  campfire: { id: 1330, title: "Campfire crackles" },
  ocean_waves: { id: 1196, title: "Sea waves loop" },
  clock_tick: { id: 1059, title: "Tick tock clock close up" },
  cat_meow: { id: 80, title: "Cat meowing" },
  cat_purr: { id: 96, title: "Big wild cat long purr" },
  dog_bark: { id: 2196, title: "Dog barking" },
  camera_shutter: { id: 2358, title: "Camera shutter click" },
  coin_drop: { id: 2003, title: "Arcade retro game coin" },
  helicopter: { id: 2699, title: "Helicopter engine working close" },
  motorcycle_idle: { id: 2721, title: "Motorcycle engine working" },
  steam_train: { id: 1630, title: "Steam train passing" },
  electric_drill: { id: 855, title: "Electrical drill" },
  lawn_mower: { id: 1919, title: "Mowing the lawn engine hum" },
  chainsaw: { id: 796, title: "Cutting trees with chainsaw ambiance and axe hits" },
  construction_site: { id: 800, title: "Construction place and bulldozer ambiance" },
  night_crickets: { id: 39, title: "Crickets and insects in the wild ambience" },
  forest_insects: { id: 2414, title: "Night forest with insects" },
  morning_birds: { id: 2472, title: "Morning birds" },
  heartbeat_slow: { id: 494, title: "Slow heartbeat" },
  restaurant_crowd: { id: 444, title: "Restaurant crowd talking ambience" },
  flowing_water: { id: 3126, title: "Water flowing ambience loop" },
  shower: { id: 2396, title: "Shower running" },
};

const GENERATED = {
  school_bell: { gen: genSchoolBell, title: "Electric school hall bell (CC0)", ext: "wav" },
  church_bell: { gen: genChurchBell, title: "Church tower bell (CC0)", ext: "wav" },
  fan_hum: { gen: genFan, title: "Desk fan blow (CC0)", ext: "wav" },
  tv_static: { gen: () => genNoise("tv"), title: "Analog TV static (CC0)", ext: "wav" },
  fridge_hum: { gen: () => genHum(52), title: "Refrigerator hum (CC0)", ext: "wav" },
  ac_hum: { gen: () => genHum(60), title: "Window AC hum (CC0)", ext: "wav" },
  tornado_siren: { gen: genTornadoSiren, title: "Civil defense siren (CC0)", ext: "wav" },
  triangle_ting: { gen: genTriangle, title: "Orchestra triangle (CC0)", ext: "wav" },
  white_noise: { gen: () => genNoise("white"), title: "White noise (CC0)", ext: "wav" },
  pink_noise: { gen: () => genNoise("pink"), title: "Pink noise (CC0)", ext: "wav" },
  brown_noise: { gen: () => genNoise("brown"), title: "Brown noise (CC0)", ext: "wav" },
};

function updateCatalogEntry(sounds, id, patch) {
  const s = sounds.find((x) => x.id === id);
  if (!s) return;
  Object.assign(s, patch);
}

async function main() {
  const catalog = JSON.parse(fs.readFileSync(SOUNDS_JSON, "utf8"));
  const manifest = [];
  fs.mkdirSync(AUDIO, { recursive: true });

  // Generated replacements for clearly wrong mappings
  for (const [id, meta] of Object.entries(GENERATED)) {
    const dest = path.join(AUDIO, `${id}.${meta.ext}`);
    writeWav(dest, meta.gen());
    // remove stale mp3 if present
    const mp3 = path.join(AUDIO, `${id}.mp3`);
    if (fs.existsSync(mp3)) fs.unlinkSync(mp3);
    const imp = mp3 + ".import";
    if (fs.existsSync(imp)) fs.unlinkSync(imp);
    updateCatalogEntry(catalog.sounds, id, {
      path: `res://assets/audio/${id}.${meta.ext}`,
      license: "CC0",
      attribution: meta.title,
      mixkit_id: 0,
      mixkit_title: "",
      mixkit_url: "",
      mode: ["school_bell", "church_bell", "triangle_ting"].includes(id) ? "oneshot" : (catalog.sounds.find((s) => s.id === id)?.mode || "loop"),
    });
    if (id === "fan_hum" || id === "tv_static" || id === "fridge_hum" || id === "ac_hum" || id === "tornado_siren") {
      updateCatalogEntry(catalog.sounds, id, { mode: "loop", default_duration_sec: 60 });
    }
    manifest.push({ id, source: "generated", title: meta.title });
    console.log("generated", id);
  }

  // Mixkit re-downloads
  for (const [id, meta] of Object.entries(MIXKIT_FIXES)) {
    if (GENERATED[id]) continue;
    const url = `https://assets.mixkit.co/active_storage/sfx/${meta.id}/${meta.id}-preview.mp3`;
    const ok = await headOk(url);
    if (!ok) {
      console.warn("SKIP missing CDN", id, meta.id);
      continue;
    }
    const dest = path.join(AUDIO, `${id}.mp3`);
    try {
      await download(url, dest);
      updateCatalogEntry(catalog.sounds, id, {
        path: `res://assets/audio/${id}.mp3`,
        license: "Mixkit License",
        attribution: "Mixkit",
        mixkit_id: meta.id,
        mixkit_title: meta.title,
        mixkit_url: url,
      });
      manifest.push({ id, mixkit_id: meta.id, title: meta.title, url });
      console.log("downloaded", id, meta.id);
    } catch (e) {
      console.warn("FAIL", id, e.message);
    }
  }

  // Keep fire_whistle generated wav entry
  manifest.unshift({
    id: "fire_whistle",
    source: "generated",
    title: "Manual fire/coach whistle (pealess warble)",
  });

  // Merge remaining catalog entries into manifest for completeness
  const have = new Set(manifest.map((m) => m.id));
  for (const s of catalog.sounds) {
    if (have.has(s.id)) continue;
    if (s.mixkit_id) {
      manifest.push({
        id: s.id,
        mixkit_id: s.mixkit_id,
        title: s.mixkit_title || s.name,
        url: s.mixkit_url || "",
      });
    } else if (String(s.path || "").endsWith(".wav")) {
      manifest.push({ id: s.id, source: "generated", title: s.attribution || s.name });
    }
  }

  fs.writeFileSync(SOUNDS_JSON, JSON.stringify(catalog, null, 2) + "\n");
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
  console.log("catalog + manifest updated");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
