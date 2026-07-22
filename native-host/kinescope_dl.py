#!/usr/bin/env python3
"""Native-messaging host: download a Kinescope HLS stream with yt-dlp.

Chrome talks to this over stdio using the native-messaging framing
(4-byte little-endian length prefix + UTF-8 JSON). It receives one command
{url, mode, title, referer}, runs yt-dlp (which does the HLS byte-range fetch
and the video+audio mux), streams {type:'progress',pct} back, then a final
{type:'done',file} or {type:'error',msg}.

ponytail: yt-dlp already handles HLS + muxing + retries robustly and streams to
disk — reimplementing that in the extension would be far more code and OOM on
big lectures. This host is the whole "hard part", ~2 screens.
"""
import json
import os
import re
import struct
import subprocess
import sys

# ponytail: fixed output dir. Change this one line to download elsewhere.
DOWNLOAD_DIR = os.path.expanduser("~/Downloads")

# Chrome launches native hosts with a bare PATH — yt-dlp/ffmpeg live in these on
# a typical Homebrew/macOS box. Prepend them so both are found.
os.environ["PATH"] = "/opt/homebrew/bin:/usr/local/bin:" + os.environ.get("PATH", "")

PCT_RE = re.compile(r"\[download\]\s+([\d.]+)%")
DEST_RE = re.compile(r'(?:Destination:|Merging formats into|has already been downloaded)[ "]+(.+?)"?\s*$')


def read_message():
    """Read one framed message from stdin, or None on EOF."""
    raw_len = sys.stdin.buffer.read(4)
    if len(raw_len) < 4:
        return None
    (length,) = struct.unpack("=I", raw_len)
    return json.loads(sys.stdin.buffer.read(length).decode("utf-8"))


def send_message(obj):
    data = json.dumps(obj).encode("utf-8")
    sys.stdout.buffer.write(struct.pack("=I", len(data)))
    sys.stdout.buffer.write(data)
    sys.stdout.buffer.flush()


def sanitize(title):
    title = re.sub(r'[<>:"/\\|?*%\x00-\x1f]', "_", title or "").strip()
    return (title or "kinescope-video")[:180]


def build_cmd(url, mode, title, referer):
    out = os.path.join(DOWNLOAD_DIR, sanitize(title) + ".%(ext)s")
    fmt = "ba" if mode == "audio" else "bv*+ba/b"
    cmd = [
        "yt-dlp",
        "-f", fmt,
        "--add-header", f"Referer: {referer}",
        "--newline",
        "--no-playlist",
        "-o", out,
    ]
    if mode != "audio":
        cmd += ["--merge-output-format", "mp4"]
    cmd.append(url)
    return cmd


def run(cmd):
    """Run yt-dlp, stream progress, return (returncode, last_dest, tail)."""
    proc = subprocess.Popen(
        cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
        text=True, bufsize=1,
    )
    last_dest, tail = "", []
    last_pct = -1
    for line in proc.stdout:
        line = line.rstrip("\n")
        tail.append(line)
        del tail[:-15]  # keep only the last lines for error context
        m = PCT_RE.search(line)
        if m:
            pct = float(m.group(1))
            if pct - last_pct >= 1 or pct >= 100:  # throttle: ~1% steps
                last_pct = pct
                send_message({"type": "progress", "pct": pct})
        d = DEST_RE.search(line)
        if d:
            last_dest = d.group(1)
    proc.wait()
    return proc.returncode, last_dest, "\n".join(tail)


def main():
    msg = read_message()
    if not msg or not msg.get("url"):
        send_message({"type": "error", "msg": "no command received"})
        return
    try:
        cmd = build_cmd(msg["url"], msg.get("mode", "video"),
                        msg.get("title", ""), msg.get("referer", "https://kinescope.io/"))
        code, dest, tail = run(cmd)
        if code == 0:
            send_message({"type": "done", "file": dest})
        else:
            send_message({"type": "error", "msg": f"yt-dlp exit {code}: {tail[-500:]}"})
    except FileNotFoundError:
        send_message({"type": "error", "msg": "yt-dlp not found in PATH (install it / fix PATH in kinescope_dl.py)"})
    except Exception as e:  # noqa: BLE001 — surface anything to the UI button
        send_message({"type": "error", "msg": str(e)})


if __name__ == "__main__":
    main()
