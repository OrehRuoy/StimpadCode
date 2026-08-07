const https = require("https");
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
async function info(id) {
  const d = await get("https://freesound.org/s/" + id + "/");
  let lic = "?";
  if (/Creative Commons 0|CC0/i.test(d)) lic = "CC0";
  else if (/Attribution-NonCommercial|BY-NC/i.test(d)) lic = "BY-NC";
  else if (/Attribution/i.test(d)) lic = "CC BY";
  const title = ((d.match(/<h1[^>]*>\s*([^<]+)/) || [])[1] || "").trim().replace(/\s+/g, " ");
  const m = d.match(/cdn\.freesound\.org\/previews\/\d+\/(\d+_\d+)/);
  return { id, lic, title: title.slice(0, 70), prev: !!m };
}
(async () => {
  const pages = [
    "https://freesound.org/search/?q=crumpling+paper&f=license%3A%22Creative+Commons+0%22&s=rating_desc",
    "https://freesound.org/search/?q=ice+cubes+crunching&f=license%3A%22Creative+Commons+0%22&s=rating_desc",
    "https://freesound.org/search/?q=popcorn+popping&f=license%3A%22Creative+Commons+0%22&s=rating_desc",
    "https://freesound.org/search/?q=rotary+phone+ring&f=license%3A%22Creative+Commons+0%22&s=rating_desc",
    "https://freesound.org/search/?q=dial+tone&f=license%3A%22Creative+Commons+0%22&s=rating_desc",
    "https://freesound.org/search/?q=ice+in+glass&f=license%3A%22Creative+Commons+0%22&s=rating_desc",
  ];
  for (const u of pages) {
    const d = await get(u);
    const re = /\/sounds\/(\d+)\//g;
    const ids = [];
    let m;
    while ((m = re.exec(d))) ids.push(m[1]);
    console.log("---", decodeURIComponent(u.split("q=")[1].split("&")[0]));
    for (const id of [...new Set(ids)].slice(0, 8)) console.log(JSON.stringify(await info(id)));
  }
})().catch((e) => console.error(e));
