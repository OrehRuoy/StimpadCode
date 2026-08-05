const sharp = require("sharp");
const path = require("path");

const UI = path.join(__dirname, "..", "assets", "ui");
const size = 512;

// Standard Material-style heart path (24x24), scaled + centered into 512
function heartD(scale, ox, oy) {
  // Original viewBox 0 0 24 24 path:
  // M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z
  const s = scale;
  const x = (v) => (v * s + ox).toFixed(2);
  const y = (v) => (v * s + oy).toFixed(2);
  return [
    `M${x(12)} ${y(21.35)}`,
    `l${(-1.45 * s).toFixed(2)} ${(-1.32 * s).toFixed(2)}`,
    `C${x(5.4)} ${y(15.36)}, ${x(2)} ${y(12.28)}, ${x(2)} ${y(8.5)}`,
    `C${x(2)} ${y(5.42)}, ${x(4.42)} ${y(3)}, ${x(7.5)} ${y(3)}`,
    `c${(1.74 * s).toFixed(2)} 0 ${(3.41 * s).toFixed(2)} ${(0.81 * s).toFixed(2)} ${(4.5 * s).toFixed(2)} ${(2.09 * s).toFixed(2)}`,
    `C${x(13.09)} ${y(3.81)}, ${x(14.76)} ${y(3)}, ${x(16.5)} ${y(3)}`,
    `C${x(19.58)} ${y(3)}, ${x(22)} ${y(5.42)}, ${x(22)} ${y(8.5)}`,
    `c0 ${(3.78 * s).toFixed(2)} ${(-3.4 * s).toFixed(2)} ${(6.86 * s).toFixed(2)} ${(-8.55 * s).toFixed(2)} ${(11.54 * s).toFixed(2)}`,
    `L${x(12)} ${y(21.35)}z`,
  ].join(" ");
}

(async () => {
  const scale = 16.5;
  const ox = (512 - 24 * scale) / 2;
  const oy = (512 - 24 * scale) / 2 - 8;
  const d = heartD(scale, ox, oy);

  const onSvg = `<?xml version="1.0"?>
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="g" cx="38%" cy="32%" r="65%">
      <stop offset="0%" stop-color="#FF9585"/>
      <stop offset="55%" stop-color="#FF6B5B"/>
      <stop offset="100%" stop-color="#D9433A"/>
    </radialGradient>
  </defs>
  <path d="${d}" fill="url(#g)"/>
</svg>`;

  const offSvg = `<?xml version="1.0"?>
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="s" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#A6F6E2"/>
      <stop offset="100%" stop-color="#3DBFA3"/>
    </linearGradient>
  </defs>
  <path d="${d}" fill="none" stroke="url(#s)" stroke-width="28" stroke-linejoin="round" stroke-linecap="round"/>
</svg>`;

  await sharp(Buffer.from(onSvg)).png().toFile(path.join(UI, "icon_favorite_on.png"));
  await sharp(Buffer.from(offSvg)).png().toFile(path.join(UI, "icon_favorite_off.png"));
  console.log("hearts written", d.slice(0, 80));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
