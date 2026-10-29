#!/usr/bin/env python3
"""Put en/de/fr/es/pt-BR/ja .lproj folders into a Godot iOS export.

App Store Connect lists languages from .lproj directories inside the .app.
Godot 4.6 writes those only when Project Settings registers translation
resources. StimPad loads locale/messages.json itself, so the export otherwise
ships the template's en.lproj and the store says English only.

CFBundleLocalizations in export_presets.cfg is the matching Info.plist list.
The app name stays "StimPad" in every language.
Same approach as Taptico/Oil Due (tools/ios/add_store_localizations.py).
"""

from __future__ import annotations

import re
import sys
import tempfile
from pathlib import Path


LOCALES = ("en", "de", "fr", "es", "pt-BR", "ja")
EXTRA_LOCALES = LOCALES[1:]
APP_NAME = "StimPad"
FILE_IDS = {
	"de": "E7B0A00118AEBDA2004A0001",
	"fr": "E7B0A00118AEBDA2004A0002",
	"es": "E7B0A00118AEBDA2004A0003",
	"pt-BR": "E7B0A00118AEBDA2004A0004",
	"ja": "E7B0A00118AEBDA2004A0005",
}
STRINGS = (
	"/* Localized versions of Info.plist keys */\n"
	"\n"
	'CFBundleDisplayName = "StimPad";\n'
	'CFBundleName = "StimPad";\n'
)


def strings_text() -> str:
	if APP_NAME != "StimPad" or '"StimPad"' not in STRINGS:
		raise RuntimeError("localization strings drifted")
	return STRINGS


def write_lproj(app_src: Path) -> None:
	text = strings_text()
	for lang in LOCALES:
		folder = app_src / f"{lang}.lproj"
		folder.mkdir(parents=True, exist_ok=True)
		(folder / "InfoPlist.strings").write_text(text, encoding="utf-8")


def _q(lang: str) -> str:
	# pbxproj quotes values with "-" (pt-BR); plain ones stay bare like Xcode writes them.
	return f'"{lang}"' if "-" in lang else lang


def _qpath(lang: str) -> str:
	p = f"{lang}.lproj/InfoPlist.strings"
	return f'"{p}"' if "-" in lang else p


def _file_ref_id(text: str, lang: str) -> str:
	l = re.escape(lang)
	match = re.search(
		rf'([A-F0-9]{{24}}) /\* {l} \*/ = \{{isa = PBXFileReference;[^}}]*path = "?{l}\.lproj/InfoPlist\.strings"?;',
		text,
	)
	return match.group(1) if match else ""


def _insert_after(text: str, pattern: str, addition: str) -> str:
	match = re.search(pattern, text, re.M)
	if not match:
		raise SystemExit(f"pbxproj is missing expected line: {pattern}")
	at = match.end()
	if text[at:at + 1] == "\n":
		at += 1
	return text[:at] + addition + text[at:]


def patch_pbxproj(text: str) -> str:
	en_line = re.search(
		r"^(\t*)([A-F0-9]{24}) /\* en \*/ = \{isa = PBXFileReference;[^}]*path = en\.lproj/InfoPlist\.strings;.*\};\s*$",
		text,
		re.M,
	)
	if not en_line:
		raise SystemExit("pbxproj has no en.lproj/InfoPlist.strings file reference")
	indent = en_line.group(1)
	for lang in EXTRA_LOCALES:
		if _file_ref_id(text, lang):
			continue
		file_id = FILE_IDS[lang]
		line = (
			f"{indent}{file_id} /* {lang} */ = {{isa = PBXFileReference; "
			f"lastKnownFileType = text.plist.strings; name = {_q(lang)}; "
			f'path = {_qpath(lang)}; sourceTree = "<group>"; }};\n'
		)
		text = _insert_after(text, re.escape(en_line.group(0)), line)
		en_line = re.search(re.escape(en_line.group(0)), text)
		if en_line is None:
			raise SystemExit("lost the en file reference while patching")

	variant = re.search(
		r"(/\* Begin PBXVariantGroup section \*/.*?/\* End PBXVariantGroup section \*/)",
		text,
		re.S,
	)
	if not variant:
		raise SystemExit("pbxproj has no PBXVariantGroup for InfoPlist.strings")
	block = variant.group(1)
	updated = block
	for lang in EXTRA_LOCALES:
		file_id = _file_ref_id(text, lang)
		if not file_id:
			raise SystemExit(f"no file reference for {lang}.lproj after patching")
		if re.search(rf"{file_id} /\* {re.escape(lang)} \*/", updated):
			continue
		child = f"\t\t\t\t{file_id} /* {lang} */,\n"
		marker = re.search(r"(/\* en \*/,)\n", updated)
		if not marker:
			raise SystemExit("variant group has no en child")
		updated = updated[: marker.end()] + child + updated[marker.end() :]
	text = text[: variant.start(1)] + updated + text[variant.end(1) :]

	regions = re.search(r"knownRegions = \((.*?)\);", text, re.S)
	if not regions:
		raise SystemExit("pbxproj has no knownRegions")
	body = regions.group(1)
	lines = body.splitlines()
	present = set()
	indent = "\t\t\t\t"
	for line in lines:
		entry = re.match(r'(\s*)"?([A-Za-z0-9-]+)"?\s*,\s*$', line)
		if entry:
			present.add(entry.group(2))
			if entry.group(2) == "Base":
				indent = entry.group(1)
	extra = [f"{indent}{_q(lang)}," for lang in LOCALES if lang not in present]
	if extra:
		rebuilt: list[str] = []
		inserted = False
		for line in lines:
			rebuilt.append(line)
			if re.match(r"\s*Base\s*,\s*$", line):
				rebuilt.extend(extra)
				inserted = True
		if not inserted:
			raise SystemExit("knownRegions has no Base")
		text = text[: regions.start(1)] + "\n".join(rebuilt) + text[regions.end(1) :]
	return text


