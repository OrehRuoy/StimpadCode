#!/usr/bin/env node
/** Fetch Mixkit category pages and print preview SFX IDs + nearby titles. */
const https = require("https");

function get(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "Mozilla/5.0 StimPad/1.0" } }, (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve(data));
      })
      .on("error", reject);
  });
}

async function scrape(cat) {
  const html = await get(`https://mixkit.co/free-sound-effects/${cat}/`);
  const ids = [...html.matchAll(/active_storage\/sfx\/(\d+)\/\1-preview/g)].map((m) => m[1]);
  const titles = [...html.matchAll(/item-grid-card__title[^>]*>([^<]+)/g)].map((m) =>
    m[1].replace(/\s+/g, " ").trim()
  );
  const unique = [...new Set(ids)];
  console.log(`\n=== ${cat} (${unique.length} ids) ===`);
  for (let i = 0; i < Math.min(unique.length, 20); i++) {
    console.log(`${unique[i]}\t${titles[i] || "?"}`);
  }
}

(async () => {
  const cats = [
    "dog",
    "sea",
    "clock",
    "helicopter",
    "drill",
    "fire",
    "appliances",
    "tools",
    "transport",
    "airplane",
    "cat",
    "construction",
    "door",
    "crowd",
    "nature",
    "ambience",
    "office",
    "city",
    "game",
    "arcade",
    "retro",
    "technology",
    " mechan",
    "motorcycle",
    "coins",
    "keys",
    "page",
    "book",
    "camera",
    "elevator",
    "coffee",
    "kettle",
    "cricket",
    "insect",
    "heartbeat",
    "lawn",
    "cash",
    "printer",
    "garage",
    "chainsaw",
  ];
  for (const c of cats.filter((x) => !x.startsWith(" "))) {
    try {
      await scrape(c.trim());
    } catch (e) {
      console.log(c, e.message);
    }
  }
})();
