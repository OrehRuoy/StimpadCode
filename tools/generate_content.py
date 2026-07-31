#!/usr/bin/env python3
"""Generate bundled placeholder audio (WAV) and per-sound button art (PNG) for StimPad."""

from __future__ import annotations

import json
import math
import random
import struct
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "data" / "sounds.json"
AUDIO_DIR = ROOT / "assets" / "audio"
ART_DIR = ROOT / "assets" / "art" / "sounds"

SAMPLE_RATE = 44100

CATEGORY_COLORS = {
    "Alarms": (220, 80, 70),
    "Bells": (230, 180, 60),
    "Household": (120, 150, 190),
    "Clicks": (180, 190, 200),
    "Vehicles": (90, 110, 150),
    "Water": (70, 150, 210),
    "Noise": (140, 140, 150),
    "Misc": (160, 120, 200),
}


def write_wav(path: Path, samples: list[float]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "w") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        frames = bytearray()
        for s in samples:
            v = max(-1.0, min(1.0, s))
            frames.extend(struct.pack("<h", int(v * 32767)))
        wf.writeframes(frames)


def gen_noise(duration: float, color: str = "white") -> list[float]:
    n = int(SAMPLE_RATE * duration)
    out = []
    last = 0.0
    for _ in range(n):
        white = random.uniform(-1, 1)
        if color == "white":
            out.append(white * 0.35)
        elif color == "pink":
            last = 0.98 * last + 0.02 * white
            out.append(last * 0.5)
        else:
            last = 0.995 * last + 0.005 * white
            out.append(last * 0.7)
    return out


def gen_tone(duration: float, freq: float, pulse: bool = False) -> list[float]:
    n = int(SAMPLE_RATE * duration)
    out = []
    for i in range(n):
        t = i / SAMPLE_RATE
        env = 1.0
        if pulse:
            env = 0.5 + 0.5 * math.sin(2 * math.pi * 2.5 * t)
        s = math.sin(2 * math.pi * freq * t) * env
        if i < 500:
            s *= i / 500
        if i > n - 500:
            s *= (n - i) / 500
        out.append(s * 0.45)
    return out


def gen_siren(duration: float) -> list[float]:
    n = int(SAMPLE_RATE * duration)
    out = []
    for i in range(n):
        t = i / SAMPLE_RATE
        freq = 600 + 400 * (0.5 + 0.5 * math.sin(2 * math.pi * 0.8 * t))
        out.append(math.sin(2 * math.pi * freq * t) * 0.35)
    return out


def gen_audio(sound_id: str, category: str, mode: str) -> list[float]:
    duration = 3.0 if mode == "loop" else 1.2
    if "noise" in sound_id:
        color = "white"
        if "pink" in sound_id:
            color = "pink"
        elif "brown" in sound_id:
            color = "brown"
        return gen_noise(duration, color)
    if "siren" in sound_id or "alarm" in sound_id:
        return gen_siren(duration)
    if category == "Clicks" or mode == "oneshot":
        return gen_tone(0.8, random.choice([440, 660, 880, 1200]), pulse=False)
    if category == "Water":
        return gen_noise(duration, "pink")
    if category == "Household":
        return gen_noise(duration, "brown")
    if category == "Bells":
        return gen_tone(duration, random.choice([880, 990, 1175]), pulse=True)
    return gen_tone(duration, random.choice([300, 450, 600]), pulse=True)


def write_png(path: Path, rgb: tuple[int, int, int], label: str) -> None:
    # Minimal uncompressed PNG writer (no Pillow dependency).
    path.parent.mkdir(parents=True, exist_ok=True)
    w, h = 256, 256
    import zlib

    def chunk(tag: bytes, data: bytes) -> bytes:
        crc = zlib.crc32(tag + data) & 0xFFFFFFFF
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", crc)

    rows = bytearray()
    for y in range(h):
        rows.append(0)
        for x in range(w):
            t = y / h
            r = int(rgb[0] * (0.7 + 0.3 * t))
            g = int(rgb[1] * (0.7 + 0.3 * t))
            b = int(rgb[2] * (0.7 + 0.3 * t))
            if (x - 128) ** 2 + (y - 128) ** 2 < 70 ** 2:
                r, g, b = min(255, r + 40), min(255, g + 40), min(255, b + 40)
            rows.extend([r, g, b])
    ihdr = struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(bytes(rows), 9)) + chunk(b"IEND", b"")
    path.write_bytes(png)


def main() -> None:
    data = json.loads(CATALOG.read_text(encoding="utf-8"))
    for sound in data["sounds"]:
        sid = sound["id"]
        category = sound.get("category", "Misc")
        mode = sound.get("mode", "oneshot")
        audio_path = ROOT / sound["path"].replace("res://", "").replace(".ogg", ".wav")
        art_path = ROOT / sound["art"].replace("res://", "")
        samples = gen_audio(sid, category, mode)
        write_wav(audio_path, samples)
        rgb = CATEGORY_COLORS.get(category, (130, 130, 130))
        write_png(art_path, rgb, sound.get("name", sid))
        # Also write ogg path alias as wav for Godot import compatibility until converted
        ogg_path = ROOT / sound["path"].replace("res://", "")
        if ogg_path.suffix == ".ogg":
            write_wav(ogg_path.with_suffix(".wav"), samples)
    print(f"Generated audio/art for {len(data['sounds'])} sounds")


if __name__ == "__main__":
    main()
