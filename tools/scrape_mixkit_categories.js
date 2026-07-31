#!/usr/bin/env node
const https = require("https");
const fs = require("fs");

const cats = ["zip", "velcro", "triangle", "bell", "click", "siren", "vacuum", "rain", "school", "office", "transport", "thunder", "water", "machine", "fan", "phone", "paper", "scissors", "train", "horn", "car", "subway", "wind", "church", "dish", "blender", "dryer", "wash", "fire", "smoke", "metronome", "static", "bubble", "ice", "xylophone", "door", "bike", "microwave", "fridge", "keyboard", "switch", "popcorn", "dial", "alarm", "alerts", "household", "cartoon", "tools"];

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
      let d = "";
      res.on("data", (c) => (d += c));
      res.on("end", () => resolve(d));
    }).on("error", reject);
  });
}

(async () => {
  const out = {};
  for (const c of cats) {
    try {
      const html = await get(`https://mixkit.co/free-sound-effects/${c}/`);
      const ids = [...html.matchAll(/active_storage\/sfx\/(\d+)\/\1-preview\.mp3/g)].map((m) => +m[1]);
      out[c] = [...new Set(ids)].slice(0, 15);
      console.log(c, out[c].length, out[c].slice(0, 5).join(","));
    } catch (e) {
      console.log(c, "fail");
    }
  }
  fs.writeFileSync("c:/Users/Ultima/Desktop/StimPad/tools/mixkit_category_ids.json", JSON.stringify(out, null, 2));
})();
