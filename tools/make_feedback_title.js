/**
 * Render a transparent "Feedback" title using Nunito — no baked backgrounds.
 */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.join(__dirname, "..");
const FONT = path.join(ROOT, "assets", "fonts", "Nunito.ttf");
const OUT = path.join(ROOT, "assets", "ui", "title_feedback.png");

async function main() {
  const fontB64 = fs.readFileSync(FONT).toString("base64");
  const w = 900;
  const h = 200;
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <defs>
    <style type="text/css"><![CDATA[
      @font-face {
        font-family: 'Nunito';
        src: url(data:font/ttf;base64,${fontB64}) format('truetype');
        font-weight: 800;
      }
      .word {
        font-family: 'Nunito', 'Segoe UI', Arial, sans-serif;
        font-weight: 800;
        font-size: 96px;
      }
    ]]></style>
  </defs>
  <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" class="word">
    <tspan fill="#5ECFB0">F</tspan><tspan fill="#F4F0E8">eedback</tspan>
  </text>
  <path d="M 290 138 Q 450 158 610 136" fill="none" stroke="#5ECFB0" stroke-width="7" stroke-linecap="round"/>
</svg>`;

  await sharp(Buffer.from(svg)).png().toFile(OUT);

  const { data, info } = await sharp(OUT).ensureAlpha().raw().toBuffer({
    resolveWithObject: true,
  });
  let t = 0;
  let o = 0;
  let blackOpaque = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 12) t++;
    else {
      o++;
      if (data[i] < 12 && data[i + 1] < 12 && data[i + 2] < 12) blackOpaque++;
    }
  }
  console.log(
    "wrote",
    OUT,
    info.width + "x" + info.height,
    "trans",
    t,
    "opaque",
    o,
    "blackOpaque",
    blackOpaque
  );

  // Crop to content with padding
  let minX = info.width,
    minY = info.height,
    maxX = 0,
    maxY = 0;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] > 20) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  const pad = 16;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(info.width - 1, maxX + pad);
  maxY = Math.min(info.height - 1, maxY + pad);
  const tmp = OUT + ".tmp.png";
  await sharp(OUT)
    .extract({
      left: minX,
      top: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    })
    .png()
    .toFile(tmp);
  fs.renameSync(tmp, OUT);
  console.log("cropped", maxX - minX + 1 + "x" + (maxY - minY + 1));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
