/**
 * Rebuild data/sounds.json from sound_art_map.csv using audio files on disk.
 * Then apply round-11b audio fixes (school/steam/drip) + name/attribution updates.
 */
const https = require("https");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const AUDIO = path.join(ROOT, "assets", "audio");
const CSV = path.join(ROOT, "data", "sound_art_map.csv");
const SOUNDS_JSON = path.join(ROOT, "data", "sounds.json");
const MANIFEST = path.join(ROOT, "data", "mixkit_manifest.json");
const TMP = path.join(AUDIO, "_tmp_fix11b");

const FFMPEG =
  process.env.FFMPEG ||
  "C:\\Users\\Ultima\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.2-full_build\\bin\\ffmpeg.exe";
const FFPROBE = FFMPEG.replace(/ffmpeg\.exe$/i, "ffprobe.exe");

const LOOP_IDS = new Set([
  "vacuum", "white_noise", "rain", "fan_hum", "washing_machine", "dryer", "dishwasher",
  "hair_dryer", "blender", "microwave_hum", "fridge_hum", "ac_hum", "keyboard_typing",
  "subway_rumble", "thunder", "shower", "tap_drip", "pink_noise", "brown_noise", "tv_static",
  "metronome", "dial_tone", "cat_purr", "ocean_waves", "clock_tick", "campfire", "lawn_mower",
  "electric_drill", "helicopter", "steam_train", "motorcycle_idle", "chainsaw", "construction_site",
  "night_crickets", "forest_insects", "heartbeat_slow", "restaurant_crowd", "flowing_water",
  "morning_birds", "os_loading_hum",
]);

const ANIM = {
  police_siren: "wail_red", fire_whistle: "whistle_red", school_bell: "swing_yellow",
  vacuum: "spin_gray", white_noise: "static_soft", pen_click: "tap_teal",
  rain: "ripple_blue", fan_hum: "spin_teal", ambulance_siren: "wail_red",
  fire_truck_siren: "wail_red", tornado_siren: "wail_amber", alarm_clock: "ring_gold",
  smoke_alarm: "beep_red", doorbell: "chime_gold", bicycle_bell: "ring_silver",
  wind_chimes: "sway_teal", church_bell: "swing_yellow", washing_machine: "spin_gray",
  dryer: "spin_gray", dishwasher: "stream_blue", hair_dryer: "spin_teal",
  blender: "spin_gray", microwave_hum: "hum_amber", fridge_hum: "hum_cyan",
  ac_hum: "hum_cyan", keyboard_typing: "tap_teal", light_switch: "click_white",
  fidget_click: "tap_teal", zipper: "slide_gray", bubble_wrap: "pop_yellow",
  velcro: "rip_teal", train_horn: "blast_yellow", car_horn: "honk_red",
  subway_rumble: "shake_gray", thunder: "flash_purple", shower: "stream_blue",
  tap_drip: "drip_cyan", pink_noise: "static_soft", brown_noise: "static_soft",
  tv_static: "static_soft", paper_crinkle: "crinkle_cream", scissors_snip: "snip_silver",
  metronome: "tick_wood", dial_tone: "hum_amber", old_phone_ring: "ring_gold",
  popcorn_pop: "pop_yellow", ice_crunch: "crunch_white", xylophone: "note_rainbow",
  triangle_ting: "ting_silver", dog_bark: "honk_red", cat_purr: "glow_white",
  cat_meow: "tap_teal", ocean_waves: "ripple_blue", clock_tick: "tick_wood",
  campfire: "pulse_orange", lawn_mower: "spin_gray", electric_drill: "spin_teal",
  helicopter: "spin_gray", steam_train: "shake_gray", motorcycle_idle: "pulse_red",
  chainsaw: "shake_gray", construction_site: "shake_gray", night_crickets: "static_soft",
  forest_insects: "sway_teal", heartbeat_slow: "pulse_red", restaurant_crowd: "static_soft",
  oven_ding: "ring_gold", toaster_pop: "pop_yellow", camera_shutter: "flash_white",
  flowing_water: "stream_blue", morning_birds: "sway_teal", city_bus: "shake_gray",
  coin_drop: "ring_gold", arcade_notify: "note_rainbow", retro_game_notify: "flash_white",
  arcade_game_over: "pulse_red", ui_boot_start: "pulse_blue", os_loading_hum: "spin_teal",
  unlock_chime: "ring_silver", cassette_deck: "slide_gray", handheld_boot: "flash_white",
  home_console_boot: "pulse_blue", arcade_boot_jingle: "note_rainbow",
  disc_console_boot: "ring_silver",
};

