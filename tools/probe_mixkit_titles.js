const https = require("https");
const fs = require("fs");
const path = require("path");

function get(url) {
  return new Promise((res, rej) => {
    https
      .get(url, { headers: { "User-Agent": "Mozilla/5.0 StimPad" } }, (r) => {
        if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) {
          get(new URL(r.headers.location, url).href).then(res).catch(rej);
          return;
        }
        let d = Buffer.alloc(0);
        r.on("data", (c) => (d = Buffer.concat([d, c])));
        r.on("end", () => res({ status: r.statusCode, body: d, headers: r.headers }));
      })
      .on("error", rej);
  });
}

async function mixkitTitle(id) {
  // try a few slug patterns; page title often in <title>
  const guesses = [
    `${id}`,
    `${id}-ambulance-siren-us`,
    `${id}-fire-truck-siren-us`,
    `${id}-police-siren`,
    `${id}-alarm-clock-beep`,
    `${id}-smoke-alarm-detector`,
    `${id}-bicycle-bell-ring`,
    `${id}-classic-alarm`,
    `${id}-morning-clock-alarm`,
    `${id}-europe-fire-truck-siren`,
    `${id}-manual-siren-fire-alert`,
    `${id}-vintage-manual-fire-siren`,
    `${id}-ambulance-siren-uk`,
    `${id}-city-alert-siren-loop`,
    `${id}-bike-bell-ring`,
    `${id}-whistle`,
  ];
  for (const g of guesses) {
    const url = `https://mixkit.co/free-sound-effects/download/${g}/`;
    const { status, body } = await get(url);
    if (status !== 200) continue;
    const html = body.toString("utf8");
    const t = (html.match(/<title>([^<]+)<\/title>/i) || [])[1] || "";
    const h1 = (html.match(/<h1[^>]*>([^<]+)<\/h1>/i) || [])[1] || "";
    if (/404|not found/i.test(t)) continue;
    console.log("MIXKIT", id, "slug", g, "title:", t.trim(), "|", h1.trim());
    return { id, slug: g, title: h1 || t };
  }
  console.log("MIXKIT", id, "no page");
  return null;
}

(async () => {
  for (const id of [998, 999, 997, 610, 611, 609, 608, 612, 1643, 1611, 1612, 1028, 1027, 1029, 615, 616, 614, 1800, 1801, 500, 501, 235, 236, 240, 250, 300, 400, 700, 800, 900, 1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1900, 2000]) {
    await mixkitTitle(id);
  }
})().catch(console.error);
