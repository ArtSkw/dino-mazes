"""
The entry's layered leaf curtains (art/CLAUDE_HANDOFF_ENTRY.md, Codex 16 Oct 2026).

Each curtain is four layers on one shared 1024 x 1536 canvas, drawn back -> mid
-> front-top -> front-bottom at the same scale and place. Every layer is trimmed
to its painted area (alpha >= 10) and keeps its offset on that canvas, so the
game stacks them exactly. The soft back layers compress harder than the sharp
front leaves. The opaque backing (a glowing clearing seen between the curtains)
and the six single leaves of the start-button burst are exported beside them.
"""
from __future__ import annotations

import json
import os
import shutil

import numpy as np
from PIL import Image

LAYERS = ["back", "mid", "front-top", "front-bottom"]
# WebP quality per layer: the far layers are soft, the front leaves carry the detail.
QUALITY = {"back": 70, "mid": 78, "front-top": 86, "front-bottom": 86}
# The far layer is soft: stored at 75 % size and drawn at full size (x, y, w, h stay canvas units).
SCALE = {"back": 0.75}
LEAF_MAX = 192


def _save(im: Image.Image, path: str, quality: int, alpha: bool = True) -> int:
    if alpha:
        arr = np.array(im.convert("RGBA"))
        arr[arr[:, :, 3] < 10] = 0
        im = Image.fromarray(arr)
        im.save(path, "WEBP", quality=quality, alpha_quality=80, method=6, exact=False)
    else:
        im.convert("RGB").save(path, "WEBP", quality=quality, method=6)
    return os.path.getsize(path)


def process_entry(src_root: str, public_root: str, registration_path: str, report: dict) -> dict:
    out_dir = os.path.join(public_root, "assets", "entry")
    if os.path.isdir(out_dir):
        shutil.rmtree(out_dir)
    os.makedirs(out_dir)
    reg = json.load(open(registration_path))
    rel = lambda p: os.path.relpath(p, public_root).replace(os.sep, "/")
    src = lambda name: Image.open(os.path.join(src_root, "entry", f"{name}.png"))
    m: dict = {"canvas": reg["left"]["canvas"], "overscan": reg["left"].get("suggestedOverscanPx", 48), "bytes": 0}

    for side in ("left", "right"):
        layers = []
        for layer in LAYERS:
            im = src(f"curtain-{side}-{layer}").convert("RGBA")
            a = np.array(im)[:, :, 3]
            ys, xs = np.nonzero(a >= 10)
            box = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
            path = os.path.join(out_dir, f"curtain-{side}-{layer}.webp")
            part = im.crop(box)
            k = SCALE.get(layer, 1)
            if k != 1:
                part = part.convert("RGBa").resize((round(part.width * k), round(part.height * k)), Image.LANCZOS).convert("RGBA")
            size = _save(part, path, QUALITY[layer])
            m["bytes"] += size
            layers.append({"name": layer, "image": rel(path), "x": box[0], "y": box[1], "w": box[2] - box[0], "h": box[3] - box[1], "bytes": size})
        m[side] = layers

    backing = src("backing")
    path = os.path.join(out_dir, "backing.webp")
    # Soft gradients: lower qualities show blocks on the light shafts.
    size = _save(backing, path, 88, alpha=False)
    m["bytes"] += size
    m["backing"] = {"image": rel(path), "width": backing.width, "height": backing.height, "bytes": size}

    sheet = src("leaves").convert("RGBA")
    leaves = []
    cells = [c["rect"] for c in reg["assets"]["leaves"].get("cells", [])] or _cells(sheet)
    for i, rect in enumerate(cells):
        cell = sheet.crop(tuple(rect))
        a = np.array(cell)[:, :, 3]
        ys, xs = np.nonzero(a >= 10)
        cell = cell.crop((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))
        k = LEAF_MAX / max(cell.size)
        if k < 1:
            cell = cell.convert("RGBa").resize((round(cell.width * k), round(cell.height * k)), Image.LANCZOS).convert("RGBA")
        path = os.path.join(out_dir, f"leaf-{i}.webp")
        size = _save(cell, path, 85)
        m["bytes"] += size
        leaves.append({"image": rel(path), "width": cell.width, "height": cell.height})
    m["leaves"] = leaves
    report["entry"] = {"bytes": m["bytes"], "layers": {s: [l["bytes"] for l in m[s]] for s in ("left", "right")}}
    return m


def _cells(sheet: Image.Image) -> list[list[int]]:
    """3 x 2 grid of 512 cells (Codex's registered layout)."""
    w, h = sheet.width // 3, sheet.height // 2
    return [[c * w, r * h, (c + 1) * w, (r + 1) * h] for r in range(2) for c in range(3)]
