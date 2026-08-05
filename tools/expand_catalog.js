#!/usr/bin/env node
/**
 * Expand StimPad catalog: specific names, popular stim gaps, safe retro-boot tones.
 * Boot tones are ORIGINAL synthesized jingles (not Nintendo/Sega/Sony rips).
 */
const fs = require("fs");
const path = require("path");
const https = require("https");

const ROOT = path.resolve(__dirname, "..");
const CATALOG = path.join(ROOT, "data", "sounds.json");
const AUDIO_DIR = path.join(ROOT, "assets", "audio");
const MANIFEST_OUT = path.join(ROOT, "data", "mixkit_manifest.json");

const RENAME = {
  police_siren: "Police Wail Siren",
  fire_whistle: "Manual Fire Whistle",
  school_bell: "School Hall Bell",
  vacuum: "Upright Vacuum Hum",
  white_noise: "White Noise Hiss",
  pen_click: "Ballpoint Pen Click",
  rain: "Steady Rain Loop",
  fan_hum: "Desk Fan Blow",
  ambulance_siren: "Ambulance Yelp Siren",
  fire_truck_siren: "Fire Engine Siren",
  tornado_siren: "Civil Defense Siren",
  alarm_clock: "Beeping Alarm Clock",
  smoke_alarm: "Smoke Detector Beep",
  doorbell: "Home Doorbell Chime",
  bicycle_bell: "Bike Handlebar Bell",
  wind_chimes: "Metal Wind Chimes",
  church_bell: "Church Tower Bell",
  washing_machine: "Front-Load Washer",
  dryer: "Clothes Dryer Tumbling",
  dishwasher: "Dishwasher Cycle",
  hair_dryer: "Blow Dryer Whine",
  blender: "Kitchen Blender Whirr",
  microwave_hum: "Microwave Hum",
  fridge_hum: "Refrigerator Hum",
  ac_hum: "Window AC Hum",
  keyboard_typing: "Mechanical Keyboard",
  light_switch: "Wall Light Switch",
  fidget_click: "Fidget Clicker",
  zipper: "Jacket Zipper Pull",
  bubble_wrap: "Bubble Wrap Pop",
  velcro: "Velcro Rip",
  train_horn: "Diesel Train Horn",
  car_horn: "Car Horn Honk",
  subway_rumble: "Subway Train Pass",
  thunder: "Thunder Crack Storm",
  shower: "Bathroom Shower Spray",
  tap_drip: "Faucet Water Drip",
  pink_noise: "Pink Noise Soft",
  brown_noise: "Brown Noise Deep",
  tv_static: "Analog TV Static",
  paper_crinkle: "Crumpled Paper",
  scissors_snip: "Scissors Snip",
  metronome: "Wooden Metronome Tick",
  dial_tone: "Phone Dial Tone",
  old_phone_ring: "Rotary Phone Ring",
  popcorn_pop: "Popcorn Kernel Pop",
  ice_crunch: "Crunching Ice Cubes",
  xylophone: "Toy Xylophone Notes",
  triangle_ting: "Orchestra Triangle",
};

