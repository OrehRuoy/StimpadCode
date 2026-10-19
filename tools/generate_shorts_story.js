/**
 * Story-first YouTube Shorts cut.
 * Chaos (too loud) → one tap → rain → real StimPad footage → App Store end card.
 * Output: store/Videos/StimPad_shorts_story.mp4  (1080×1920)
 *         store/Videos/StimPad_shorts_story_thumb.png + .jpg
 */
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const VDIR = path.join(ROOT, 'store', 'Videos');
const STORY = path.join(VDIR, '_story');
const ASSETS = path.join(VDIR, '_assets');
const BUILD = path.join(VDIR, '_build_story');
const AUDIO = path.join(ROOT, 'assets', 'audio');
const FONT = path.join(ROOT, 'assets', 'fonts', 'Nunito.ttf');
const WORDMARK = path.join(ROOT, 'assets', 'branding', 'logo_wordmark.png');
const ICON = path.join(ROOT, 'assets', 'branding', 'icon_1024.png');
const BADGE_SVG = path.join(ASSETS, 'appstore_white.svg');

const W = 1080;
const H = 1920;
const FPS = 60;

const CLIPS = {
  rain: path.join(VDIR, 'ScreenRecording_08-14-2026 12-38-40_1.mp4'),
  pen: path.join(VDIR, 'ScreenRecording_08-14-2026 12-39-35_1.mp4'),
};

const T = {
  cafe: 0.75,
  crowd: 0.70,
  siren: 0.72,
  black: 0.16,
  tap: 0.90,
  rainStill: 3.25,
  appRain: 3.85,
  appPen: 2.65,
  end: 4.20,
};

function tapAt() {
  return T.cafe + T.crowd + T.siren + T.black;
}
function rainAt() {
  return tapAt() + T.tap;
}
function appRainAt() {
  return rainAt() + T.rainStill;
}
function appPenAt() {
  return appRainAt() + T.appRain;
}
function endAt() {
  return appPenAt() + T.appPen;
}
function totalDur() {
  return endAt() + T.end;
}

function ff(...args) {
  const r = spawnSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-stats', ...args], {
    stdio: ['ignore', 'inherit', 'inherit'],
    windowsHide: true,
  });
  if (r.status !== 0) {
    throw new Error(`ffmpeg failed (${r.status})`);
  }
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

function fontFace() {
  const b64 = fs.readFileSync(FONT).toString('base64');
  return `@font-face{font-family:'NunitoEmbed';src:url('data:font/ttf;base64,${b64}');}`;
}

function toFwd(p) {
  return p.replace(/\\/g, '/');
}

function vEncode(dest, extra = []) {
  return [
    ...extra,
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
    dest,
  ];
}

function stillVf(kind, dur) {
  const frames = Math.max(2, Math.round(dur * FPS));
  const prep = 'scale=1740:3094:force_original_aspect_ratio=increase:flags=lanczos,crop=1740:3094';
  if (kind === 'chaos') {
    return [
      prep,
      `zoompan=z='min(zoom+0.0032,1.24)':x='iw/2-(iw/zoom/2)+16*sin(on/3)':y='ih/2-(ih/zoom/2)+10*cos(on/4)':d=${frames}:s=${W}x${H}:fps=${FPS}`,
      'eq=contrast=1.14:saturation=1.2:brightness=0.02',
      'format=yuv420p',
      'setsar=1',
    ].join(',');
  }
  if (kind === 'tap') {
    return [
      prep,
      `zoompan=z='if(lt(on,12),1.32-0.014*on,1.15)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${W}x${H}:fps=${FPS}`,
      'fade=t=in:st=0:d=0.06:color=white',
      'format=yuv420p',
      'setsar=1',
    ].join(',');
  }
  return [
    prep,
    `zoompan=z='min(zoom+0.00085,1.1)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${W}x${H}:fps=${FPS}`,
    'eq=contrast=1.04:saturation=1.08',
    'format=yuv420p',
    'setsar=1',
  ].join(',');
}

function renderStill(img, dest, dur, kind) {
  ff(
    '-loop', '1', '-i', img,
    '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo',
    '-t', String(dur),
    '-vf', stillVf(kind, dur),
    ...vEncode(dest, ['-shortest']),
  );
}

function renderBlack(dest, dur) {
  ff(
    '-f', 'lavfi', '-i', `color=c=black:s=${W}x${H}:r=${FPS}:d=${dur}`,
    '-f', 'lavfi', '-i', `anullsrc=r=48000:cl=stereo:d=${dur}`,
    '-t', String(dur),
    '-vf', 'format=yuv420p,setsar=1',
    ...vEncode(dest, ['-shortest']),
  );
}

