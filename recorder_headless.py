#!/usr/bin/env python3
"""
Headless audio recorder + compiler for Raspberry Pi.
No screen needed. Record via GPIO button (or keyboard) — stitch to WAV.

Hardware (optional):
  GPIO 17 → record button (active-low, internal pull-up)
  GPIO 27 → stitch button
  GPIO 22 → LED indicator (blinks while recording)

Run:
  python3 recorder_headless.py            # keyboard mode
  python3 recorder_headless.py --gpio     # GPIO button mode
  python3 recorder_headless.py --stitch   # stitch all saved clips and exit

Dependencies:
  sudo apt install alsa-utils             # arecord (usually pre-installed)
  pip3 install RPi.GPIO                   # only needed for --gpio mode
"""

import argparse
import os
import subprocess
import sys
import threading
import time
import wave
import glob

CLIPS_DIR = os.path.join(os.path.dirname(__file__), "clips")
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "compilations")

# GPIO pins (BCM numbering)
PIN_RECORD = 17
PIN_STITCH = 27
PIN_LED    = 22

# arecord settings — tune to your mic
SAMPLE_RATE  = 44100
CHANNELS     = 1
BIT_DEPTH    = 16   # S16_LE
DEVICE       = "default"   # change to "plughw:1,0" if needed


# ─── helpers ────────────────────────────────────────────────────────────────

def ensure_dirs():
    os.makedirs(CLIPS_DIR,  exist_ok=True)
    os.makedirs(OUTPUT_DIR, exist_ok=True)

def log(msg):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)

def next_clip_path():
    existing = sorted(glob.glob(os.path.join(CLIPS_DIR, "clip_*.wav")))
    idx = len(existing) + 1
    return os.path.join(CLIPS_DIR, f"clip_{idx:03d}_{int(time.time())}.wav")

def list_clips():
    return sorted(glob.glob(os.path.join(CLIPS_DIR, "clip_*.wav")))

