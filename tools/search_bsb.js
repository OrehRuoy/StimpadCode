const https = require("https");

function get(url) {
  return new Promise((res, rej) => {
    https
      .get(url, { headers: { "User-Agent": "Mozilla/5.0 StimPad" } }, (r) => {
        if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) {
          get(new URL(r.headers.location, url).href).then(res).catch(rej);
          return;
        }
        let d = "";
        r.on("data", (c) => (d += c));
        r.on("end", () => res(d));
      })
      .on("error", rej);
  });
}

function extractHits(body) {
  const hits = [];
  const seen = new Set();
  // sound-XXXX-slug.html or name-sNNNN.html
  const re = /href="([^"]*?-s(\d+)\.html)"/gi;
  let m;
  while ((m = re.exec(body))) {
    if (seen.has(m[2])) continue;
    seen.add(m[2]);
    hits.push({ id: m[2], href: m[1].startsWith("http") ? m[1] : "https://bigsoundbank.com" + m[1] });
  }
  const re2 = /href="(\/sound-(\d+)-[^"]+\.html)"/gi;
  while ((m = re2.exec(body))) {
    if (seen.has(m[2])) continue;
    seen.add(m[2]);
    hits.push({ id: m[2], href: "https://bigsoundbank.com" + m[1] });
  }
  return hits;
}

(async () => {
  for (const q of [
    "siren",
    "ambulance",
    "fire",
    "whistle",
    "smoke",
    "alarm",
    "bicycle",
    "bell",
    "civil",
  ]) {
    const body = await get("https://bigsoundbank.com/search?q=" + encodeURIComponent(q));
    const hits = extractHits(body);
    console.log("===", q, "hits", hits.length, "===");
    for (const h of hits.slice(0, 20)) console.log(h.id, h.href);
  }

  // Also probe Mixkit download pages for known titles
  const mixkitGuesses = [
    "998-ambulance-siren-us",
    "610-fire-truck-siren-us",
    "1643-police-siren",
    "615-alarm-clock-beep",
    "1611-smoke-alarm-detector",
    "1028-bicycle-bell-ring",
  ];
  // Try nearby IDs for fire truck / ambulance by HEAD
  console.log("\\n=== mixkit head probes ===");
  for (const id of [998, 999, 997, 610, 611, 609, 608, 612, 1643, 1611, 1610, 1612, 1028, 1027, 1029, 615, 616, 614, 1800, 1801, 500, 501]) {
    const url = `https://assets.mixkit.co/active_storage/sfx/${id}/${id}-preview.mp3`;
    await new Promise((resolve) => {
      https
        .request(url, { method: "HEAD", headers: { "User-Agent": "StimPad" } }, (r) => {
          const len = r.headers["content-length"];
          if (r.statusCode === 200) console.log("OK", id, "bytes", len);
          r.resume();
          resolve();
        })
        .on("error", () => resolve())
        .end();
    });
  }
})().catch(console.error);
