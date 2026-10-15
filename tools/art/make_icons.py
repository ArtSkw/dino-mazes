"""
App icons and favicons (owner request, 15 October 2026): Giganto peeking in
from the jungle, the same painted cell as in the opening, instead of the first
version's Bill.

Giganto's cell is cut straight on its left and bottom; the round window clips
him so both cuts stay outside it. Everything is drawn at 1024 px and scaled
down, so the result is deterministic:

  giganto-<n>.png           rounded green tile with transparent corners
                            (the manifest's "any" icons);
  giganto-180.png           full square for iOS, which rounds it itself;
  giganto-maskable-512.png  full square, the window inside the 80 % safe zone.

The favicon sizes (16, 32, 48) are the round window alone, closer on his face
and with a thicker ring, so his eye, teeth and red spikes still read in a
browser tab (a green head on a green tile turned into a blob there).

  python3 tools/art/make_icons.py
"""
from __future__ import annotations

import json
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SRC = os.path.join(ROOT, "art", "source", "intro-giganto-peek.png")
MEASUREMENTS = os.path.join(ROOT, "art", "review", "intro", "measurements.json")
OUT = os.path.join(ROOT, "public", "icons")
S = 1024
# The peek cell where he looks out with a grin (opening.ts beats).
CELL = 4
LEAF_TOP = (134, 196, 74)
LEAF_BOTTOM = (61, 120, 28)
RING = (52, 104, 22)
SAND_IN = (253, 244, 218)
SAND_OUT = (236, 214, 160)


def _gradient(top: tuple[int, int, int], bottom: tuple[int, int, int]) -> Image.Image:
    t = np.linspace(0, 1, S)[:, None, None]
    arr = (np.array(top) * (1 - t) + np.array(bottom) * t) * np.ones((1, S, 1))
    return Image.fromarray(arr.astype(np.uint8)).convert("RGBA")


def _radial(inner: tuple[int, int, int], outer: tuple[int, int, int], cx: float, cy: float, r: float) -> Image.Image:
    y, x = np.mgrid[0:S, 0:S]
    t = np.clip(np.hypot(x - cx, y - cy) / r, 0, 1)[..., None]
    arr = np.array(inner) * (1 - t) + np.array(outer) * t
    return Image.fromarray(arr.astype(np.uint8)).convert("RGBA")


def _disc_mask(cx: float, cy: float, r: float) -> Image.Image:
    m = Image.new("L", (S, S), 0)
    ImageDraw.Draw(m).ellipse((cx - r, cy - r, cx + r, cy + r), fill=255)
    return m


def _giganto() -> tuple[Image.Image, tuple[int, int, int, int]]:
    """The peek cell and its content box (alpha >= 40)."""
    rect = [a for a in json.load(open(MEASUREMENTS))["assets"] if a["id"] == "intro-giganto-peek"][0]["cells"][CELL]["rect"]
    arr = np.array(Image.open(SRC).convert("RGBA").crop(tuple(rect)))
    arr[arr[:, :, 3] < 10] = 0
    ys, xs = np.nonzero(arr[:, :, 3] >= 40)
    return Image.fromarray(arr), (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)


def _window(r: float, zoom: float, focus: tuple[float, float], ring: float = 0.055) -> Image.Image:
    """A sand-coloured round window with Giganto, ringed in dark green.

    `zoom` is the cell's size against the window's diameter; `focus` is the
    point of the cell (fractions) placed at the window's centre. His left and
    bottom cuts are kept outside the window whatever the zoom.
    """
    cx = cy = S / 2
    win = _radial(SAND_IN, SAND_OUT, cx + r * 0.25, cy - r * 0.35, r * 1.6)
    cell, (x0, _, _, y1) = _giganto()
    k = 2 * r * zoom / cell.width
    big = cell.convert("RGBa").resize((round(cell.width * k), round(cell.height * k)), Image.LANCZOS).convert("RGBA")
    ox = cx - focus[0] * big.width
    oy = cy - focus[1] * big.height
    # The cuts: the left edge at or left of the window, the bottom at or below it.
    ox = min(ox, cx - r - x0 * k - 2)
    oy = max(oy, cy + r - y1 * k + 2)
    # A soft shadow under him, so he sits in the window, not on it.
    shadow = Image.new("RGBA", big.size, (40, 60, 20, 0))
    shadow.putalpha(big.getchannel("A").point(lambda a: a * 0.35))
    win.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(r * 0.03)), (round(ox + r * 0.02), round(oy + r * 0.03)))
    win.alpha_composite(big, (round(ox), round(oy)))
    out = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    out.paste(win, (0, 0), _disc_mask(cx, cy, r))
    edge = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(edge).ellipse((cx - r, cy - r, cx + r, cy + r), outline=RING + (255,), width=round(r * ring))
    out.alpha_composite(edge)
    return out


def _tile(window: Image.Image, rounded: bool) -> Image.Image:
    bg = _gradient(LEAF_TOP, LEAF_BOTTOM)
    # A light from the top, as in the game's clearing.
    glow = _radial((255, 255, 255), (0, 0, 0), S / 2, 0, S * 0.9).getchannel("R").point(lambda v: v * 0.18)
    bg = Image.composite(Image.new("RGBA", (S, S), (255, 250, 220, 255)), bg, glow)
    bg.alpha_composite(window)
    if not rounded:
        return bg
    mask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, S - 1, S - 1), radius=round(S * 0.2), fill=255)
    out = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    out.paste(bg, (0, 0), mask)
    return out


def _save(im: Image.Image, size: int, name: str, opaque: bool = False) -> None:
    small = im.convert("RGBa").resize((size, size), Image.LANCZOS).convert("RGBA")
    if opaque:
        small = small.convert("RGB")
    small.save(os.path.join(OUT, name), "PNG", optimize=True)


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    # Whole head with the jungle under it: app icons.
    head = _window(S * 0.42, 1.0, (0.47, 0.52))
    # Closer on the face (eye, grin, red spikes), no tile: browser tabs.
    face = _window(S * 0.49, 1.5, (0.40, 0.34), ring=0.09)
    for size in (16, 32, 48):
        _save(face, size, f"giganto-{size}.png")
    for size in (192, 512):
        _save(_tile(head, True), size, f"giganto-{size}.png")
    _save(_tile(head, False), 180, "giganto-180.png", opaque=True)
    # Maskable: the window must fit the safe zone (a circle of 40 % radius).
    _save(_tile(_window(S * 0.36, 1.0, (0.47, 0.52)), False), 512, "giganto-maskable-512.png", opaque=True)


if __name__ == "__main__":
    main()
