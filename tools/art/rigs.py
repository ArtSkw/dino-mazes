"""
Treasure rigs (art/CLAUDE_HANDOFF_TREASURES.md): the painted parts of a
treasure packed into one atlas, with Codex's registration (draw order,
pivots, opacity) converted to runtime pixels.

Every part PNG shares its master's canvas, so each is scaled by the same
factor as the treasure's still image (its trimmed master at `max_side`) and
then trimmed into the atlas. Phaser restores the full canvas from the trim
data, so at runtime a part only needs its origin at the pivot and its
position at the pivot relative to the rig origin (the centre of the still).
"""
from __future__ import annotations

import json
import os

import numpy as np
from PIL import Image

import v3

REGISTRATION = os.path.join("art", "review", "treasures", "registration.json")


def _still_box(rgba: np.ndarray, floor: int) -> tuple[int, int, int, int]:
    """The box the still export trims to (alpha >= floor), as x0, y0, x1, y1."""
    ys, xs = np.nonzero(rgba[:, :, 3] >= floor)
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def process_treasure_rigs(root: str, src_root: str, ready: list[str], max_side: int, clean_alpha, alpha_floor: int, report: dict) -> dict:
    reg_path = os.path.join(root, REGISTRATION)
    if not os.path.exists(reg_path):
        return {}
    registration = json.load(open(reg_path))["assets"]
    out_dir = os.path.join(root, "public", "assets", "treasures", "rigs")
    frames = []
    rigs: dict = {}
    for asset, reg in registration.items():
        if asset not in ready:
            continue
        folder = os.path.join(src_root, "motion", asset)
        master = clean_alpha(np.array(Image.open(os.path.join(folder, "master.png")).convert("RGBA")))
        cw, ch = reg["canvas"]
        if master.shape[1] != cw or master.shape[0] != ch:
            raise RuntimeError(f"{asset}: master {master.shape[1]}x{master.shape[0]} != registration canvas {cw}x{ch}")
        x0, y0, x1, y1 = _still_box(master, alpha_floor)
        k = min(1.0, max_side / max(x1 - x0, y1 - y0))
        sw, sh = round(cw * k), round(ch * k)
        parts = []
        for p in reg["parts"]:
            im = Image.open(os.path.join(folder, f"{p['name']}.png")).convert("RGBA")
            if im.size != (cw, ch):
                raise RuntimeError(f"{asset}/{p['name']}: {im.size} is not the master canvas {cw}x{ch}")
            scaled = v3._premul_resize(im, (sw, sh))
            trimmed, sss = v3._trim(scaled)
            name = f"{asset}/{p['name']}"
            frames.append((name, trimmed, sss, (sw, sh)))
            parts.append({
                "name": p["name"],
                "frame": name,
                "pivot": [round(p["pivot"][0] * k, 2), round(p["pivot"][1] * k, 2)],
                "opacity": p.get("opacity", 1),
            })
        rigs[asset] = {
            "canvas": [sw, sh],
            # Centre of the still image inside the scaled canvas: the rig's origin.
            "origin": [round((x0 + x1) / 2 * k, 2), round((y0 + y1) / 2 * k, 2)],
            "size": [round((x1 - x0) * k, 2), round((y1 - y0) * k, 2)],
            "parts": parts,
        }
    if not frames:
        return {}
    info = v3.pack_atlas(frames, out_dir, "treasure-parts", os.path.join(root, "public"), quality=86)
    for rig in rigs.values():
        rig["atlas"] = info["json"]
    report["treasure-rigs"] = {"assets": sorted(rigs), "parts": len(frames), "pages": info["pages"], "bytes": info["bytes"], "decodedBytes": info["decodedBytes"]}
    print(f"treasure rigs: {len(rigs)} assets, {len(frames)} parts, {info['pages']} page(s), {info['bytes'] / 1024:.0f} KB, decoded {info['decodedBytes'] / 2**20:.1f} MiB")
    return {"atlas": info["json"], "decodedBytes": info["decodedBytes"], "rigs": rigs}