const NAME_OVERRIDES = {
  ocean_waves: "Ocean Waves",
  rain: "Rain",
  flowing_water: "Flowing Stream",
  thunder: "Thunder Storm",
  car_horn: "Car Horn",
};

function download(url, dest) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const file = fs.createWriteStream(dest);
    https
      .get(url, { headers: { "User-Agent": "StimPad/1.0" } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.close();
          fs.unlink(dest, () => {});
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

async function downloadBsb(id, dest) {
  const n = String(id);
  for (const url of [
    `https://bigsoundbank.com/UPLOAD/mp3/${n.padStart(4, "0")}.mp3`,
    `https://bigsoundbank.com/UPLOAD/mp3/${n}.mp3`,
  ]) {
    try {
      await download(url, dest);
      if (fs.statSync(dest).size > 1000) return url;
      fs.unlinkSync(dest);
    } catch (_) {}
  }
  throw new Error("bsb " + id);
}

function runFfmpeg(args) {
  const r = spawnSync(FFMPEG, ["-y", ...args], { encoding: "utf8" });
  if (r.status !== 0) throw new Error((r.stderr || "").slice(-1200));
}

function probe(file) {
  const r = spawnSync(
    FFPROBE,
    ["-v", "error", "-show_entries", "format=duration", "-of", "default=nk=1:nw=1", file],
    { encoding: "utf8" }
  );
  return Number(r.stdout.trim()) || 0;
}

function clearOther(id, keepExt) {
  for (const ext of ["mp3", "wav", "ogg"]) {
    if (ext === keepExt) continue;
    const p = path.join(AUDIO, `${id}.${ext}`);
    if (fs.existsSync(p)) fs.unlinkSync(p);
    if (fs.existsSync(p + ".import")) fs.unlinkSync(p + ".import");
  }
}

function resolveAudio(id, csvAudio) {
  const preferred = [csvAudio, `${id}.wav`, `${id}.mp3`, `${id}.ogg`];
  for (const name of preferred) {
    const p = path.join(AUDIO, name);
    if (fs.existsSync(p) && fs.statSync(p).size > 500) return name;
  }
  return csvAudio;
}

function parseCsv() {
  const text = fs.readFileSync(CSV, "utf8").trim();
  const lines = text.split(/\r?\n/).slice(1);
  const rows = [];
  for (const line of lines) {
    // id,"display",audio,art,tier,category
    const m = line.match(/^([^,]+),"(.*)",([^,]+),([^,]+),([^,]+),(.+)$/);
    if (!m) throw new Error("bad csv line: " + line);
    rows.push({
      id: m[1],
      name: m[2],
      audio: m[3],
      art: m[4],
      tier: m[5],
      category: m[6],
    });
  }
  return rows;
}

function rebuildCatalog() {
  const rows = parseCsv();
  const sounds = rows.map((r) => {
    const audioFile = resolveAudio(r.id, r.audio);
    const mode = LOOP_IDS.has(r.id) ? "loop" : "oneshot";
    const name = NAME_OVERRIDES[r.id] || r.name;
    return {
      id: r.id,
      name,
      category: r.category,
      tier: r.tier,
      mode,
      path: `res://assets/audio/${audioFile}`,
      art: `res://assets/art/sounds/${r.art}`,
      animation: ANIM[r.id] || "static_soft",
      default_duration_sec: mode === "loop" ? 60 : 0,
      license: "CC0",
      attribution: "",
      mixkit_id: 0,
      mixkit_title: "",
      mixkit_url: "",
    };
  });

  const catOrder = [
    "Alarms", "Bells", "Household", "Clicks", "Vehicles", "Water",
    "Noise", "Nature", "Animals", "Tools", "Retro", "Misc",
  ];
  sounds.sort((a, b) => {
    const ca = catOrder.indexOf(a.category);
    const cb = catOrder.indexOf(b.category);
    if (ca !== cb) return (ca < 0 ? 99 : ca) - (cb < 0 ? 99 : cb);
    return a.name.localeCompare(b.name);
  });

  fs.writeFileSync(SOUNDS_JSON, JSON.stringify({ version: 1, sounds }, null, 2) + "\n");
  console.log("Rebuilt catalog:", sounds.length, "sounds");
  return sounds;
}

function updateCatalog(id, meta, relPath) {
  const catalog = JSON.parse(fs.readFileSync(SOUNDS_JSON, "utf8"));
  const sound = catalog.sounds.find((s) => s.id === id);
  if (!sound) throw new Error("missing " + id);
  sound.path = relPath;
  if (meta.name) sound.name = meta.name;
  if (meta.mode) sound.mode = meta.mode;
  if (meta.mode === "loop") sound.default_duration_sec = 60;
  if (meta.mode === "oneshot") sound.default_duration_sec = 0;
  sound.license = meta.license || "CC0";
  sound.attribution = meta.note;
  sound.mixkit_id = meta.mixkit || 0;
  sound.mixkit_title = meta.mixkit_title || "";
  sound.mixkit_url = meta.mixkit_url || "";
  fs.writeFileSync(SOUNDS_JSON, JSON.stringify(catalog, null, 2) + "\n");

  let manifest = [];
  if (fs.existsSync(MANIFEST)) {
    const raw = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
    manifest = Array.isArray(raw) ? raw : raw.sounds || [];
  }
  manifest = manifest.filter((s) => s.id !== id);
  if (meta.mixkit) {
    manifest.push({
      id,
      mixkit_id: meta.mixkit,
      title: meta.title,
      url: `https://assets.mixkit.co/active_storage/sfx/${meta.mixkit}/${meta.mixkit}-preview.mp3`,
    });
  } else if (meta.bsb) {
    manifest.push({
      id,
      source: "bigsoundbank",
      bsb_id: String(meta.bsb),
      title: meta.title,
      url: `https://bigsoundbank.com/UPLOAD/mp3/${String(meta.bsb).padStart(4, "0")}.mp3`,
    });
  } else if (meta.freesound) {
    manifest.push({
      id,
      source: "freesound",
      freesound_id: String(meta.freesound),
      title: meta.title,
      url: meta.url,
    });
  }
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
}

function updateCsvAudio(id, audioFile) {
  let text = fs.readFileSync(CSV, "utf8");
  text = text.replace(
    new RegExp(`^${id},("[^"]+"),[^,]+,`, "m"),
    `${id},$1,${audioFile},`
  );
  // also name overrides in csv for consistency
  fs.writeFileSync(CSV, text);
}

async function main() {
  rebuildCatalog();
  fs.mkdirSync(TMP, { recursive: true });

  // SCHOOL — snip lead/tail dead air tightly
  {
    const id = "school_bell";
    console.log("==>", id);
    const url = "https://cdn.freesound.org/previews/217/217486_4017029-hq.mp3";
    const raw = path.join(TMP, "school.mp3");
    await download(url, raw);
    console.log("  raw", probe(raw).toFixed(2) + "s");
    const out = path.join(AUDIO, "school_bell.wav");
    // Start after quiet lead (~1.0s of dead air on prior file; raw starts earlier)
    runFfmpeg([
      "-i",
      raw,
      "-ss",
      "1.05",
      "-t",
      "6.4",
      "-af",
      "highpass=f=200,afade=t=in:st=0:d=0.015,afade=t=out:st=6.05:d=0.28,loudnorm=I=-11:TP=-1.2:LRA=9",
      "-ac",
      "1",
      "-ar",
      "44100",
      out,
    ]);
    clearOther(id, "wav");
    updateCatalog(
      id,
      {
        freesound: 217486,
        title: "Long school hall electric bell",
        note: "School hall electric bell, trimmed (Freesound #217486, CC0)",
        url,
        mode: "oneshot",
        name: "School Hall Bell",
      },
      `res://assets/audio/${id}.wav`
    );
    updateCsvAudio(id, "school_bell.wav");
    console.log("  out", probe(out).toFixed(2) + "s");
  }

  // CAR — dry BSB horn held
  {
    const id = "car_horn";
    console.log("==>", id);
    const raw = path.join(TMP, "car.mp3");
    await downloadBsb(258, raw);
    const held = path.join(TMP, "car_held.wav");
    runFfmpeg([
      "-i",
      raw,
      "-ss",
      "0.02",
      "-af",
      "highpass=f=120,lowpass=f=6500,asetrate=44100*0.55,aresample=44100," +
        "afade=t=in:st=0:d=0.015,afade=t=out:st=2.7:d=0.35,loudnorm=I=-9:TP=-1.0:LRA=6",
      "-t",
      "3.1",
      "-ac",
      "1",
      "-ar",
      "44100",
      held,
    ]);
    const out = path.join(AUDIO, "car_horn.mp3");
    runFfmpeg(["-i", held, "-b:a", "192k", out]);
    clearOther(id, "mp3");
    updateCatalog(
      id,
      {
        bsb: 258,
        title: "Recent car horn held",
        note: "Dry recent car horn held blast (BigSoundBank #0258, CC0)",
        mode: "oneshot",
        name: "Car Horn",
      },
      `res://assets/audio/${id}.mp3`
    );
    console.log("  out", probe(out).toFixed(2) + "s");
  }

  // STEAM — single Molli recording
  {
    const id = "steam_train";
    console.log("==>", id);
    const url = "https://cdn.freesound.org/previews/277/277496_5339600-hq.mp3";
    const raw = path.join(TMP, "molli.mp3");
    await download(url, raw);
    const out = path.join(AUDIO, "steam_train.wav");
    runFfmpeg([
      "-i",
      raw,
      "-ss",
      "2.2",
      "-t",
      "40",
      "-af",
      "highpass=f=40,afade=t=in:st=0:d=0.25,afade=t=out:st=39.3:d=0.6,loudnorm=I=-14:TP=-1.5:LRA=12",
      "-ac",
      "1",
      "-ar",
      "44100",
      out,
    ]);
    clearOther(id, "wav");
    updateCatalog(
      id,
      {
        freesound: 277496,
        title: "Steam-Train Molli with whistle",
        note: "Steam locomotive Molli pass with whistle (Freesound #277496, CC0)",
        url,
        mode: "loop",
        name: "Steam Train Passing",
      },
      `res://assets/audio/${id}.wav`
    );
    updateCsvAudio(id, "steam_train.wav");
    console.log("  out", probe(out).toFixed(2) + "s");
  }

  // DRIP — BSB 1384 CC0
  {
    const id = "tap_drip";
    console.log("==>", id);
    const raw = path.join(TMP, "drip.mp3");
    await downloadBsb(1384, raw);
    const clean = path.join(TMP, "drip_clean.wav");
    runFfmpeg([
      "-i",
      raw,
      "-ss",
      "0.2",
      "-t",
      "18",
      "-af",
      "highpass=f=400,lowpass=f=7500,agate=threshold=0.028:ratio=10:attack=3:release=90:makeup=3,loudnorm=I=-15:TP=-2.0:LRA=9",
      "-ac",
      "1",
      "-ar",
      "44100",
      clean,
    ]);
    const out = path.join(AUDIO, "tap_drip.wav");
    runFfmpeg([
      "-stream_loop",
      "-1",
      "-i",
      clean,
      "-t",
      "36",
      "-af",
      "afade=t=in:st=0:d=0.1,afade=t=out:st=35.5:d=0.4,loudnorm=I=-15:TP=-2.0:LRA=9",
      "-ac",
      "1",
      "-ar",
      "44100",
      out,
    ]);
    clearOther(id, "wav");
    updateCatalog(
      id,
      {
        bsb: 1384,
        title: "Drops of water #1",
        note: "Leaky faucet drip / water drops (BigSoundBank #1384, CC0)",
        mode: "loop",
        name: "Faucet Water Drip",
      },
      `res://assets/audio/${id}.wav`
    );
    updateCsvAudio(id, "tap_drip.wav");
    console.log("  out", probe(out).toFixed(2) + "s");
  }

  // SHOWER path if wav exists
  {
    const id = "shower";
    const wav = path.join(AUDIO, "shower.wav");
    const mp3 = path.join(AUDIO, "shower.mp3");
    if (fs.existsSync(wav)) {
      updateCatalog(
        id,
        {
          freesound: 802544,
          title: "Shower Running",
          note: "Bathroom shower running (Freesound #802544, CC0)",
          url: "https://cdn.freesound.org/previews/802/802544_14426029-hq.mp3",
          mode: "loop",
          name: "Bathroom Shower Spray",
        },
        `res://assets/audio/${id}.wav`
      );
      updateCsvAudio(id, "shower.wav");
      console.log("catalog shower", probe(wav).toFixed(2) + "s");
    } else if (fs.existsSync(mp3)) {
      console.log("shower mp3 only");
    }
  }

  // TRAIN HORN
  {
    const id = "train_horn";
    const p = path.join(AUDIO, "train_horn.mp3");
    if (fs.existsSync(p)) {
      updateCatalog(
        id,
        {
          freesound: 591808,
          title: "Train horn at railroad crossing",
          note: "Diesel train horn at railroad crossing (Freesound #591808, CC0)",
          url: "https://cdn.freesound.org/previews/591/591808_6456158-hq.mp3",
          mode: "oneshot",
          name: "Diesel Train Horn",
        },
        `res://assets/audio/${id}.mp3`
      );
      console.log("catalog train_horn", probe(p).toFixed(2) + "s");
    }
  }

  // THUNDER — rebuild long bed if needed
  {
    const id = "thunder";
    console.log("==>", id);
    const rainUrl = "https://assets.mixkit.co/active_storage/sfx/2402/2402-preview.mp3";
    const boomUrl = "https://assets.mixkit.co/active_storage/sfx/1300/1300-preview.mp3";
    const rainRaw = path.join(TMP, "rain.mp3");
    const boomRaw = path.join(TMP, "boom.mp3");
    await download(rainUrl, rainRaw);
    await download(boomUrl, boomRaw);
    const rainBed = path.join(TMP, "rain_bed.wav");
    runFfmpeg([
      "-i",
      rainRaw,
      "-af",
      "loudnorm=I=-17:TP=-2.0:LRA=9,volume=1.05",
      "-ac",
      "1",
      "-ar",
      "44100",
      rainBed,
    ]);
    const boom = path.join(TMP, "boom.wav");
    runFfmpeg([
      "-i",
      boomRaw,
      "-af",
      "loudnorm=I=-7:TP=-0.6:LRA=7,volume=1.55",
      "-ac",
      "1",
      "-ar",
      "44100",
      boom,
    ]);
    const delays = [2500, 11000, 19500, 31000, 42000];
    const vols = [1.35, 1.55, 1.25, 1.65, 1.4];
    const boomInputs = delays.map(() => ["-i", boom]).flat();
    const boomFilters = delays
      .map((d, i) => `[${i + 1}:a]adelay=${d}|${d},volume=${vols[i]}[b${i}]`)
      .join(";");
    const mixLabels = delays.map((_, i) => `[b${i}]`).join("");
    const scene = path.join(TMP, "tstorm.wav");
    const rainDur = probe(rainRaw);
    runFfmpeg([
      "-i",
      rainBed,
      ...boomInputs,
      "-filter_complex",
      `[0:a]volume=1.05[r];${boomFilters};[r]${mixLabels}amix=inputs=${
        1 + delays.length
      }:duration=first:dropout_transition=2,loudnorm=I=-11:TP=-0.8:LRA=12[out]`,
      "-map",
      "[out]",
      "-ac",
      "1",
      "-ar",
      "44100",
      "-t",
      String(Math.min(rainDur, 52)),
      scene,
    ]);
    const out = path.join(AUDIO, "thunder.wav");
    const sd = probe(scene);
    const fadeAt = Math.max(sd - 0.8, sd * 0.95);
    runFfmpeg([
      "-i",
      scene,
      "-af",
      `afade=t=in:st=0:d=0.5,afade=t=out:st=${fadeAt.toFixed(2)}:d=0.7,loudnorm=I=-11:TP=-0.8:LRA=12`,
      "-ac",
      "1",
      "-ar",
      "44100",
      out,
    ]);
    clearOther(id, "wav");
    updateCatalog(
      id,
      {
        mixkit: 2402,
        mixkit_title: "Thunderstorm and rain",
        mixkit_url: rainUrl,
        title: "Long thunderstorm with loud cracks",
        note: "Thunderstorm rain with irregular loud thunder (Mixkit #2402 + #1300)",
        mode: "loop",
        name: "Thunder Storm",
        license: "Mixkit License",
      },
      `res://assets/audio/${id}.wav`
    );
    updateCsvAudio(id, "thunder.wav");
    console.log("  out", probe(out).toFixed(2) + "s");
  }

  // Final name overrides on CSV display names
  let csv = fs.readFileSync(CSV, "utf8");
  csv = csv
    .replace(/ocean_waves,"Ocean Waves Loop"/, 'ocean_waves,"Ocean Waves"')
    .replace(/rain,"Steady Rain Loop"/, 'rain,"Rain"')
    .replace(/flowing_water,"Flowing Stream Water"/, 'flowing_water,"Flowing Stream"')
    .replace(/thunder,"Thunder Crack Storm"/, 'thunder,"Thunder Storm"')
    .replace(/car_horn,"Car Horn Honk"/, 'car_horn,"Car Horn"');
  fs.writeFileSync(CSV, csv);

  // Re-sync names in sounds.json from overrides
  const catalog = JSON.parse(fs.readFileSync(SOUNDS_JSON, "utf8"));
  for (const [id, name] of Object.entries(NAME_OVERRIDES)) {
    const s = catalog.sounds.find((x) => x.id === id);
    if (s) s.name = name;
  }
  fs.writeFileSync(SOUNDS_JSON, JSON.stringify(catalog, null, 2) + "\n");

  try {
    fs.rmSync(TMP, { recursive: true, force: true });
  } catch (_) {}
  console.log("\nDone. Catalog sounds:", catalog.sounds.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
