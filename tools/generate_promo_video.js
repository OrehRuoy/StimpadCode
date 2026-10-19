/**
 * Build a vertical StimPad launch promo from store/Videos screen recordings.
 * Output: store/Videos/StimPad_promo.mp4  (1080×1920)
 */
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const VDIR = path.join(ROOT, 'store', 'Videos');
const ASSETS = path.join(VDIR, '_assets');
const BUILD = path.join(VDIR, '_build');
const FONT = path.join(ROOT, 'assets', 'fonts', 'Nunito.ttf');
const WORDMARK = path.join(ROOT, 'assets', 'branding', 'logo_wordmark.png');
const BADGE_SVG = path.join(ASSETS, 'appstore_white.svg');

const W = 1080;
const H = 1920;
const FPS = 60;
const FADE = 0.25;

const CLIPS = {
  c1: path.join(VDIR, 'ScreenRecording_08-14-2026 12-36-33_1.mp4'),
  c2: path.join(VDIR, 'ScreenRecording_08-14-2026 12-37-42_1.mp4'),
  c3: path.join(VDIR, 'ScreenRecording_08-14-2026 12-38-40_1.mp4'),
  c4: path.join(VDIR, 'ScreenRecording_08-14-2026 12-39-35_1.mp4'),
  c5: path.join(VDIR, 'ScreenRecording_08-14-2026 12-40-36_1.mp4'),
  c6: path.join(VDIR, 'ScreenRecording_08-14-2026 12-41-47_1.mp4'),
  c7: path.join(VDIR, 'ScreenRecording_08-14-2026 12-42-39_1.mp4'),
};

/** 30s cut — StimPad_promo.mp4 */
const SEGMENTS_30 = [
  { id: '01_splash', src: 'c1', ss: 0.18, t: 2.05, caption: null },
  { id: '02_grid', src: 'c1', ss: 3.85, t: 3.55, caption: '70+ sounds' },
  { id: '03_cats', src: 'c2', ss: 2.45, t: 3.35, caption: 'Find your sound' },
  { id: '04_rain', src: 'c3', ss: 0.55, t: 5.35, caption: 'Instant calm' },
  { id: '05_pen', src: 'c4', ss: 0.90, t: 3.40, caption: null },
  { id: '06_pitch', src: 'c5', ss: 1.20, t: 4.40, caption: 'Tune it your way' },
  { id: '07_favs', src: 'c6', ss: 5.85, t: 2.55, caption: 'Your favorites' },
  { id: '08_settings', src: 'c7', ss: 3.90, t: 3.40, caption: null },
  { id: '09_end', src: 'endcard', ss: 0, t: 4.40, caption: null },
];

/** 15s Shorts cut — splash, grid, rain, pen, pitch, App Store. */
const SEGMENTS_15 = [
  { id: 's01_splash', src: 'c1', ss: 0.18, t: 1.40, caption: null },
  { id: 's02_grid', src: 'c1', ss: 3.90, t: 2.45, caption: '70+ sounds' },
  { id: 's03_rain', src: 'c3', ss: 0.55, t: 3.70, caption: 'Instant calm' },
  { id: 's04_pen', src: 'c4', ss: 0.90, t: 2.15, caption: null },
  { id: 's05_pitch', src: 'c5', ss: 2.40, t: 2.15, caption: 'Tune it your way' },
  { id: 's06_end', src: 'endcard', ss: 0, t: 4.40, caption: null },
];

function ff(...args) {
  const r = spawnSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-stats', ...args], {
    stdio: ['ignore', 'inherit', 'inherit'],
    windowsHide: true,
  });
  if (r.status !== 0) {
    throw new Error(`ffmpeg failed (${r.status}): ${args.slice(-4).join(' ')}`);
  }
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function fontFace() {
  const b64 = fs.readFileSync(FONT).toString('base64');
  return `@font-face{font-family:'NunitoEmbed';src:url('data:font/ttf;base64,${b64}');}`;
}

async function makeCaptionPng(text, filename) {
  const svg = Buffer.from(`
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <style>
    ${fontFace()}
    .cap { font-family: NunitoEmbed, sans-serif; font-weight: 800; font-size: 54px; fill: #F4F0E6; }
  </style>
  <defs>
    <linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#05080C" stop-opacity="0"/>
      <stop offset="45%" stop-color="#05080C" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#05080C" stop-opacity="0.82"/>
    </linearGradient>
  </defs>
  <rect x="0" y="${H - 340}" width="${W}" height="340" fill="url(#scrim)"/>
  <text class="cap" x="540" y="1768" text-anchor="middle">${esc(text)}</text>
  <rect x="470" y="1790" width="140" height="6" rx="3" fill="#5ECF80"/>
</svg>`);
  const out = path.join(BUILD, filename);
  await sharp(svg).png().toFile(out);
  return out;
}

