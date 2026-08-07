const https = require("https");
const ids = {
  paper_long: [725251, 851248, 272015, 502044, 151232, 41551],
  popcorn: [792666, 766377, 220929, 413, 91261],
  phone: [556499, 274436, 345805, 253564, 209578],
  scissors: [11738, 167699, 253886, 411087, 516152],
  xylo: [316902, 411089, 316899, 457537, 213148, 139962, 254818, 316901],
  metro: [468],
};

function get(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "Mozilla/5.0 StimPad" } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location)
          return get(new URL(res.headers.location, url).href).then(resolve).catch(reject);
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => resolve(d));
      })
      .on("error", reject);
  });
}

async function probe(id) {
  const html = await get("https://freesound.org/s/" + id + "/");
  let lic = "?";
  if (/Creative Commons 0|CC0|PUBLIC.*DOMAIN/i.test(html)) lic = "CC0";
  else if (/Attribution-NonCommercial|BY-NC/i.test(html)) lic = "BY-NC";
  else if (/Attribution/i.test(html)) lic = "CC BY";
  else if (/Sampling\+/i.test(html)) lic = "Sampling+";
  const title = (html.match(/<h1[^>]*>([^<]+)/) || [,""])[1].trim().slice(0, 60);
  const dur = (html.match(/Duration[\s\S]*?(\d+:\d+\.\d+)/) || [, "?"])[1];
  const prev = /cdn\.freesound\.org\/previews\//.test(html);
  return { id, lic, title, dur, prev };
}

(async () => {
  for (const [g, list] of Object.entries(ids)) {
    console.log("\n== " + g + " ==");
    for (const id of list) {
      if (id < 10000 && String(id).length <= 4) {
        // skip tiny BSB ids in FS probe
        continue;
      }
      try {
        console.log(JSON.stringify(await probe(id)));
      } catch (e) {
        console.log(JSON.stringify({ id, err: String(e.message || e) }));
      }
    }
  }
})();
