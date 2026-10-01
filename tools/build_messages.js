const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const ui = require("./locale_ui_data.js");
const sounds = require("./locale_sounds_data.js");
const LOCALES = ["de", "es", "fr", "pt_BR", "ja"];
const SKIP_SCENE = new Set(["", " ", "✕", "iOS", "1.0.0", "Feature tip body"]);

const messages = { ...ui, ...sounds };
const problems = [];

function codes(s) {
  return [...s].map((c) => "U+" + c.codePointAt(0).toString(16)).join(" ");
}

const catalog = JSON.parse(fs.readFileSync(path.join(root, "data/sounds.json"), "utf8"));
const names = [];
for (const cat of catalog.categories || []) {
  for (const sound of cat.sounds || []) names.push(sound.name);
}
if (!names.length && Array.isArray(catalog)) {
  for (const sound of catalog) names.push(sound.name);
}
if (!names.length && catalog.sounds) {
  for (const sound of catalog.sounds) names.push(sound.name);
}
if (names.length !== Object.keys(sounds).length) {
  problems.push(`sound count ${names.length} vs catalog ${Object.keys(sounds).length}`);
}
for (const name of names) {
  if (!messages[name]) problems.push("missing sound: " + name);
}

function walk(dir, acc) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "addons" || entry.name === "tools") continue;
      walk(full, acc);
    } else if (entry.name.endsWith(".gd") || entry.name.endsWith(".tscn")) {
      acc.push(full);
    }
  }
}

const files = [];
walk(path.join(root, "scripts"), files);
walk(path.join(root, "scenes"), files);

const needed = new Set();
for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  if (file.endsWith(".gd")) {
    const re = /tr\(\s*"((?:\\.|[^"\\])*)"/g;
    let m;
    while ((m = re.exec(text))) {
      needed.add(m[1].replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\"));
    }
    const tip = /"(?:title|body)":\s*"((?:\\.|[^"\\])*)"/g;
    while ((m = tip.exec(text))) {
      needed.add(m[1].replace(/\\n/g, "\n").replace(/\\"/g, '"'));
    }
    const att = text.match(/const ATT_TEXT := \(\s*"((?:\\.|[^"\\])*)"\s*\+\s*"((?:\\.|[^"\\])*)"/);
    if (att) needed.add(att[1] + att[2]);
  } else {
    const re = /(?:^|\n)(?:text|placeholder_text|tooltip_text) = "((?:\\.|[^"\\])*)"/g;
    let m;
    while ((m = re.exec(text))) {
      const value = m[1].replace(/\\n/g, "\n").replace(/\\"/g, '"');
      if (!SKIP_SCENE.has(value)) needed.add(value);
    }
  }
}

for (const key of needed) {
  if (!messages[key]) problems.push("missing key: " + JSON.stringify(key) + " " + codes(key));
}

const placeholders = /%(?:\.\d+f|s|d|%)/g;
for (const [key, row] of Object.entries(messages)) {
  const expected = key.match(placeholders) || [];
  for (const locale of LOCALES) {
    if (!row[locale]) problems.push(`empty ${locale}: ${JSON.stringify(key)}`);
    const got = (row[locale].match(placeholders) || []).join(",");
    if (got !== expected.join(",")) {
      problems.push(`placeholder ${locale} ${JSON.stringify(key)} expected ${expected.join(",")} got ${got}`);
    }
  }
}

if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}

const outDir = path.join(root, "locale");
fs.mkdirSync(outDir, { recursive: true });
const ordered = {};
for (const key of Object.keys(messages).sort((a, b) => a.localeCompare(b))) {
  ordered[key] = messages[key];
}
fs.writeFileSync(path.join(outDir, "messages.json"), JSON.stringify(ordered, null, 2) + "\n", "utf8");
console.log(`wrote ${Object.keys(ordered).length} keys`);
