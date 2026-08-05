/**
 * Delete ONLY obsolete audio leftovers:
 * - temp/_tmp_* folders and files
 * - alternate extensions for an id when catalog points at a different current file
 * NEVER deletes the file currently referenced by sounds.json
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const AUDIO = path.join(ROOT, "assets", "audio");
const SOUNDS_JSON = path.join(ROOT, "data", "sounds.json");

function main() {
  const catalog = JSON.parse(fs.readFileSync(SOUNDS_JSON, "utf8"));
  const needed = new Set();
  for (const s of catalog.sounds) {
    const p = String(s.path || "");
    const m = p.match(/assets\/audio\/(.+)$/);
    if (m) needed.add(m[1]);
  }

  const deleted = [];
  const kept = [];

  // Remove temp dirs/files
  for (const name of fs.readdirSync(AUDIO)) {
    const full = path.join(AUDIO, name);
    if (name.startsWith("_tmp") || name.startsWith("_school") || name.startsWith("_probe")) {
      fs.rmSync(full, { recursive: true, force: true });
      deleted.push(name + " (temp)");
      continue;
    }
  }

  const files = fs.readdirSync(AUDIO).filter((f) => /\.(mp3|wav|ogg)$/i.test(f));
  const byId = {};
  for (const f of files) {
    const id = f.replace(/\.(mp3|wav|ogg)$/i, "");
    byId[id] = byId[id] || [];
    byId[id].push(f);
  }

  for (const [id, arr] of Object.entries(byId)) {
    const current = arr.find((f) => needed.has(f));
    if (!current) {
      // Not in catalog at all — leave alone unless clearly temp (already handled)
      // Do NOT delete unknown ids; they might be pending catalog entries.
      for (const f of arr) kept.push(f + " (uncatalogued, kept)");
      continue;
    }
    for (const f of arr) {
      if (f === current) {
        kept.push(f);
        continue;
      }
      // obsolete alternate extension for same id
      const full = path.join(AUDIO, f);
      fs.unlinkSync(full);
      deleted.push(f + " (old ext; current=" + current + ")");
      const imp = full + ".import";
      if (fs.existsSync(imp)) fs.unlinkSync(imp);
    }
  }

  console.log("CURRENT kept:", kept.filter((k) => !k.includes("uncatalogued")).length);
  console.log("DELETED:");
  deleted.forEach((d) => console.log(" ", d));
  console.log("UNCATALOGUED kept:");
  kept.filter((k) => k.includes("uncatalogued")).forEach((d) => console.log(" ", d));
}

main();