def app_source(pbx: Path) -> Path:
	project_dir = pbx.parent.parent
	name = pbx.parent.name.removesuffix(".xcodeproj")
	candidate = project_dir / name
	if (candidate / "en.lproj").is_dir() or candidate.is_dir():
		return candidate
	matches = [p.parent for p in project_dir.glob("*/en.lproj")]
	if len(matches) == 1:
		return matches[0]
	raise SystemExit(f"could not find the app source next to {pbx}")


def localize_tree(root: Path) -> int:
	projects = [
		pbx
		for pbx in root.rglob("project.pbxproj")
		if "Pods" not in pbx.parts and pbx.parent.suffix == ".xcodeproj"
	]
	if not projects:
		raise SystemExit(f"no .xcodeproj under {root}")
	changed = 0
	for pbx in projects:
		src = app_source(pbx)
		write_lproj(src)
		original = pbx.read_text(encoding="utf-8")
		updated = patch_pbxproj(original)
		if updated != original:
			pbx.write_text(updated, encoding="utf-8")
			changed += 1
			print(f"Added {'/'.join(EXTRA_LOCALES)} InfoPlist.strings in {pbx}")
		else:
			print(f"Localizations already present in {pbx}")
		print(f"Wrote {', '.join(lang + '.lproj' for lang in LOCALES)} under {src}")
	return changed


def verify_app(app: Path) -> None:
	missing = []
	for lang in LOCALES:
		path = app / f"{lang}.lproj" / "InfoPlist.strings"
		if not path.is_file():
			missing.append(str(path))
	if missing:
		raise SystemExit("missing localization folders: " + ", ".join(missing))
	print(f"App bundle has {', '.join(lang + '.lproj' for lang in LOCALES)}: {app}")


def _self_test() -> int:
	snippet = """// !$*UTF8*$!
{
	objects = {
		D0BCFE4518AEBDA2004A7AAE /* en */ = {isa = PBXFileReference; lastKnownFileType = text.plist.strings; name = en; path = en.lproj/InfoPlist.strings; sourceTree = "<group>"; };
		D0BCFE7718AEBFEB004A7AAE /* StimPad.pck */ = {isa = PBXFileReference; lastKnownFileType = file; path = "StimPad.pck"; sourceTree = "<group>"; };
			developmentRegion = en;
			knownRegions = (
				en,
				Base,
			);
/* Begin PBXVariantGroup section */
		D0BCFE4418AEBDA2004A7AAE /* InfoPlist.strings */ = {
			isa = PBXVariantGroup;
			children = (
				D0BCFE4518AEBDA2004A7AAE /* en */,
			);
			name = InfoPlist.strings;
			sourceTree = "<group>";
		};
/* End PBXVariantGroup section */
	};
}
"""
	once = patch_pbxproj(snippet)
	twice = patch_pbxproj(once)
	if once != twice:
		print("patch is not idempotent", file=sys.stderr)
		return 1
	for lang in EXTRA_LOCALES:
		if f"path = {_qpath(lang)};" not in once:
			print(f"missing file ref {lang}", file=sys.stderr)
			return 1
		if once.count(f"/* {lang} */") != 2 or not _file_ref_id(once, lang):
			print(f"expected file ref and variant child for {lang}", file=sys.stderr)
			return 1
		if not re.search(rf'(?m)^\s*"?{re.escape(lang)}"?\s*,\s*$', once):
			print(f"missing knownRegions {lang}", file=sys.stderr)
			return 1
	if '"pt-BR",' not in once or 'path = "pt-BR.lproj/InfoPlist.strings";' not in once:
		print("pt-BR must be quoted in pbxproj", file=sys.stderr)
		return 1
	with tempfile.TemporaryDirectory() as tmp:
		root = Path(tmp)
		app = root / "StimPad"
		(app / "en.lproj").mkdir(parents=True)
		(app / "en.lproj" / "InfoPlist.strings").write_text("/* old */\n", encoding="utf-8")
		proj = root / "StimPad.xcodeproj"
		proj.mkdir()
		(proj / "project.pbxproj").write_text(snippet, encoding="utf-8")
		localize_tree(root)
		verify_app(app)
		text = (app / "fr.lproj" / "InfoPlist.strings").read_text(encoding="utf-8")
		if 'CFBundleDisplayName = "StimPad";' not in text or 'CFBundleName = "StimPad";' not in text:
			print(text, file=sys.stderr)
			return 1
		for lang in EXTRA_LOCALES:
			same = (app / f"{lang}.lproj" / "InfoPlist.strings").read_text(encoding="utf-8")
			if same != text:
				print(f"{lang} display name differs", file=sys.stderr)
				return 1
		localize_tree(root)
		verify_app(app)
	print("self-test ok")
	return 0


def main(argv: list[str]) -> int:
	if len(argv) == 2 and argv[1] == "--self-test":
		return _self_test()
	if len(argv) == 3 and argv[1] == "--verify-app":
		verify_app(Path(argv[2]))
		return 0
	if len(argv) != 2:
		print(
			"usage: add_store_localizations.py <build-root> | --self-test | --verify-app <App.app>",
			file=sys.stderr,
		)
		return 1
	localize_tree(Path(argv[1]))
	return 0


if __name__ == "__main__":
	raise SystemExit(main(sys.argv))
