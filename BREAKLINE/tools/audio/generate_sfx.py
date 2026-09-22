#!/usr/bin/env python3
"""Generates original, license-free procedural SFX for BREAKLINE.

Pure stdlib synthesis (sine/noise/envelopes) -- no samples, no copyrighted
material of any kind. Run from anywhere with `python3 generate_sfx.py`;
writes 16-bit PCM mono WAV files at 44100Hz directly into
BREAKLINE/assets/audio/sfx/, overwriting the checked-in placeholders.
This is the source of those files -- tune the synthesis functions below
and re-run instead of hand-editing the .wav output.
"""
import math
import random
import struct
import wave
import os

SR = 44100
OUT_DIR = os.path.normpath(
    os.path.join(os.path.dirname(__file__), "..", "..", "assets", "audio", "sfx")
)
os.makedirs(OUT_DIR, exist_ok=True)

random.seed(1337)


def _clip(x):
    return max(-1.0, min(1.0, x))


def sine(freq, duration, amp=0.5, fade_in=0.005, fade_out=0.02, phase0=0.0):
    n = int(SR * duration)
    out = []
    for i in range(n):
        t = i / SR
        env = 1.0
        if t < fade_in:
            env = t / fade_in
        elif t > duration - fade_out:
            env = max(0.0, (duration - t) / fade_out)
        out.append(amp * env * math.sin(2 * math.pi * freq * t + phase0))
    return out


def sweep(freq_start, freq_end, duration, amp=0.5, fade_in=0.005, fade_out=0.02):
    n = int(SR * duration)
    out = []
    phase = 0.0
    for i in range(n):
        t = i / SR
        f = freq_start + (freq_end - freq_start) * (t / duration)
        phase += 2 * math.pi * f / SR
        env = 1.0
        if t < fade_in:
            env = t / fade_in
        elif t > duration - fade_out:
            env = max(0.0, (duration - t) / fade_out)
        out.append(amp * env * math.sin(phase))
    return out


def noise_burst(duration, amp=0.5, decay=6.0):
    n = int(SR * duration)
    out = []
    for i in range(n):
        t = i / SR
        env = math.exp(-decay * t)
        out.append(amp * env * (random.uniform(-1.0, 1.0)))
    return out


def silence(duration):
    return [0.0] * int(SR * duration)


def mix(*tracks):
    length = max(len(t) for t in tracks)
    out = [0.0] * length
    for t in tracks:
        for i, v in enumerate(t):
            out[i] += v
    return [_clip(v) for v in out]


def concat(*tracks):
    out = []
    for t in tracks:
        out.extend(t)
    return out


def write_wav(name, samples):
    path = os.path.join(OUT_DIR, f"{name}.wav")
    with wave.open(path, "w") as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(SR)
        frames = b"".join(struct.pack("<h", int(_clip(s) * 32000)) for s in samples)
        f.writeframes(frames)
    print(f"wrote {path} ({len(samples) / SR:.3f}s)")


# --- projectile_fire: quick rising sci-fi blip -----------------------------
write_wav("projectile_fire", sweep(420, 1400, 0.12, amp=0.45, fade_out=0.04))

# --- target_hit: short bright pluck -----------------------------------------
write_wav(
    "target_hit",
    mix(
        sine(900, 0.08, amp=0.4, fade_in=0.002, fade_out=0.06),
        sine(1800, 0.05, amp=0.15, fade_in=0.002, fade_out=0.04),
    ),
)

# --- glass_crack: very short sharp noise tick -------------------------------
write_wav("glass_crack", noise_burst(0.05, amp=0.5, decay=40.0))

# --- glass_shatter: longer noise decay + a few high sparkle blips -----------
_shatter_base = noise_burst(0.35, amp=0.4, decay=9.0)
_sparkles = [0.0] * len(_shatter_base)
for _ in range(6):
    start = random.uniform(0.02, 0.22)
    tone = sine(random.uniform(2200, 4200), 0.05, amp=0.12, fade_in=0.002, fade_out=0.04)
    off = int(start * SR)
    for i, v in enumerate(tone):
        if off + i < len(_sparkles):
            _sparkles[off + i] += v
write_wav("glass_shatter", mix(_shatter_base, _sparkles))

# --- combo_up: quick 3-note ascending arpeggio ------------------------------
write_wav(
    "combo_up",
    concat(
        sine(523.25, 0.06, amp=0.35, fade_out=0.03),
        sine(659.25, 0.06, amp=0.35, fade_out=0.03),
        sine(784.0, 0.09, amp=0.35, fade_out=0.05),
    ),
)

# --- combo_break: short descending "wrong" buzz -----------------------------
write_wav(
    "combo_break",
    mix(
        sweep(420, 220, 0.14, amp=0.3, fade_in=0.002, fade_out=0.08),
        noise_burst(0.08, amp=0.15, decay=25.0),
    ),
)

# --- perfect_hit: bright bell (fundamental + harmonic) ----------------------
write_wav(
    "perfect_hit",
    mix(
        sine(1046.5, 0.22, amp=0.35, fade_in=0.002, fade_out=0.18),
        sine(2093.0, 0.16, amp=0.15, fade_in=0.002, fade_out=0.14),
    ),
)

# --- obstacle_warning: two short alert pulses -------------------------------
write_wav(
    "obstacle_warning",
    concat(
        sine(220, 0.08, amp=0.35, fade_in=0.005, fade_out=0.02),
        silence(0.05),
        sine(220, 0.08, amp=0.35, fade_in=0.005, fade_out=0.02),
    ),
)

# --- obstacle_collision: low thud + noise crunch ----------------------------
write_wav(
    "obstacle_collision",
    mix(
        sine(85, 0.2, amp=0.5, fade_in=0.001, fade_out=0.16),
        noise_burst(0.12, amp=0.3, decay=20.0),
    ),
)

# --- game_over: descending resolving sweep ----------------------------------
write_wav("game_over", sweep(520, 140, 0.6, amp=0.4, fade_in=0.01, fade_out=0.25))

# --- button_click: tiny UI tick ----------------------------------------------
write_wav("button_click", sine(1100, 0.035, amp=0.3, fade_in=0.001, fade_out=0.02))

# --- level_complete: triumphant 4-note ascending arpeggio -------------------
write_wav(
    "level_complete",
    concat(
        sine(523.25, 0.1, amp=0.35, fade_out=0.05),
        sine(659.25, 0.1, amp=0.35, fade_out=0.05),
        sine(784.0, 0.1, amp=0.35, fade_out=0.05),
        sine(1046.5, 0.2, amp=0.4, fade_out=0.15),
    ),
)

# --- reward: sparkly ascending chime ----------------------------------------
write_wav(
    "reward",
    mix(
        sweep(700, 1800, 0.3, amp=0.3, fade_out=0.2),
        concat(silence(0.05), sine(2400, 0.2, amp=0.15, fade_out=0.15)),
    ),
)

print("done")
