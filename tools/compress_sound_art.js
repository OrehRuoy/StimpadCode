/**
 * Resize sound tile/player art to 512×512 and switch Godot import to Lossy WebP.
 * Affects assets/art/sounds/* only (home tiles + player share these).
 */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.join(__dirname, "..");
const ART_DIR = path.join(ROOT, "assets", "art", "sounds");
const SIZE = 512;
const LOSSY_QUALITY = 0.85; // Godot Lossy WebP quality (0–1)

function patchImport(importPath) {
  if (!fs.existsSync(importPath)) return;
  let text = fs.readFileSync(importPath, "utf8");
  text = text.replace(/compress\/mode=\d+/g, "compress/mode=1");
  text = text.replace(
    /compress\/lossy_quality=[0-9.]+/g,
    `compress/lossy_quality=${LOSSY_QUALITY}`
  );
  fs.writeFileSync(importPath, text);
}

async function main() {
  const files = fs
    .readdirSync(ART_DIR)
    .filter((f) => /\.png$/i.test(f))
    .sort();
  let before = 0;
  let after = 0;
  const changed = [];
  for (const name of files) {
    const full = path.join(ART_DIR, name);
    before += fs.statSync(full).size;
    const buf = await sharp(full)
      .resize(SIZE, SIZE, { fit: "cover", withoutEnlargement: false })
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toBuffer();
    fs.writeFileSync(full, buf);
    after += buf.length;
    patchImport(full + ".import");
    changed.push(name);
  }
  console.log(
    `Resized ${changed.length} art files to ${SIZE}×512, import→Lossy@${LOSSY_QUALITY}`
  );
  console.log(
    `Size: ${(before / 1e6).toFixed(1)} MB → ${(after / 1e6).toFixed(1)} MB`
  );
  console.log("Files:");
  changed.forEach((n) => console.log(" ", n));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
