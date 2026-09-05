#!/usr/bin/env python3
"""
download.py — download a YouTube URL via yt-dlp into the radio queue.

Usage:
  python3 download.py <youtube_url> [--requests]
  --requests  → put into /opt/radio/requests/ instead of /opt/radio/queue/

Writes the absolute path to stdout so liquidsoap's playlist sees it.
Also appends to the appropriate .m3u.
"""

import argparse
import json
import os
import re
import subprocess
import uuid
from pathlib import Path

QUEUE_DIR = Path("/opt/radio/queue")
REQUESTS_DIR = Path("/opt/radio/requests")

SAFE_RE = re.compile(r"[^A-Za-z0-9 _\-.()]")


def sanitize(s: str) -> str:
    return SAFE_RE.sub("", s)[:120].strip() or "untitled"


def download(url: str, into: Path) -> Path:
    into.mkdir(parents=True, exist_ok=True)

    # Probe metadata first
    try:
        raw = subprocess.check_output(
            ["yt-dlp", "--no-playlist", "--print-json", "--skip-download", url],
            text=True,
            timeout=30,
        )
        meta = json.loads(raw.strip().splitlines()[0])
    except Exception:
        meta = {}

    title = sanitize(meta.get("title", "untitled"))
    artist = sanitize(meta.get("uploader", "Unknown"))
    uid = uuid.uuid4().hex[:8]
    out_tmpl = str(into / f"{artist} - {title} [{uid}].%(ext)s")

    subprocess.run(
        [
            "yt-dlp",
            "--no-playlist",
            "-x",
            "--audio-format", "mp3",
            "--audio-quality", "192K",
            "--embed-metadata",
            "-o", out_tmpl,
            url,
        ],
        check=True,
        timeout=300,
    )

    # Find the produced file
    for p in into.glob(f"*[{uid}].mp3"):
        return p
    # fallback: newest mp3
    files = sorted(into.glob("*.mp3"), key=lambda p: p.stat().st_mtime)
    if files:
        return files[-1]
    raise RuntimeError("yt-dlp produced no mp3 file")


def append_to_m3u(m3u: Path, track: Path):
    m3u.parent.mkdir(parents=True, exist_ok=True)
    with open(m3u, "a", encoding="utf-8") as f:
        f.write(str(track) + "\n")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("url")
    parser.add_argument("--requests", action="store_true",
                        help="add to requests queue instead of main queue")
    args = parser.parse_args()

    dest = REQUESTS_DIR if args.requests else QUEUE_DIR
    m3u = dest / ("requests.m3u" if args.requests else "queue.m3u")

    track = download(args.url, dest)
    append_to_m3u(m3u, track)
    print(str(track), flush=True)


if __name__ == "__main__":
    main()