/** New Mixkit sounds (verified CDN 200). */
const NEW_MIXKIT = {
  dog_bark: { id: 1, title: "Dog barking twice", name: "Dog Bark Twice", category: "Animals", mode: "oneshot", anim: "honk_red" },
  cat_purr: { id: 96, title: "Big wild cat long purr", name: "Cat Long Purr", category: "Animals", mode: "loop", anim: "glow_white" },
  cat_meow: { id: 93, title: "Sweet kitty meow", name: "Sweet Cat Meow", category: "Animals", mode: "oneshot", anim: "tap_teal" },
  ocean_waves: { id: 1196, title: "Sea waves loop", name: "Ocean Waves Loop", category: "Water", mode: "loop", anim: "ripple_blue" },
  clock_tick: { id: 1059, title: "Tick tock clock close up", name: "Wall Clock Tick-Tock", category: "Misc", mode: "loop", anim: "tick_wood" },
  campfire: { id: 1330, title: "Campfire crackles", name: "Campfire Crackles", category: "Nature", mode: "loop", anim: "pulse_orange" },
  lawn_mower: { id: 1919, title: "Mowing the lawn engine hum", name: "Lawn Mower Engine", category: "Household", mode: "loop", anim: "spin_gray" },
  electric_drill: { id: 855, title: "Electrical drill", name: "Electric Drill Whirr", category: "Tools", mode: "loop", anim: "spin_teal" },
  helicopter: { id: 2699, title: "Helicopter engine working close", name: "Helicopter Close Engine", category: "Vehicles", mode: "loop", anim: "spin_gray" },
  steam_train: { id: 1630, title: "Steam train passing", name: "Steam Train Passing", category: "Vehicles", mode: "loop", anim: "shake_gray" },
  motorcycle_idle: { id: 2721, title: "Motorcycle engine working", name: "Motorcycle Engine Idle", category: "Vehicles", mode: "loop", anim: "pulse_red" },
  chainsaw: { id: 796, title: "Cutting trees with chainsaw ambiance and axe hits", name: "Chainsaw Cutting", category: "Tools", mode: "loop", anim: "shake_gray" },
  construction_site: { id: 800, title: "Construction place and bulldozer ambiance", name: "Construction Site Ambience", category: "Tools", mode: "loop", anim: "shake_gray" },
  night_crickets: { id: 39, title: "Crickets and insects in the wild ambience", name: "Night Cricket Ambience", category: "Nature", mode: "loop", anim: "static_soft" },
  forest_insects: { id: 2414, title: "Night forest with insects", name: "Night Forest Insects", category: "Nature", mode: "loop", anim: "sway_teal" },
  heartbeat_slow: { id: 494, title: "Slow heartbeat", name: "Slow Heartbeat", category: "Misc", mode: "loop", anim: "pulse_red" },
  restaurant_crowd: { id: 444, title: "Restaurant crowd talking ambience", name: "Restaurant Crowd Chatter", category: "Misc", mode: "loop", anim: "static_soft" },
  oven_ding: { id: 1838, title: "Kitchen oven ding", name: "Kitchen Oven Ding", category: "Household", mode: "oneshot", anim: "ring_gold" },
  toaster_pop: { id: 1821, title: "Kitchen toaster pops", name: "Toaster Pop", category: "Household", mode: "oneshot", anim: "pop_yellow" },
  camera_shutter: { id: 1133, title: "Camera shutter click", name: "Camera Shutter Click", category: "Clicks", mode: "oneshot", anim: "flash_white" },
  flowing_water: { id: 3126, title: "Water flowing ambience loop", name: "Flowing Stream Water", category: "Water", mode: "loop", anim: "stream_blue" },
  morning_birds: { id: 2472, title: "Morning birds", name: "Morning Birdsong", category: "Nature", mode: "loop", anim: "sway_teal" },
  city_bus: { id: 2706, title: "Bus passing by in a city", name: "City Bus Pass-By", category: "Vehicles", mode: "oneshot", anim: "shake_gray" },
  coin_drop: { id: 2069, title: "Winning a coin, video game", name: "Arcade Coin Drop", category: "Retro", mode: "oneshot", anim: "ring_gold" },
  arcade_notify: { id: 211, title: "Retro arcade casino notification", name: "Arcade Cabinet Chime", category: "Retro", mode: "oneshot", anim: "note_rainbow" },
  retro_game_notify: { id: 212, title: "Retro game notification", name: "8-Bit Notify Beep", category: "Retro", mode: "oneshot", anim: "flash_white" },
  arcade_game_over: { id: 213, title: "Arcade retro game over", name: "Arcade Game-Over Tone", category: "Retro", mode: "oneshot", anim: "pulse_red" },
  ui_boot_start: { id: 2574, title: "Software interface start", name: "Device Power-On UI", category: "Retro", mode: "oneshot", anim: "pulse_blue" },
  os_loading_hum: { id: 2529, title: "Sci fi loading operative system", name: "OS Boot Loading Hum", category: "Retro", mode: "loop", anim: "spin_teal" },
  unlock_chime: { id: 253, title: "Unlock game notification", name: "Disc Console Unlock", category: "Retro", mode: "oneshot", anim: "ring_silver" },
  cassette_deck: { id: 2556, title: "Cassette player", name: "Cassette Deck Play", category: "Retro", mode: "oneshot", anim: "slide_gray" },
};

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

