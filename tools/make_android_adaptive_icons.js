const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const src = path.join(__dirname, "..", "assets", "branding", "icon_1024.png");
const outDir = path.join(__dirname, "..", "assets", "branding", "android");

async function main() {
	fs.mkdirSync(outDir, { recursive: true });
	const size = 432;
	const inner = Math.round(size * 0.66);
	const offset = Math.round((size - inner) / 2);
	const logo = await sharp(src)
		.resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
		.png()
		.toBuffer();
	await sharp({
		create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
	})
		.composite([{ input: logo, left: offset, top: offset }])
		.png()
		.toFile(path.join(outDir, "adaptive_foreground_432.png"));

	await sharp({
		create: { width: size, height: size, channels: 3, background: "#1A2230" },
	})
		.png()
		.toFile(path.join(outDir, "adaptive_background_432.png"));

	const { data, info } = await sharp(src)
		.resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });
	const mono = Buffer.alloc(info.width * info.height * 4);
	for (let i = 0; i < info.width * info.height; i++) {
		const alpha = data[i * 4 + 3];
		mono[i * 4] = 255;
		mono[i * 4 + 1] = 255;
		mono[i * 4 + 2] = 255;
		mono[i * 4 + 3] = alpha > 16 ? 255 : 0;
	}
	const monoInner = await sharp(mono, {
		raw: { width: info.width, height: info.height, channels: 4 },
	})
		.png()
		.toBuffer();
	await sharp({
		create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
	})
		.composite([{ input: monoInner, left: offset, top: offset }])
		.png()
		.toFile(path.join(outDir, "adaptive_monochrome_432.png"));

	await sharp(src).resize(192, 192).png().toFile(path.join(outDir, "icon_192.png"));
	console.log("Wrote adaptive icons to assets/branding/android");
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