async function makeEndcard() {
  const badgePng = path.join(ASSETS, 'appstore_white.png');
  await sharp(BADGE_SVG)
    .resize({ width: 720, kernel: sharp.kernel.lanczos3 })
    .png()
    .toFile(badgePng);

  const logo = await sharp(WORDMARK)
    .resize({ width: 820, kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();
  const logoMeta = await sharp(logo).metadata();

  const svg = Buffer.from(`
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <style>
    ${fontFace()}
    .get { font-family: NunitoEmbed, sans-serif; font-weight: 800; font-size: 52px; fill: #F4F0E6; }
    .sub { font-family: NunitoEmbed, sans-serif; font-weight: 600; font-size: 26px; fill: #8AA0B4; }
  </style>
  <defs>
    <radialGradient id="glow" cx="50%" cy="42%" r="55%">
      <stop offset="0%" stop-color="#1A3D38" stop-opacity="0.95"/>
      <stop offset="55%" stop-color="#0B1220" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="#05080C" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="#070A0F"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <text class="get" x="540" y="1210" text-anchor="middle">Get it now</text>
</svg>`);

  const bg = await sharp(svg).png().toBuffer();
  const badge = await sharp(badgePng).toBuffer();
  const badgeMeta = await sharp(badge).metadata();

  const logoLeft = Math.round((W - logoMeta.width) / 2);
  const logoTop = 620;
  const badgeLeft = Math.round((W - badgeMeta.width) / 2);
  const badgeTop = 1290;

  const endPng = path.join(BUILD, 'endcard.png');
  await sharp(bg)
    .composite([
      { input: logo, left: logoLeft, top: logoTop },
      { input: badge, left: badgeLeft, top: badgeTop },
    ])
    .png()
    .toFile(endPng);
  return endPng;
}

function cropFilter() {
  // Hide iOS status bar (SOS / recording pill) and the ad banner, then fill 9:16.
  return [
    'crop=750:1188:0:48',
    `scale=${W}:${H}:force_original_aspect_ratio=increase:flags=lanczos`,
    `crop=${W}:${H}`,
    'setsar=1',
    `fps=${FPS}`,
    'format=yuv420p',
  ].join(',');
}

function audioFilter(dur) {
  const fadeOutStart = Math.max(0, dur - 0.14).toFixed(3);
  return [
    'aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo',
    'afade=t=in:st=0:d=0.12',
    `afade=t=out:st=${fadeOutStart}:d=0.14`,
  ].join(',');
}

function renderSegment(seg, captionPng, isFirst) {
  const dest = path.join(BUILD, `${seg.id}.mp4`);
  if (seg.src === 'endcard') {
    ff(
      '-loop', '1', '-framerate', String(FPS), '-i', path.join(BUILD, 'endcard.png'),
      '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo',
      '-t', String(seg.t),
      '-vf', `format=yuv420p,setsar=1`,
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
      '-shortest',
      dest,
    );
    return dest;
  }

  const intro = isFirst ? ',fade=t=in:st=0:d=0.35' : '';
  // -ss/-t must sit on the movie input. If they land before a second -i
  // (caption PNG), ffmpeg applies them to that still and encodes the
  // entire screen recording.
  const args = [
    '-ss', String(seg.ss),
    '-t', String(seg.t),
    '-i', CLIPS[seg.src],
  ];
  if (captionPng) {
    args.push('-loop', '1', '-t', String(seg.t), '-i', captionPng);
    args.push(
      '-filter_complex',
      `[0:v]${cropFilter()}${intro}[v];[1:v]format=rgba[c];[v][c]overlay=0:0:format=auto[vout]`,
      '-map', '[vout]',
      '-map', '0:a',
    );
  } else {
    args.push('-vf', `${cropFilter()}${intro}`);
  }
  args.push(
    '-af', audioFilter(seg.t),
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
    '-t', String(seg.t),
    dest,
  );
  ff(...args);
  return dest;
}

function probeDuration(file) {
  const r = spawnSync(
    'ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nk=1:nw=1', file],
    { encoding: 'utf8', windowsHide: true },
  );
  const n = parseFloat(String(r.stdout).trim());
  if (!Number.isFinite(n)) throw new Error(`Could not probe duration: ${file}`);
  return n;
}

function concatWithXfade(files, outPath) {
  const n = files.length;
  const durations = files.map(probeDuration);
  console.log('Segment durations:', durations.map((d) => d.toFixed(2)).join(', '));
  const inputs = [];
  files.forEach((f) => inputs.push('-i', f));

  let filter = '';
  for (let i = 0; i < n; i++) {
    filter += `[${i}:v]settb=AVTB,fps=${FPS},format=yuv420p[v${i}];`;
    filter += `[${i}:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo[a${i}];`;
  }

  let prevV = 'v0';
  let prevA = 'a0';
  let acc = durations[0];
  for (let i = 1; i < n; i++) {
    const offset = (acc - FADE).toFixed(3);
    const outV = i === n - 1 ? 'vout' : `vx${i}`;
    const outA = i === n - 1 ? 'aout' : `ax${i}`;
    filter += `[${prevV}][v${i}]xfade=transition=fade:duration=${FADE}:offset=${offset}[${outV}];`;
    filter += `[${prevA}][a${i}]acrossfade=d=${FADE}:c1=tri:c2=tri[${outA}];`;
    prevV = outV;
    prevA = outA;
    acc += durations[i] - FADE;
  }

  ff(
    ...inputs,
    '-filter_complex', filter,
    '-map', '[vout]',
    '-map', '[aout]',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
    '-movflags', '+faststart',
    outPath,
  );
  return acc;
}

async function main() {
  const short = process.argv.includes('--15');
  const SEGMENTS = short ? SEGMENTS_15 : SEGMENTS_30;
  const outPath = path.join(VDIR, short ? 'StimPad_promo_15s.mp4' : 'StimPad_promo.mp4');

  fs.mkdirSync(BUILD, { recursive: true });
  fs.mkdirSync(ASSETS, { recursive: true });

  console.log(short ? '15s Shorts cut…' : '30s cut…');
  console.log('End card…');
  await makeEndcard();

  const files = [];
  for (const seg of SEGMENTS) {
    let cap = null;
    if (seg.caption) {
      cap = await makeCaptionPng(seg.caption, `${seg.id}_cap.png`);
    }
    console.log(`Clip ${seg.id}  (${seg.t.toFixed(2)}s)`);
    files.push(renderSegment(seg, cap, files.length === 0));
  }

  console.log('Concat…');
  const total = concatWithXfade(files, outPath);
  console.log(`Wrote ${outPath}`);
  console.log(`Duration ~${total.toFixed(1)}s`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