def fmt_dur(seconds):
    m = int(seconds // 60)
    s = seconds % 60
    return f"{m}:{s:04.1f}"


# ─── recording ──────────────────────────────────────────────────────────────

_record_proc  = None
_record_start = None
_record_path  = None
_record_lock  = threading.Lock()

def start_recording():
    global _record_proc, _record_start, _record_path
    with _record_lock:
        if _record_proc is not None:
            return False   # already recording
        path = next_clip_path()
        cmd = [
            "arecord",
            "-D", DEVICE,
            "-f", f"S{BIT_DEPTH}_LE",
            "-r", str(SAMPLE_RATE),
            "-c", str(CHANNELS),
            "-t", "wav",
            path,
        ]
        _record_proc  = subprocess.Popen(cmd, stderr=subprocess.DEVNULL)
        _record_start = time.time()
        _record_path  = path
        log(f"● REC  → {os.path.basename(path)}")
        return True

def stop_recording():
    global _record_proc, _record_start, _record_path
    with _record_lock:
        if _record_proc is None:
            return None
        _record_proc.terminate()
        _record_proc.wait()
        duration = time.time() - _record_start
        path = _record_path
        _record_proc  = None
        _record_start = None
        _record_path  = None
        log(f"■ STOP  {fmt_dur(duration)}  saved → {os.path.basename(path)}")
        return path

def is_recording():
    return _record_proc is not None


# ─── stitching ──────────────────────────────────────────────────────────────

def stitch_clips(clip_paths=None, output_path=None):
    if clip_paths is None:
        clip_paths = list_clips()
    if not clip_paths:
        log("Nothing to stitch — no clips found.")
        return None

    if output_path is None:
        output_path = os.path.join(OUTPUT_DIR, f"compilation_{int(time.time())}.wav")

    log(f"Stitching {len(clip_paths)} clip(s)…")

    params = None
    frames = []

    for i, path in enumerate(clip_paths):
        log(f"  [{i+1}/{len(clip_paths)}] {os.path.basename(path)}")
        try:
            with wave.open(path, "rb") as wf:
                if params is None:
                    params = wf.getparams()
                elif (wf.getnchannels(), wf.getsampwidth(), wf.getframerate()) != \
                     (params.nchannels, params.sampwidth, params.framerate):
                    log(f"  ⚠ skipping {os.path.basename(path)} — format mismatch")
                    continue
                frames.append(wf.readframes(wf.getnframes()))
        except Exception as e:
            log(f"  ✗ could not read {os.path.basename(path)}: {e}")

    if not frames:
        log("No valid clips to stitch.")
        return None

    with wave.open(output_path, "wb") as out:
        out.setparams(params)
        for chunk in frames:
            out.writeframes(chunk)

    total_bytes    = sum(len(f) for f in frames)
    total_seconds  = total_bytes / (params.framerate * params.nchannels * params.sampwidth)
    log(f"✓ Compilation saved → {output_path}  ({fmt_dur(total_seconds)})")
    return output_path


# ─── keyboard mode ──────────────────────────────────────────────────────────

def run_keyboard():
    log("Keyboard mode. Commands:")
    log("  r  — toggle record")
    log("  s  — stitch all clips")
    log("  l  — list clips")
    log("  q  — quit")

    import tty, termios

    fd   = sys.stdin.fileno()
    old  = termios.tcgetattr(fd)
    try:
        tty.setraw(fd)
        while True:
            ch = sys.stdin.read(1)
            if ch in ("r", "R"):
                if is_recording():
                    stop_recording()
                else:
                    start_recording()
            elif ch in ("s", "S"):
                if is_recording():
                    stop_recording()
                stitch_clips()
            elif ch in ("l", "L"):
                clips = list_clips()
                if clips:
                    for p in clips:
                        log(f"  {os.path.basename(p)}")
                else:
                    log("  (no clips)")
            elif ch in ("q", "Q", "\x03"):
                if is_recording():
                    stop_recording()
                break
    finally:
        termios.tcsetattr(fd, termios.TCSADRAIN, old)


# ─── GPIO mode ──────────────────────────────────────────────────────────────

def run_gpio():
    try:
        import RPi.GPIO as GPIO
    except ImportError:
        log("RPi.GPIO not found — install with: pip3 install RPi.GPIO")
        sys.exit(1)

    GPIO.setmode(GPIO.BCM)
    GPIO.setup(PIN_RECORD, GPIO.IN,  pull_up_down=GPIO.PUD_UP)
    GPIO.setup(PIN_STITCH, GPIO.IN,  pull_up_down=GPIO.PUD_UP)
    GPIO.setup(PIN_LED,    GPIO.OUT, initial=GPIO.LOW)

    log(f"GPIO mode. Pins: record={PIN_RECORD}, stitch={PIN_STITCH}, LED={PIN_LED}")
    log("Press record button to start/stop. Press stitch button to compile.")

    # blink LED while recording
    def led_blink():
        while True:
            if is_recording():
                GPIO.output(PIN_LED, GPIO.HIGH)
                time.sleep(0.5)
                GPIO.output(PIN_LED, GPIO.LOW)
                time.sleep(0.5)
            else:
                GPIO.output(PIN_LED, GPIO.LOW)
                time.sleep(0.1)

    threading.Thread(target=led_blink, daemon=True).start()

    def on_record(channel):
        time.sleep(0.05)   # debounce
        if GPIO.input(channel) == GPIO.LOW:
            if is_recording():
                stop_recording()
            else:
                start_recording()

    def on_stitch(channel):
        time.sleep(0.05)
        if GPIO.input(channel) == GPIO.LOW:
            if is_recording():
                stop_recording()
            stitch_clips()

    GPIO.add_event_detect(PIN_RECORD, GPIO.FALLING, callback=on_record, bouncetime=300)
    GPIO.add_event_detect(PIN_STITCH, GPIO.FALLING, callback=on_stitch, bouncetime=300)

    log("Running — Ctrl+C to quit.")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        if is_recording():
            stop_recording()
    finally:
        GPIO.cleanup()


# ─── main ────────────────────────────────────────────────────────────────────

def main():
    ensure_dirs()

    parser = argparse.ArgumentParser(description="Headless audio recorder for Raspberry Pi")
    parser.add_argument("--gpio",   action="store_true", help="Use GPIO buttons (requires RPi.GPIO)")
    parser.add_argument("--stitch", action="store_true", help="Stitch all clips and exit")
    parser.add_argument("--device", default=DEVICE,      help=f"ALSA device (default: {DEVICE})")
    args = parser.parse_args()

    global DEVICE
    DEVICE = args.device

    if args.stitch:
        stitch_clips()
        return

    if args.gpio:
        run_gpio()
    else:
        run_keyboard()


if __name__ == "__main__":
    main()
