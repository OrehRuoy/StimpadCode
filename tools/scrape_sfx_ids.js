const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");

function get(url) {
  return new Promise((res, rej) => {
    const lib = url.startsWith("https") ? https : http;
    lib
      .get(url, { headers: { "User-Agent": "Mozilla/5.0 StimPad" } }, (r) => {
        if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) {
          const next = new URL(r.headers.location, url).href;
          get(next).then(res).catch(rej);
          return;
        }
        let d = "";
        r.setEncoding("utf8");
        r.on("data", (c) => (d += c));
        r.on("end", () => res({ status: r.statusCode, body: d, url }));
      })
      .on("error", rej);
  });
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const lib = url.startsWith("https") ? https : http;
    lib
      .get(url, { headers: { "User-Agent": "Mozilla/5.0 StimPad" } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.close();
          fs.unlinkSync(dest);
          download(new URL(res.headers.location, url).href, dest).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode !== 200) {
          file.close();
          fs.unlink(dest, () => {});
          reject(new Error(`HTTP ${res.statusCode} ${url}`));
          return;
        }
        res.pipe(file);
        file.on("finish", () => file.close(() => resolve(dest)));
      })
      .on("error", reject);
  });
}

async function scrapeMixkitCategory(catUrl) {
  const { status, body } = await get(catUrl);
  const re = /free-sound-effects\/download\/(\d+)-([a-z0-9-]+)/g;
  const uniq = [];
  const seen = new Set();
  let m;
  while ((m = re.exec(body))) {
    if (seen.has(m[1])) continue;
    seen.add(m[1]);
    uniq.push({ id: Number(m[1]), slug: m[2] });
  }
  console.log(catUrl, status, uniq.length);
  for (const u of uniq) console.log(`  ${u.id} ${u.slug}`);
  return uniq;
}

async function findBigSoundBankMp3(pageUrl) {
  const { body } = await get(pageUrl);
  // Common patterns on bigsoundbank
  const candidates = [];
  const re1 = /href="([^"]+\.mp3)"/gi;
  let m;
  while ((m = re1.exec(body))) candidates.push(m[1]);
  const re2 = /https?:\/\/[^"' ]+\.mp3/gi;
  while ((m = re2.exec(body))) candidates.push(m[0]);
  // relative DOWNLOAD links
  const re3 = /href="(\/UPLOAD\/[^"]+)"/gi;
  while ((m = re3.exec(body))) candidates.push("https://bigsoundbank.com" + m[1]);
  console.log("BSB page", pageUrl);
  console.log(" candidates", [...new Set(candidates)].slice(0, 15));
  return [...new Set(candidates)];
}

(async () => {
  await scrapeMixkitCategory("https://mixkit.co/free-sound-effects/siren/");
  await scrapeMixkitCategory("https://mixkit.co/free-sound-effects/alarm/");
  await scrapeMixkitCategory("https://mixkit.co/free-sound-effects/bell/");
  await scrapeMixkitCategory("https://mixkit.co/free-sound-effects/whistle/");

  for (const page of [
    "https://bigsoundbank.com/bicycle-bell-3-s0974.html",
    "https://bigsoundbank.com/mechanical-alarm-clock-ring-3-s2659.html",
    "https://bigsoundbank.com/national-alert-signal-s3259.html",
    "https://bigsoundbank.com/ambulance-siren-2-s1464.html",
  ]) {
    await findBigSoundBankMp3(page);
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
