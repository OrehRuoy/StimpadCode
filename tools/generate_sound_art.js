/**
 * StimPad sound tile art — unique SVG illustrations → PNG via sharp.
 * Style: soft tactile icons on deep warm slate, coral/mint/gold accents.
 */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "assets", "art", "sounds");
const SIZE = 512;

const BG = "#1A2230";
const CREAM = "#F5F0E8";
const MINT = "#5ECFB0";
const CORAL = "#FF6B5B";
const GOLD = "#F0C05A";
const BLUE = "#6BA3D6";
const SLATE = "#2A3548";
const WHITE = "#FFFFFF";

function tile(inner) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#222C3C"/>
      <stop offset="100%" stop-color="${BG}"/>
    </linearGradient>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#000" flood-opacity="0.35"/>
    </filter>
  </defs>
  <rect width="512" height="512" rx="96" fill="url(#g)"/>
  <rect x="28" y="28" width="456" height="456" rx="80" fill="${SLATE}" opacity="0.45"/>
  <g filter="url(#soft)">${inner}</g>
</svg>`;
}

const ART = {
  police_siren: `
    <circle cx="256" cy="270" r="78" fill="${CORAL}"/>
    <circle cx="256" cy="270" r="48" fill="${CREAM}"/>
    <path d="M170 200 Q256 120 342 200" fill="none" stroke="${BLUE}" stroke-width="18" stroke-linecap="round"/>
    <path d="M190 175 Q256 110 322 175" fill="none" stroke="${CORAL}" stroke-width="14" stroke-linecap="round"/>
    <rect x="236" y="340" width="40" height="50" rx="8" fill="${SLATE}"/>`,
  fire_whistle: `
    <ellipse cx="256" cy="300" rx="90" ry="55" fill="${GOLD}"/>
    <rect x="216" y="180" width="80" height="130" rx="20" fill="${GOLD}"/>
    <circle cx="256" cy="170" r="28" fill="${CORAL}"/>
    <path d="M256 140 L270 90 L242 90 Z" fill="${CORAL}"/>
    <path d="M300 250 Q360 220 380 180" fill="none" stroke="${MINT}" stroke-width="10" stroke-linecap="round" opacity="0.8"/>`,
  ambulance_siren: `
    <rect x="140" y="230" width="232" height="120" rx="24" fill="${CREAM}"/>
    <rect x="160" y="210" width="100" height="40" rx="10" fill="${BLUE}"/>
    <circle cx="190" cy="360" r="28" fill="${SLATE}"/><circle cx="322" cy="360" r="28" fill="${SLATE}"/>
    <rect x="300" y="250" width="50" height="36" rx="6" fill="${CORAL}"/>
    <path d="M200 180 Q256 120 312 180" fill="none" stroke="${CORAL}" stroke-width="14" stroke-linecap="round"/>`,
  fire_truck_siren: `
    <rect x="130" y="240" width="252" height="110" rx="18" fill="${CORAL}"/>
    <rect x="150" y="200" width="90" height="50" rx="10" fill="${GOLD}"/>
    <circle cx="190" cy="370" r="30" fill="${SLATE}"/><circle cx="330" cy="370" r="30" fill="${SLATE}"/>
    <rect x="280" y="255" width="70" height="50" rx="8" fill="${CREAM}"/>
    <path d="M210 160 Q256 110 302 160" fill="none" stroke="${GOLD}" stroke-width="14" stroke-linecap="round"/>`,
  tornado_siren: `
    <path d="M256 120 C200 180 320 220 220 280 C300 300 200 360 256 400" fill="none" stroke="${CORAL}" stroke-width="28" stroke-linecap="round"/>
    <circle cx="256" cy="120" r="22" fill="${GOLD}"/>
    <path d="M180 200 Q256 160 332 200" fill="none" stroke="${MINT}" stroke-width="10" opacity="0.7" stroke-linecap="round"/>`,
  alarm_clock: `
    <circle cx="256" cy="270" r="100" fill="${CREAM}"/>
    <circle cx="256" cy="270" r="78" fill="${SLATE}"/>
    <circle cx="256" cy="270" r="70" fill="${CREAM}"/>
    <line x1="256" y1="270" x2="256" y2="220" stroke="${CORAL}" stroke-width="10" stroke-linecap="round"/>
    <line x1="256" y1="270" x2="300" y2="290" stroke="${SLATE}" stroke-width="8" stroke-linecap="round"/>
    <circle cx="190" cy="175" r="22" fill="${GOLD}"/><circle cx="322" cy="175" r="22" fill="${GOLD}"/>`,
  smoke_alarm: `
    <circle cx="256" cy="250" r="110" fill="${CREAM}"/>
    <circle cx="256" cy="250" r="70" fill="${SLATE}"/>
    <circle cx="256" cy="250" r="28" fill="${CORAL}"/>
    <path d="M200 360 Q256 390 312 360" fill="none" stroke="${MINT}" stroke-width="12" stroke-linecap="round" opacity="0.8"/>
    <circle cx="210" cy="210" r="8" fill="${GOLD}"/><circle cx="302" cy="210" r="8" fill="${GOLD}"/>`,
  school_bell: `
    <path d="M160 220 Q256 120 352 220 L330 320 Q256 360 182 320 Z" fill="${GOLD}"/>
    <rect x="240" y="320" width="32" height="50" rx="6" fill="${SLATE}"/>
    <circle cx="256" cy="200" r="18" fill="${CREAM}"/>
    <line x1="256" y1="120" x2="256" y2="90" stroke="${SLATE}" stroke-width="12" stroke-linecap="round"/>
    <circle cx="256" cy="80" r="14" fill="${CORAL}"/>`,
  doorbell: `
    <rect x="170" y="140" width="172" height="240" rx="40" fill="${CREAM}"/>
    <circle cx="256" cy="250" r="48" fill="${GOLD}"/>
    <circle cx="256" cy="250" r="28" fill="${CORAL}"/>
    <rect x="220" y="170" width="72" height="18" rx="6" fill="${MINT}"/>`,
  bicycle_bell: `
    <circle cx="256" cy="270" r="90" fill="${CREAM}"/>
    <circle cx="256" cy="270" r="55" fill="${MINT}"/>
    <circle cx="256" cy="270" r="22" fill="${SLATE}"/>
    <rect x="248" y="150" width="16" height="50" rx="6" fill="${SLATE}"/>
    <path d="M310 220 Q360 200 380 160" fill="none" stroke="${GOLD}" stroke-width="10" stroke-linecap="round"/>`,
  wind_chimes: `
    <rect x="180" y="130" width="152" height="24" rx="8" fill="${GOLD}"/>
    <rect x="200" y="160" width="14" height="180" rx="6" fill="${MINT}"/>
    <rect x="230" y="160" width="14" height="220" rx="6" fill="${CREAM}"/>
    <rect x="260" y="160" width="14" height="160" rx="6" fill="${BLUE}"/>
    <rect x="290" y="160" width="14" height="200" rx="6" fill="${CORAL}"/>
    <line x1="256" y1="100" x2="256" y2="130" stroke="${SLATE}" stroke-width="8"/>`,
  church_bell: `
    <path d="M170 200 Q256 100 342 200 L320 340 Q256 390 192 340 Z" fill="${GOLD}"/>
    <ellipse cx="256" cy="340" rx="70" ry="28" fill="${SLATE}" opacity="0.5"/>
    <rect x="246" y="340" width="20" height="50" rx="6" fill="${CREAM}"/>
    <circle cx="256" cy="380" r="16" fill="${CORAL}"/>
    <line x1="256" y1="100" x2="256" y2="70" stroke="${SLATE}" stroke-width="10"/>`,
  vacuum: `
    <ellipse cx="256" cy="300" rx="110" ry="70" fill="${SLATE}"/>
    <rect x="200" y="180" width="112" height="130" rx="30" fill="${CREAM}"/>
    <circle cx="256" cy="230" r="28" fill="${MINT}"/>
    <path d="M312 220 Q380 200 400 260 Q380 300 330 290" fill="none" stroke="${CORAL}" stroke-width="18" stroke-linecap="round"/>`,
  fan_hum: `
    <circle cx="256" cy="256" r="120" fill="${SLATE}"/>
    <circle cx="256" cy="256" r="36" fill="${MINT}"/>
    <ellipse cx="256" cy="170" rx="40" ry="70" fill="${CREAM}" opacity="0.9"/>
    <ellipse cx="340" cy="300" rx="70" ry="40" fill="${CREAM}" opacity="0.85" transform="rotate(60 340 300)"/>
    <ellipse cx="172" cy="300" rx="70" ry="40" fill="${CREAM}" opacity="0.85" transform="rotate(-60 172 300)"/>`,
  washing_machine: `
    <rect x="150" y="140" width="212" height="250" rx="28" fill="${CREAM}"/>
    <circle cx="256" cy="280" r="78" fill="${SLATE}"/>
    <circle cx="256" cy="280" r="55" fill="${BLUE}" opacity="0.7"/>
    <circle cx="200" cy="175" r="12" fill="${CORAL}"/>
    <circle cx="236" cy="175" r="12" fill="${MINT}"/>
    <rect x="270" y="168" width="60" height="16" rx="6" fill="${GOLD}"/>`,
  dryer: `
    <rect x="150" y="140" width="212" height="250" rx="28" fill="${CREAM}"/>
    <circle cx="256" cy="280" r="78" fill="${SLATE}"/>
    <circle cx="256" cy="280" r="50" fill="${GOLD}" opacity="0.5"/>
    <rect x="180" y="168" width="70" height="16" rx="6" fill="${CORAL}"/>
    <circle cx="300" cy="176" r="12" fill="${MINT}"/>`,
  dishwasher: `
    <rect x="150" y="130" width="212" height="270" rx="24" fill="${CREAM}"/>
    <rect x="170" y="160" width="172" height="200" rx="12" fill="${BLUE}" opacity="0.55"/>
    <rect x="190" y="200" width="132" height="12" rx="4" fill="${SLATE}"/>
    <rect x="190" y="240" width="132" height="12" rx="4" fill="${SLATE}"/>
    <circle cx="256" cy="150" r="10" fill="${MINT}"/>`,
  hair_dryer: `
    <ellipse cx="220" cy="250" rx="90" ry="55" fill="${CREAM}"/>
    <rect x="280" y="230" width="100" height="40" rx="16" fill="${CORAL}"/>
    <rect x="200" y="290" width="36" height="90" rx="12" fill="${SLATE}"/>
    <path d="M380 250 Q430 230 450 200" fill="none" stroke="${MINT}" stroke-width="12" stroke-linecap="round" opacity="0.8"/>
    <path d="M380 260 Q440 270 460 300" fill="none" stroke="${BLUE}" stroke-width="10" stroke-linecap="round" opacity="0.7"/>`,
  blender: `
    <path d="M190 200 L180 360 Q256 400 332 360 L322 200 Z" fill="${CREAM}"/>
    <rect x="175" y="160" width="162" height="50" rx="12" fill="${SLATE}"/>
    <ellipse cx="256" cy="280" rx="40" ry="20" fill="${MINT}" opacity="0.8"/>
    <rect x="236" y="360" width="40" height="40" rx="8" fill="${CORAL}"/>`,
  microwave_hum: `
    <rect x="120" y="160" width="272" height="200" rx="20" fill="${CREAM}"/>
    <rect x="145" y="185" width="160" height="150" rx="10" fill="${SLATE}"/>
    <rect x="320" y="185" width="50" height="150" rx="8" fill="${GOLD}" opacity="0.4"/>
    <circle cx="345" cy="220" r="12" fill="${CORAL}"/>
    <circle cx="345" cy="260" r="12" fill="${MINT}"/>`,
  fridge_hum: `
    <rect x="160" y="110" width="192" height="310" rx="20" fill="${CREAM}"/>
    <line x1="160" y1="250" x2="352" y2="250" stroke="${SLATE}" stroke-width="8"/>
    <rect x="320" y="160" width="14" height="50" rx="4" fill="${MINT}"/>
    <rect x="320" y="290" width="14" height="70" rx="4" fill="${MINT}"/>
    <rect x="190" y="140" width="100" height="70" rx="8" fill="${BLUE}" opacity="0.35"/>`,
  ac_hum: `
    <rect x="110" y="180" width="292" height="160" rx="24" fill="${CREAM}"/>
    <line x1="140" y1="220" x2="370" y2="220" stroke="${BLUE}" stroke-width="10" stroke-linecap="round"/>
    <line x1="140" y1="255" x2="370" y2="255" stroke="${MINT}" stroke-width="10" stroke-linecap="round"/>
    <line x1="140" y1="290" x2="370" y2="290" stroke="${BLUE}" stroke-width="10" stroke-linecap="round"/>
    <circle cx="256" cy="360" r="16" fill="${SLATE}"/>`,
  pen_click: `
    <rect x="230" y="100" width="52" height="300" rx="18" fill="${CREAM}"/>
    <rect x="230" y="100" width="52" height="70" rx="16" fill="${CORAL}"/>
    <circle cx="256" cy="420" r="22" fill="${GOLD}"/>
    <rect x="242" y="200" width="28" height="80" rx="6" fill="${MINT}" opacity="0.6"/>`,
  keyboard_typing: `
    <rect x="100" y="190" width="312" height="150" rx="20" fill="${CREAM}"/>
    <rect x="120" y="210" width="40" height="36" rx="6" fill="${SLATE}"/>
    <rect x="172" y="210" width="40" height="36" rx="6" fill="${MINT}"/>
    <rect x="224" y="210" width="40" height="36" rx="6" fill="${SLATE}"/>
    <rect x="276" y="210" width="40" height="36" rx="6" fill="${CORAL}"/>
    <rect x="328" y="210" width="60" height="36" rx="6" fill="${SLATE}"/>
    <rect x="140" y="270" width="232" height="36" rx="8" fill="${GOLD}" opacity="0.7"/>`,
  light_switch: `
    <rect x="180" y="130" width="152" height="260" rx="24" fill="${CREAM}"/>
    <rect x="220" y="190" width="72" height="120" rx="12" fill="${SLATE}"/>
    <rect x="230" y="200" width="52" height="55" rx="8" fill="${GOLD}"/>`,
  fidget_click: `
    <circle cx="256" cy="256" r="110" fill="${CREAM}"/>
    <circle cx="256" cy="180" r="32" fill="${CORAL}"/>
    <circle cx="320" cy="256" r="32" fill="${MINT}"/>
    <circle cx="256" cy="332" r="32" fill="${GOLD}"/>
    <circle cx="192" cy="256" r="32" fill="${BLUE}"/>
    <circle cx="256" cy="256" r="24" fill="${SLATE}"/>`,
  zipper: `
    <path d="M200 100 L200 412" fill="none" stroke="${SLATE}" stroke-width="20" stroke-linecap="round"/>
    <path d="M312 100 L312 412" fill="none" stroke="${SLATE}" stroke-width="20" stroke-linecap="round"/>
    <rect x="210" y="220" width="92" height="50" rx="10" fill="${GOLD}"/>
    <rect x="240" y="270" width="32" height="60" rx="8" fill="${CORAL}"/>
    <line x1="220" y1="160" x2="292" y2="160" stroke="${CREAM}" stroke-width="8"/>
    <line x1="220" y1="190" x2="292" y2="190" stroke="${CREAM}" stroke-width="8"/>`,
  bubble_wrap: `
    <rect x="120" y="140" width="272" height="240" rx="20" fill="${CREAM}"/>
    <circle cx="180" cy="210" r="28" fill="${BLUE}" opacity="0.55"/>
    <circle cx="256" cy="210" r="28" fill="${MINT}" opacity="0.55"/>
    <circle cx="332" cy="210" r="28" fill="${BLUE}" opacity="0.55"/>
    <circle cx="180" cy="300" r="28" fill="${MINT}" opacity="0.55"/>
    <circle cx="256" cy="300" r="28" fill="${CORAL}" opacity="0.45"/>
    <circle cx="332" cy="300" r="28" fill="${MINT}" opacity="0.55"/>`,
  velcro: `
    <rect x="130" y="180" width="250" height="60" rx="16" fill="${CREAM}"/>
    <rect x="130" y="280" width="250" height="60" rx="16" fill="${CORAL}" opacity="0.85"/>
    <path d="M150 240 L180 270 M200 240 L230 270 M250 240 L280 270 M300 240 L330 270" stroke="${GOLD}" stroke-width="6" stroke-linecap="round"/>`,
  train_horn: `
    <rect x="140" y="220" width="200" height="90" rx="20" fill="${GOLD}"/>
    <rect x="300" y="200" width="90" height="130" rx="16" fill="${CREAM}"/>
    <circle cx="180" cy="265" r="20" fill="${CORAL}"/>
    <path d="M390 230 Q450 210 470 170" fill="none" stroke="${MINT}" stroke-width="12" stroke-linecap="round"/>
    <path d="M390 265 Q460 265 480 265" fill="none" stroke="${BLUE}" stroke-width="12" stroke-linecap="round"/>`,
  car_horn: `
    <ellipse cx="240" cy="270" rx="100" ry="70" fill="${CREAM}"/>
    <rect x="300" y="240" width="90" height="50" rx="18" fill="${CORAL}"/>
    <circle cx="200" cy="270" r="24" fill="${SLATE}"/>
    <path d="M390 250 Q440 220 460 180" fill="none" stroke="${GOLD}" stroke-width="12" stroke-linecap="round"/>`,
  subway_rumble: `
    <rect x="120" y="200" width="272" height="120" rx="24" fill="${CREAM}"/>
    <rect x="145" y="225" width="70" height="50" rx="8" fill="${BLUE}" opacity="0.6"/>
    <rect x="230" y="225" width="70" height="50" rx="8" fill="${BLUE}" opacity="0.6"/>
    <rect x="315" y="225" width="50" height="50" rx="8" fill="${MINT}" opacity="0.6"/>
    <circle cx="180" cy="350" r="26" fill="${SLATE}"/><circle cx="320" cy="350" r="26" fill="${SLATE}"/>
    <rect x="100" y="370" width="312" height="14" rx="6" fill="${GOLD}"/>`,
  rain: `
    <ellipse cx="256" cy="160" rx="110" ry="50" fill="${SLATE}"/>
    <ellipse cx="200" cy="150" rx="60" ry="35" fill="${CREAM}" opacity="0.3"/>
    <line x1="180" y1="230" x2="160" y2="360" stroke="${BLUE}" stroke-width="10" stroke-linecap="round"/>
    <line x1="230" y1="220" x2="210" y2="380" stroke="${MINT}" stroke-width="10" stroke-linecap="round"/>
    <line x1="280" y1="230" x2="265" y2="370" stroke="${BLUE}" stroke-width="10" stroke-linecap="round"/>
    <line x1="330" y1="220" x2="310" y2="360" stroke="${MINT}" stroke-width="10" stroke-linecap="round"/>`,
  thunder: `
    <ellipse cx="230" cy="170" rx="100" ry="55" fill="${SLATE}"/>
    <ellipse cx="310" cy="180" rx="80" ry="45" fill="${CREAM}" opacity="0.25"/>
    <path d="M250 210 L210 300 L250 290 L220 390 L320 270 L270 280 L310 210 Z" fill="${GOLD}"/>`,
  shower: `
    <rect x="240" y="100" width="32" height="80" rx="8" fill="${SLATE}"/>
    <ellipse cx="256" cy="190" rx="90" ry="28" fill="${CREAM}"/>
    <line x1="200" y1="230" x2="190" y2="380" stroke="${BLUE}" stroke-width="8" stroke-linecap="round"/>
    <line x1="230" y1="240" x2="225" y2="390" stroke="${MINT}" stroke-width="8" stroke-linecap="round"/>
    <line x1="260" y1="240" x2="260" y2="400" stroke="${BLUE}" stroke-width="8" stroke-linecap="round"/>
    <line x1="290" y1="240" x2="295" y2="390" stroke="${MINT}" stroke-width="8" stroke-linecap="round"/>
    <line x1="320" y1="230" x2="330" y2="380" stroke="${BLUE}" stroke-width="8" stroke-linecap="round"/>`,
  tap_drip: `
    <path d="M180 160 H300 Q320 160 320 190 V230" fill="none" stroke="${CREAM}" stroke-width="28" stroke-linecap="round"/>
    <circle cx="320" cy="280" r="22" fill="${BLUE}"/>
    <ellipse cx="320" cy="340" rx="16" ry="28" fill="${MINT}"/>
    <ellipse cx="320" cy="400" rx="12" ry="18" fill="${BLUE}" opacity="0.7"/>`,
  white_noise: `
    <rect x="130" y="150" width="252" height="220" rx="24" fill="${CREAM}"/>
    ${Array.from({ length: 40 }, (_, i) => {
      const x = 150 + (i % 10) * 22;
      const y = 175 + Math.floor(i / 10) * 45;
      const c = [MINT, CORAL, GOLD, BLUE][i % 4];
      return `<circle cx="${x}" cy="${y}" r="${6 + (i % 3)}" fill="${c}" opacity="0.75"/>`;
    }).join("")}`,
  pink_noise: `
    <rect x="130" y="150" width="252" height="220" rx="24" fill="${CREAM}"/>
    ${Array.from({ length: 36 }, (_, i) => {
      const x = 155 + (i % 9) * 24;
      const y = 180 + Math.floor(i / 9) * 48;
      return `<circle cx="${x}" cy="${y}" r="${7 + (i % 4)}" fill="${CORAL}" opacity="${0.4 + (i % 5) * 0.1}"/>`;
    }).join("")}`,
  brown_noise: `
    <rect x="130" y="150" width="252" height="220" rx="24" fill="${CREAM}"/>
    ${Array.from({ length: 30 }, (_, i) => {
      const x = 160 + (i % 6) * 32;
      const y = 185 + Math.floor(i / 6) * 40;
      return `<rect x="${x}" y="${y}" width="18" height="18" rx="4" fill="${GOLD}" opacity="${0.45 + (i % 4) * 0.1}"/>`;
    }).join("")}`,
  tv_static: `
    <rect x="120" y="140" width="272" height="200" rx="16" fill="${SLATE}"/>
    <rect x="140" y="160" width="232" height="140" rx="8" fill="${CREAM}"/>
    ${Array.from({ length: 48 }, (_, i) => {
      const x = 150 + (i % 12) * 18;
      const y = 175 + Math.floor(i / 12) * 28;
      const c = i % 2 ? SLATE : MINT;
      return `<rect x="${x}" y="${y}" width="10" height="16" fill="${c}" opacity="0.7"/>`;
    }).join("")}
    <rect x="220" y="360" width="72" height="28" rx="8" fill="${CORAL}"/>`,
  paper_crinkle: `
    <path d="M160 140 L340 140 L360 380 L140 380 Z" fill="${CREAM}"/>
    <path d="M200 180 Q256 220 300 170 Q280 260 220 250 Q240 320 310 300" fill="none" stroke="${SLATE}" stroke-width="8" stroke-linecap="round" opacity="0.5"/>
    <path d="M180 300 Q240 280 280 340" fill="none" stroke="${MINT}" stroke-width="6" opacity="0.6"/>`,
  scissors_snip: `
    <circle cx="190" cy="200" r="40" fill="${CREAM}"/>
    <circle cx="190" cy="320" r="40" fill="${CREAM}"/>
    <circle cx="190" cy="200" r="18" fill="${SLATE}"/>
    <circle cx="190" cy="320" r="18" fill="${SLATE}"/>
    <path d="M220 230 L380 160" stroke="${MINT}" stroke-width="18" stroke-linecap="round"/>
    <path d="M220 290 L380 360" stroke="${CORAL}" stroke-width="18" stroke-linecap="round"/>
    <circle cx="220" cy="260" r="14" fill="${GOLD}"/>`,
  metronome: `
    <path d="M190 380 L256 120 L322 380 Z" fill="${CREAM}"/>
    <rect x="170" y="370" width="172" height="30" rx="8" fill="${SLATE}"/>
    <line x1="256" y1="160" x2="310" y2="280" stroke="${CORAL}" stroke-width="12" stroke-linecap="round"/>
    <circle cx="310" cy="280" r="16" fill="${GOLD}"/>`,
  dial_tone: `
    <circle cx="256" cy="250" r="110" fill="${CREAM}"/>
    <circle cx="256" cy="250" r="70" fill="${SLATE}"/>
    <circle cx="256" cy="250" r="30" fill="${MINT}"/>
    <rect x="246" y="120" width="20" height="40" rx="6" fill="${CORAL}"/>
    <path d="M340 200 Q390 180 410 140" fill="none" stroke="${GOLD}" stroke-width="10" stroke-linecap="round"/>`,
  old_phone_ring: `
    <ellipse cx="256" cy="300" rx="120" ry="80" fill="${CREAM}"/>
    <rect x="170" y="180" width="172" height="70" rx="30" fill="${SLATE}"/>
    <circle cx="200" cy="215" r="16" fill="${CORAL}"/>
    <circle cx="312" cy="215" r="16" fill="${CORAL}"/>
    <rect x="230" y="250" width="52" height="20" rx="6" fill="${GOLD}"/>
    <path d="M180 150 Q256 100 332 150" fill="none" stroke="${MINT}" stroke-width="10" stroke-linecap="round"/>`,
  popcorn_pop: `
    <ellipse cx="256" cy="340" rx="100" ry="40" fill="${CORAL}"/>
    <circle cx="220" cy="250" r="40" fill="${CREAM}"/>
    <circle cx="280" cy="230" r="46" fill="${CREAM}"/>
    <circle cx="250" cy="190" r="36" fill="${GOLD}"/>
    <circle cx="300" cy="280" r="32" fill="${CREAM}"/>
    <circle cx="200" cy="290" r="28" fill="${GOLD}"/>`,
  ice_crunch: `
    <path d="M256 140 L340 220 L310 360 L200 360 L170 220 Z" fill="${BLUE}" opacity="0.85"/>
    <path d="M256 160 L300 230 L280 330 L230 330 L210 230 Z" fill="${CREAM}" opacity="0.45"/>
    <line x1="230" y1="240" x2="280" y2="300" stroke="${MINT}" stroke-width="6" opacity="0.8"/>
    <circle cx="256" cy="280" r="10" fill="${WHITE}" opacity="0.7"/>`,
  xylophone: `
    <rect x="120" y="180" width="60" height="28" rx="8" fill="${CORAL}"/>
    <rect x="160" y="220" width="80" height="28" rx="8" fill="${GOLD}"/>
    <rect x="200" y="260" width="100" height="28" rx="8" fill="${MINT}"/>
    <rect x="240" y="300" width="120" height="28" rx="8" fill="${BLUE}"/>
    <rect x="280" y="340" width="140" height="28" rx="8" fill="${CREAM}"/>
    <line x1="360" y1="140" x2="300" y2="280" stroke="${SLATE}" stroke-width="10" stroke-linecap="round"/>
    <circle cx="300" cy="280" r="14" fill="${CORAL}"/>`,
  triangle_ting: `
    <path d="M256 140 L380 360 L132 360 Z" fill="none" stroke="${GOLD}" stroke-width="22" stroke-linejoin="round"/>
    <line x1="320" y1="160" x2="280" y2="280" stroke="${CREAM}" stroke-width="12" stroke-linecap="round"/>
    <circle cx="280" cy="280" r="14" fill="${CORAL}"/>
    <circle cx="256" cy="140" r="12" fill="${MINT}"/>`,
};

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const ids = Object.keys(ART);
  for (const id of ids) {
    const svg = tile(ART[id]);
    const outPath = path.join(OUT, `${id}.png`);
    await sharp(Buffer.from(svg)).png().toFile(outPath);
    process.stdout.write(`✓ ${id}\n`);
  }
  console.log(`Generated ${ids.length} sound tiles → ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