function cropFilter() {
  return [
    'crop=750:1188:0:48',
    `scale=${W}:${H}:force_original_aspect_ratio=increase:flags=lanczos`,
    `crop=${W}:${H}`,
    'setsar=1',
    `fps=${FPS}`,
    'format=yuv420p',
  ].join(',');
}

function renderApp(src, dest, ss, t, keepAudio) {
  const args = [
    '-ss', String(ss),
    '-t', String(t),
    '-i', src,
  ];
  if (keepAudio) {
    args.push(
      '-vf', cropFilter(),
      '-af', 'aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,volume=1.15',
    );
  } else {
    args.push(
      '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo',
      '-map', '0:v', '-map', '1:a',
      '-vf', cropFilter(),
    );
  }
  args.push('-t', String(t));
  ff(...vEncode(dest, args));
}

async function makeEndcard() {
  const badgePng = path.join(ASSETS, 'appstore_white.png');
  await sharp(BADGE_SVG)
    .resize({ width: 680, kernel: sharp.kernel.lanczos3 })
    .png()
    .toFile(badgePng);

  const logo = await sharp(WORDMARK)
    .resize({ width: 780, kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();
  const logoMeta = await sharp(logo).metadata();

  const svg = Buffer.from(`
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <style>
    ${fontFace()}
    .sub { font-family: NunitoEmbed, sans-serif; font-weight: 600; font-size: 28px; fill: #8AA0B4; }
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
</svg>`);

  const bg = await sharp(svg).png().toBuffer();
  const badge = await sharp(badgePng).toBuffer();
  const badgeMeta = await sharp(badge).metadata();

  const endPng = path.join(BUILD, 'endcard.png');
  await sharp(bg)
    .composite([
      { input: logo, left: Math.round((W - logoMeta.width) / 2), top: 700 },
      { input: badge, left: Math.round((W - badgeMeta.width) / 2), top: 1180 },
    ])
    .png()
    .toFile(endPng);

  const dest = path.join(BUILD, 's_end.mp4');
  ff(
    '-loop', '1', '-framerate', String(FPS), '-i', endPng,
    '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo',
    '-t', String(T.end),
    '-vf', 'format=yuv420p,setsar=1,fade=t=in:st=0:d=0.35',
    ...vEncode(dest, ['-shortest']),
  );
  return dest;
}

async function roundRect(buf, w, h, r) {
  const mask = Buffer.from(
    `<svg width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="${r}" ry="${r}" fill="#fff"/></svg>`,
  );
  return sharp(buf).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
}

async function makeThumb() {
  const src = path.join(STORY, 'story_thumb.png');
  const pngPath = path.join(VDIR, 'StimPad_shorts_story_thumb.png');
  const jpgPath = path.join(VDIR, 'StimPad_shorts_story_thumb.jpg');

  const photo = await sharp(src)
    .resize(W, H, { fit: 'cover', position: 'centre', kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();

  const iconSize = 92;
  const icon = await sharp(ICON)
    .resize(iconSize, iconSize, { kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();
  const iconRounded = await roundRect(icon, iconSize, iconSize, 22);

  const logoW = 480;
  const logo = await sharp(WORDMARK)
    .resize({ width: logoW, kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();
  const logoMeta = await sharp(logo).metadata();
  const headerPad = 16;
  const headerW = iconSize + headerPad + logoMeta.width;
  const headerLeft = Math.round((W - headerW) / 2);
  const barTop = 1748;

  const overlay = Buffer.from(`
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#05080C" stop-opacity="0"/>
      <stop offset="55%" stop-color="#05080C" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#05080C" stop-opacity="0.88"/>
    </linearGradient>
  </defs>
  <rect x="0" y="${H - 280}" width="${W}" height="280" fill="url(#scrim)"/>
</svg>`);

  await sharp(photo)
    .composite([
      { input: overlay, left: 0, top: 0 },
      { input: iconRounded, left: headerLeft, top: barTop },
      { input: logo, left: headerLeft + iconSize + headerPad, top: barTop + 10 },
    ])
    .png()
    .toFile(pngPath);

  await sharp(pngPath).jpeg({ quality: 90, mozjpeg: true }).toFile(jpgPath);
  console.log(`Thumb PNG  ${pngPath}`);
  console.log(`Thumb JPG  ${jpgPath}`);
}

function concatFiles(files, dest) {
  const list = path.join(BUILD, 'concat.txt');
  fs.writeFileSync(list, files.map((f) => `file '${toFwd(f)}'`).join('\n'));
  ff(
    '-f', 'concat', '-safe', '0', '-i', list,
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
    '-movflags', '+faststart',
    dest,
  );
}

function overlayAt(bed, src, dest, opts = {}) {
  const {
    delayMs = 0,
    trim = null,
    ss = null,
    volume = 1,
    fadeInSt = null,
    fadeInD = 0.35,
    fadeOutSt = null,
    fadeOutD = 0.12,
    lavfi = false,
    padDur = null,
  } = opts;
  const stereo = 'aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo';
  let chain = `[1:a]${stereo}`;
  if (trim != null) chain += `,atrim=0:${trim},asetpts=PTS-STARTPTS`;
  if (delayMs > 0) chain += `,adelay=${delayMs}|${delayMs}`;
  chain += `,volume=${volume}`;
  if (fadeInSt != null) chain += `,afade=t=in:st=${fadeInSt}:d=${fadeInD}`;
  if (fadeOutSt != null) chain += `,afade=t=out:st=${fadeOutSt}:d=${fadeOutD}`;
  if (padDur != null) chain += `,apad=whole_dur=${padDur}`;
  chain += `[s];[0:a]${stereo}[b];[b][s]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[aout]`;

  const args = ['-i', bed];
  if (ss != null) args.push('-ss', String(ss));
  if (lavfi) args.push('-f', 'lavfi');
  args.push('-i', src);
  ff(
    ...args,
    '-filter_complex', chain,
    '-map', '[aout]',
    '-c:a', 'pcm_s16le',
    '-ar', '48000',
    '-ac', '2',
    dest,
  );
}

function mixAudio(videoIn, dest) {
  const rainT = rainAt();
  const endT = endAt();
  const dur = totalDur();
  const tmp = path.join(BUILD, 'mix_tmp');
  fs.mkdirSync(tmp, { recursive: true });

  const bed0 = path.join(tmp, '00.wav');
  ff(
    '-f', 'lavfi', '-t', dur.toFixed(3), '-i', 'anullsrc=r=48000:cl=stereo',
    '-c:a', 'pcm_s16le', '-ar', '48000', '-ac', '2',
    bed0,
  );

  const steps = [
    { src: path.join(AUDIO, 'restaurant_crowd.ogg'), trim: 0.95, volume: 7.2, fadeOutSt: 0.62, fadeOutD: 0.16 },
    { src: path.join(AUDIO, 'construction_site.ogg'), delayMs: 680, trim: 0.85, volume: 6.4, fadeOutSt: 1.40, fadeOutD: 0.12 },
    { src: path.join(AUDIO, 'ambulance_siren.ogg'), delayMs: 1360, trim: 0.70, volume: 4.6, fadeOutSt: 1.92, fadeOutD: 0.12 },
    { src: path.join(AUDIO, 'fire_truck_siren.ogg'), delayMs: 1480, trim: 0.55, volume: 2.4 },
    { src: path.join(AUDIO, 'car_horn.mp3'), delayMs: 1760, trim: 0.32, volume: 4.0 },
    { src: 'sine=frequency=48:sample_rate=48000', lavfi: true, trim: 2.00, volume: 0.45 },
    { src: path.join(AUDIO, 'pen_click.mp3'), delayMs: Math.round(tapAt() * 1000), trim: 0.38, volume: 1.35 },
    { src: path.join(AUDIO, 'thunder.ogg'), delayMs: Math.round(rainT * 1000), trim: 2.2, volume: 0.7, fadeInSt: rainT, fadeInD: 0.12 },
    { src: path.join(AUDIO, 'rain.ogg'), delayMs: Math.round(rainT * 1000), trim: (dur - rainT).toFixed(2), volume: 1.9, fadeInSt: rainT, fadeInD: 0.45, fadeOutSt: endT, fadeOutD: 0.9 },
    { src: path.join(AUDIO, 'flowing_water.ogg'), delayMs: Math.round((rainT + 0.22) * 1000), trim: (dur - rainT).toFixed(2), volume: 0.7, fadeInSt: rainT + 0.22, fadeInD: 0.6, fadeOutSt: endT, fadeOutD: 0.9 },
    { src: path.join(AUDIO, 'morning_birds.ogg'), delayMs: Math.round((rainT + 0.7) * 1000), trim: (dur - rainT).toFixed(2), volume: 0.5, fadeInSt: rainT + 0.7, fadeInD: 1.0, fadeOutSt: endT, fadeOutD: 0.9 },
    { src: path.join(AUDIO, 'unlock_chime.ogg'), delayMs: Math.round(endT * 1000), volume: 1.7 },
    { src: path.join(AUDIO, 'wind_chimes.mp3'), delayMs: Math.round((endT + 0.16) * 1000), trim: 4.0, volume: 0.85 },
    { src: CLIPS.pen, ss: 0.90, delayMs: Math.round(appPenAt() * 1000), trim: T.appPen, volume: 1.2 },
  ];

  let current = bed0;
  steps.forEach((step, i) => {
    const next = path.join(tmp, `${String(i + 1).padStart(2, '0')}.wav`);
    overlayAt(current, step.src, next, { ...step, padDur: dur.toFixed(3) });
    current = next;
  });

  const limited = path.join(tmp, 'limited.wav');
  ff(
    '-i', current,
    '-af', `alimiter=limit=0.91,atrim=0:${dur.toFixed(3)},asetpts=PTS-STARTPTS`,
    '-c:a', 'pcm_s16le', '-ar', '48000', '-ac', '2',
    limited,
  );

  ff(
    '-i', videoIn,
    '-i', limited,
    '-map', '0:v',
    '-map', '1:a',
    '-c:v', 'copy',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
    '-movflags', '+faststart',
    '-t', dur.toFixed(3),
    dest,
  );
  fs.rmSync(tmp, { recursive: true, force: true });
}

async function main() {
  fs.mkdirSync(BUILD, { recursive: true });
  fs.mkdirSync(ASSETS, { recursive: true });

  if (process.argv.includes('--mix-only')) {
    const silent = path.join(BUILD, 'story_silent.mp4');
    const out = path.join(VDIR, 'StimPad_shorts_story.mp4');
    console.log('Mix audio only…');
    mixAudio(silent, out);
    const d = probeDuration(out);
    const stat = fs.statSync(out);
    console.log(`Wrote ${out}`);
    console.log(`Duration ${d.toFixed(2)}s  ${(stat.size / 1024 / 1024).toFixed(1)} MB`);
    return;
  }

  console.log('Thumbnail…');
  await makeThumb();

  console.log(`Story Shorts  (~${totalDur().toFixed(1)}s, tap @ ${tapAt().toFixed(2)}s)`);

  const cafe = path.join(BUILD, 's_cafe.mp4');
  const crowd = path.join(BUILD, 's_crowd.mp4');
  const siren = path.join(BUILD, 's_siren.mp4');
  const black = path.join(BUILD, 's_black.mp4');
  const tap = path.join(BUILD, 's_tap.mp4');
  const rainStill = path.join(BUILD, 's_rainstill.mp4');
  const appRain = path.join(BUILD, 's_apprain.mp4');
  const appPen = path.join(BUILD, 's_apppen.mp4');

  console.log('Stills…');
  renderStill(path.join(STORY, 'story_cafe.png'), cafe, T.cafe, 'chaos');
  renderStill(path.join(STORY, 'story_construction.png'), crowd, T.crowd, 'chaos');
  renderStill(path.join(STORY, 'story_siren.png'), siren, T.siren, 'chaos');
  renderBlack(black, T.black);
  renderStill(path.join(STORY, 'story_tap.png'), tap, T.tap, 'tap');
  renderStill(path.join(STORY, 'story_rain.png'), rainStill, T.rainStill, 'rain');

  console.log('App footage…');
  renderApp(CLIPS.rain, appRain, 0.55, T.appRain, false);
  renderApp(CLIPS.pen, appPen, 0.90, T.appPen, true);

  console.log('End card…');
  const end = await makeEndcard();

  const silent = path.join(BUILD, 'story_silent.mp4');
  const files = [cafe, crowd, siren, black, tap, rainStill, appRain, appPen, end];
  console.log('Concat…');
  concatFiles(files, silent);

  const out = path.join(VDIR, 'StimPad_shorts_story.mp4');
  console.log('Mix audio…');
  mixAudio(silent, out);

  const d = probeDuration(out);
  const stat = fs.statSync(out);
  console.log(`Wrote ${out}`);
  console.log(`Duration ${d.toFixed(2)}s  ${(stat.size / 1024 / 1024).toFixed(1)} MB`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