function writeWav(filePath, samples, sampleRate = 44100) {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    data.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(samples[i] * 32767))), i * 2);
  }
  const buf = Buffer.alloc(44 + data.length);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + data.length, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(data.length, 40);
  data.copy(buf, 44);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, buf);
}

/** Original chiptune-style boot jingles — unique melodies, not console trademarks. */
function synthBoot(kind) {
  const sr = 44100;
  const samples = [];
  const pushTone = (freq, start, dur, type = "square", vol = 0.22) => {
    for (let i = 0; i < Math.floor(dur * sr); i++) {
      const t = i / sr;
      const idx = Math.floor(start * sr) + i;
      while (samples.length <= idx) samples.push(0);
      const env = Math.min(1, t * 40) * Math.max(0, 1 - t / dur);
      let v;
      const phase = 2 * Math.PI * freq * t;
      if (type === "square") v = Math.sin(phase) > 0 ? 1 : -1;
      else if (type === "triangle") v = 2 * Math.abs(2 * ((freq * t) % 1) - 1) - 1;
      else v = Math.sin(phase);
      samples[idx] += v * vol * env;
    }
  };
  if (kind === "handheld_boot") {
    // Rising 5-note bright fanfare (original)
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    notes.forEach((f, i) => pushTone(f, 0.08 + i * 0.09, 0.12, "square", 0.2));
    pushTone(1568, 0.55, 0.35, "triangle", 0.18);
  } else if (kind === "home_console_boot") {
    // Soft triad swell then sparkle (original)
    pushTone(196, 0.0, 0.45, "triangle", 0.18);
    pushTone(246.94, 0.05, 0.4, "triangle", 0.14);
    pushTone(293.66, 0.1, 0.4, "sine", 0.16);
    pushTone(587.33, 0.55, 0.2, "square", 0.15);
    pushTone(880, 0.7, 0.35, "triangle", 0.17);
  } else if (kind === "arcade_boot") {
    // Punchy arcade-like but original intervals
    pushTone(440, 0.0, 0.1, "square", 0.22);
    pushTone(554.37, 0.1, 0.1, "square", 0.22);
    pushTone(659.25, 0.2, 0.1, "square", 0.22);
    pushTone(880, 0.35, 0.45, "square", 0.2);
  } else {
    // disc_boot: clean ascending chime
    [392, 523.25, 659.25, 783.99].forEach((f, i) => pushTone(f, 0.05 + i * 0.14, 0.28, "sine", 0.2));
  }
  // normalize
  let peak = 0.001;
  for (const s of samples) peak = Math.max(peak, Math.abs(s));
  return samples.map((s) => s / peak * 0.7);
}

const SYNTH_BOOTS = {
  handheld_boot: { name: "Handheld Console Boot", category: "Retro", mode: "oneshot", anim: "flash_white" },
  home_console_boot: { name: "Home Console Startup", category: "Retro", mode: "oneshot", anim: "pulse_blue" },
  arcade_boot_jingle: { name: "Arcade Cabinet Boot", category: "Retro", mode: "oneshot", anim: "note_rainbow" },
  disc_console_boot: { name: "Disc Console Startup", category: "Retro", mode: "oneshot", anim: "ring_silver" },
};

