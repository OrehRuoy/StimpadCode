#!/usr/bin/env node
const https = require("https");

function get(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => resolve({ status: res.statusCode, d }));
      })
      .on("error", reject);
  });
}

async function scrape(c) {
  const { status, d: html } = await get(`https://mixkit.co/free-sound-effects/${c}/`);
  if (status !== 200) {
    console.log(c, "HTTP", status);
    return;
  }
  const ids = [...html.matchAll(/active_storage\/sfx\/(\d+)\/\1-preview/g)].map((m) => m[1]);
  const titles = [...html.matchAll(/item-grid-card__title[^>]*>([^<]+)/g)].map((m) =>
    m[1].replace(/\s+/g, " ").trim()
  );
  const unique = [...new Set(ids)];
  if (!unique.length) {
    console.log(c, "(empty)");
    return;
  }
  console.log("===", c);
  for (let i = 0; i < Math.min(12, unique.length); i++) {
    console.log(`${unique[i]}\t${titles[i] || "?"}`);
  }
}

(async () => {
  for (const c of [
    "game",
    "video-game",
    "technology",
    "coins",
    "keys",
    "camera",
    "elevator",
    "coffee",
    "cricket",
    "insect",
    "heartbeat",
    "cash",
    "printer",
    "garage",
    "chainsaw",
    "motorcycle",
    "train",
    "aircraft",
    "knock",
    "creak",
    "win",
    "interface",
    "notification",
    "sci-fi",
  ]) {
    try {
      await scrape(c);
    } catch (e) {
      console.log(c, e.message);
    }
  }
  const ids = [
    1, 96, 1196, 1059, 1330, 1919, 855, 2699, 39, 2721, 796, 444, 492, 1838, 1821,
    2556, 1782, 800, 803, 2706, 3019, 2472, 3126, 96, 93, 2414, 2556, 1076,
  ];
  for (const id of [...new Set(ids)]) {
    const url = `https://assets.mixkit.co/active_storage/sfx/${id}/${id}-preview.mp3`;
    const { status } = await get(url);
    console.log("CDN", id, status);
  }
})();
