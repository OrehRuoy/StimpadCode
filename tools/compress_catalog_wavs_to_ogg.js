/**
 * Convert catalog WAV sounds to high-quality OGG Vorbis (q=7 ≈ transparent for loops).
 * Masters kept in assets/audio/_wav_masters/ for restore / A-B check.
 * Updates data/sounds.json paths. Leaves MP3 untouched.
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const AUDIO = path.join(ROOT, "assets", "audio");
const MASTERS = path.join(AUDIO, "_wav_masters");
const SOUNDS_JSON = path.join(ROOT, "data", "sounds.json");
const VORBIS_Q = "7"; // 0–10; 7 is high quality / hard to hear artifacts

function findFfmpeg() {
  const which = spawnSync("where", ["ffmpeg"], { encoding: "utf8" });
  if (which.status === 0 && which.stdout.trim()) {
    return which.stdout.trim().split(/\r?\n/)[0];
  }
  return "ffmpeg";
}

function main() {
  const ffmpeg = findFfmpeg();
  const catalog = JSON.parse(fs.readFileSync(SOUNDS_JSON, "utf8"));
  fs.mkdirSync(MASTERS, { recursive: true });

  const converted = [];
  const skipped = [];
  let wavBytes = 0;
  let oggBytes = 0;

  for (const sound of catalog.sounds) {
    const p = String(sound.path || "");
    const m = p.match(/assets\/audio\/([^/]+\.wav)$/i);
    if (!m) {
      skipped.push(p);
      continue;
    }
    const wavName = m[1];
    const idBase = wavName.replace(/\.wav$/i, "");
    const wavPath = path.join(AUDIO, wavName);
    const oggName = `${idBase}.ogg`;
    const oggPath = path.join(AUDIO, oggName);
    const masterPath = path.join(MASTERS, wavName);

    if (!fs.existsSync(wavPath)) {
      console.error("Missing WAV:", wavPath);
      process.exit(1);
    }

    wavBytes += fs.statSync(wavPath).size;
    const r = spawnSync(
      ffmpeg,
      [
        "-y",
        "-i",
        wavPath,
        "-c:a",
        "libvorbis",
        "-q:a",
        VORBIS_Q,
        oggPath,
      ],
      { encoding: "utf8" }
    );
    if (r.status !== 0) {
      console.error(r.stderr || r.stdout);
      process.exit(1);
    }
    oggBytes += fs.statSync(oggPath).size;

    // Keep master for user A/B; remove shipping WAV + import.
    fs.copyFileSync(wavPath, masterPath);
    fs.unlinkSync(wavPath);
    const imp = wavPath + ".import";
    if (fs.existsSync(imp)) fs.unlinkSync(imp);

    sound.path = `res://assets/audio/${oggName}`;
    converted.push({
      id: sound.id,
      name: sound.name,
      from: wavName,
      to: oggName,
      wavMB: (fs.statSync(masterPath).size / 1e6).toFixed(2),
      oggMB: (fs.statSync(oggPath).size / 1e6).toFixed(2),
    });
  }

  fs.writeFileSync(SOUNDS_JSON, JSON.stringify(catalog, null, 2) + "\n");

  const reportPath = path.join(ROOT, "docs", "AUDIO_OGG_CONVERSION.md");
  const lines = [
    "# WAV → OGG conversion (high quality)",
    "",
    `Converted with ffmpeg libvorbis **-q:a ${VORBIS_Q}** (near-transparent for loops/ambience).`,
    "Original WAVs are in `assets/audio/_wav_masters/` (excluded from export).",
    "",
    `**Before:** ${(wavBytes / 1e6).toFixed(1)} MB WAV → **After:** ${(oggBytes / 1e6).toFixed(1)} MB OGG`,
    "",
    "## Spot-check these in the player",
    "",
    "| Id | Name | Was | Now | WAV MB | OGG MB |",
    "|----|------|-----|-----|--------|--------|",
  ];
  for (const c of converted) {
    lines.push(
      `| ${c.id} | ${c.name} | ${c.from} | ${c.to} | ${c.wavMB} | ${c.oggMB} |`
    );
  }
  lines.push("");
  lines.push(
    "To restore one sound: copy `_wav_masters/<file>.wav` back to `assets/audio/`, update that entry in `data/sounds.json` to `.wav`, delete the `.ogg`."
  );
  fs.writeFileSync(reportPath, lines.join("\n") + "\n");

  console.log(`Converted ${converted.length} WAV → OGG (q=${VORBIS_Q})`);
  console.log(
    `Size: ${(wavBytes / 1e6).toFixed(1)} MB → ${(oggBytes / 1e6).toFixed(1)} MB`
  );
  console.log("Report:", reportPath);
  converted.forEach((c) =>
    console.log(`  ${c.id}: ${c.from} → ${c.to} (${c.wavMB}→${c.oggMB} MB)`)
  );
}

main();