function entryFromNew(id, meta) {
  const isLoop = meta.mode === "loop";
  return {
    id,
    name: meta.name,
    category: meta.category,
    tier: "plus",
    mode: meta.mode,
    path: `res://assets/audio/${id}.mp3`,
    art: `res://assets/art/sounds/${id}.png`,
    animation: meta.anim,
    default_duration_sec: isLoop ? 60 : 0,
    license: "Mixkit License",
    attribution: "Mixkit",
  };
}

async function main() {
  const catalog = JSON.parse(fs.readFileSync(CATALOG, "utf8"));
  const byId = new Map(catalog.sounds.map((s) => [s.id, s]));

  for (const s of catalog.sounds) {
    if (RENAME[s.id]) s.name = RENAME[s.id];
  }

  const manifest = [];

  // Ensure existing audio still mapped in manifest from current fields
  for (const s of catalog.sounds) {
    if (s.mixkit_id) {
      manifest.push({
        id: s.id,
        mixkit_id: s.mixkit_id,
        title: s.mixkit_title || s.name,
        url: s.mixkit_url || `https://assets.mixkit.co/active_storage/sfx/${s.mixkit_id}/${s.mixkit_id}-preview.mp3`,
      });
    } else if (String(s.path || "").endsWith(".wav")) {
      manifest.push({ id: s.id, source: "generated" });
    }
  }

  for (const [id, meta] of Object.entries(NEW_MIXKIT)) {
    if (byId.has(id)) {
      byId.get(id).name = meta.name;
      continue;
    }
    const entry = entryFromNew(id, meta);
    const url = `https://assets.mixkit.co/active_storage/sfx/${meta.id}/${meta.id}-preview.mp3`;
    const dest = path.join(AUDIO_DIR, `${id}.mp3`);
    process.stdout.write(`DL ${id}... `);
    await download(url, dest);
    console.log("OK");
    entry.mixkit_id = meta.id;
    entry.mixkit_title = meta.title;
    entry.mixkit_url = url;
    catalog.sounds.push(entry);
    byId.set(id, entry);
    manifest.push({ id, mixkit_id: meta.id, title: meta.title, url });
  }

  for (const [id, meta] of Object.entries(SYNTH_BOOTS)) {
    if (byId.has(id)) {
      byId.get(id).name = meta.name;
      continue;
    }
    const wavPath = path.join(AUDIO_DIR, `${id}.wav`);
    writeWav(wavPath, synthBoot(id === "arcade_boot_jingle" ? "arcade_boot" : id.replace("_jingle", "")));
    console.log("SYNTH", id);
    const entry = {
      id,
      name: meta.name,
      category: meta.category,
      tier: "plus",
      mode: meta.mode,
      path: `res://assets/audio/${id}.wav`,
      art: `res://assets/art/sounds/${id}.png`,
      animation: meta.anim,
      default_duration_sec: 0,
      license: "Generated CC0",
      attribution: "",
    };
    catalog.sounds.push(entry);
    manifest.push({ id, source: "generated_boot" });
  }

  // Stable category order preference for UI
  const catOrder = [
    "Alarms",
    "Bells",
    "Household",
    "Clicks",
    "Vehicles",
    "Water",
    "Noise",
    "Nature",
    "Animals",
    "Tools",
    "Retro",
    "Misc",
  ];
  catalog.sounds.sort((a, b) => {
    const ca = catOrder.indexOf(a.category);
    const cb = catOrder.indexOf(b.category);
    if (ca !== cb) return (ca < 0 ? 99 : ca) - (cb < 0 ? 99 : cb);
    return a.name.localeCompare(b.name);
  });

  fs.writeFileSync(CATALOG, JSON.stringify(catalog, null, 2) + "\n");
  fs.writeFileSync(MANIFEST_OUT, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`Catalog now has ${catalog.sounds.length} sounds`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
