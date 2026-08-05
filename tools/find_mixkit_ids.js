const https = require("https");

function get(url) {
  return new Promise((res, rej) => {
    https
      .get(url, { headers: { "User-Agent": "Mozilla/5.0 StimPad" } }, (r) => {
        let d = "";
        r.on("data", (c) => (d += c));
        r.on("end", () => res({ status: r.statusCode, body: d }));
      })
      .on("error", rej);
  });
}

async function findIds(q) {
  const url =
    "https://mixkit.co/free-sound-effects/search/" + encodeURIComponent(q) + "/";
  const { status, body } = await get(url);
  const re = /free-sound-effects\/download\/(\d+)-([a-z0-9-]+)/g;
  const uniq = [];
  const seen = new Set();
  let m;
  while ((m = re.exec(body))) {
    if (seen.has(m[1])) continue;
    seen.add(m[1]);
    uniq.push(`${m[1]}:${m[2]}`);
  }
  console.log("QUERY", q, "status", status, "hits", uniq.length);
  console.log(uniq.slice(0, 30).join("\n"));
  console.log("---");
}

(async () => {
  for (const q of [
    "ambulance siren",
    "fire truck siren",
    "classic alarm",
    "morning clock alarm",
    "smoke alarm",
    "bicycle bell",
    "bike bell",
    "manual siren",
    "whistle",
    "city alert siren",
    "vintage warning alarm",
    "emergency alert",
  ]) {
    await findIds(q);
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
