"""
Rigs (art/CLAUDE_HANDOFF_TREASURES.md, art/CLAUDE_HANDOFF_MOTION.md): the
painted parts of the treasures and the butterfly packed into one atlas, with
Codex's registration (draw order, pivots, opacity, extra poses) converted to
runtime pixels.

Every part PNG shares its master's canvas, so each is scaled by the same
factor as the asset's still image (its trimmed master at `max_side`) and then
trimmed into the atlas. Phaser restores the full canvas from the trim data,
so at runtime a part only needs its origin at the pivot and its position at
the pivot relative to the rig origin (the centre of the still). Extra poses
(the perched butterfly) are whole images on the same canvas.

The chest is not a Phaser rig: it lives on the collection button (DOM), so
`export_chest` writes its closed layers and open pose as three aligned images.
"""
from __future__ import annotations

import json
import os

import numpy as np
from PIL import Image

import v3

REGISTRATIONS = [
    os.path.join("art", "review", "treasures", "registration.json"),
    os.path.join("art", "review", "motion", "registration.json"),
]


def _box(rgba: np.ndarray, floor: int) -> tuple[int, int, int, int]:
    """The box the still export trims to (alpha >= floor), as x0, y0, x1, y1."""
    ys, xs = np.nonzero(rgba[:, :, 3] >= floor)
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def _registrations(root: str) -> dict:
    out: dict = {}
    for rel in REGISTRATIONS:
        path = os.path.join(root, rel)
        if os.path.exists(path):
            out.update(json.load(open(path))["assets"])
    return out


def process_rigs(root: str, src_root: str, wanted: dict[str, int], clean_alpha, alpha_floor: int, report: dict) -> dict:
    """
    Pack every wanted asset's parts (and extra poses) into one atlas. `wanted`
    maps an asset to the max side of its still image, the scale its parts are
    packed at (treasures 320, plants 384, small critters less).

    - Assets with parts: frames `<asset>/<part>`, pivots, opacity, `restVisible`.
    - Pose-only assets (the pointer, the frog): `<asset>/master` plus each pose,
      and their landmarks (fingertip, body centre) in canvas pixels.
    - Confetti: each piece is its own particle; its pivot is its own centre.
    """
    registration = _registrations(root)
    out_dir = os.path.join(root, "public", "assets", "rigs")
    frames = []
    rigs: dict = {}
    for asset, max_side in wanted.items():
        reg = registration.get(asset)
        if not reg:
            continue
        folder = os.path.join(src_root, "motion", asset)
        master = clean_alpha(np.array(Image.open(os.path.join(folder, "master.png")).convert("RGBA")))
        cw, ch = reg["canvas"]
        if master.shape[1] != cw or master.shape[0] != ch:
            raise RuntimeError(f"{asset}: master {master.shape[1]}x{master.shape[0]} != registration canvas {cw}x{ch}")
        x0, y0, x1, y1 = _box(master, alpha_floor)
        k = min(1.0, max_side / max(x1 - x0, y1 - y0))
        sw, sh = round(cw * k), round(ch * k)
        scale = lambda pt: [round(pt[0] * k, 2), round(pt[1] * k, 2)]  # noqa: E731

        def pack(name: str) -> str:
            im = Image.open(os.path.join(folder, f"{name}.png")).convert("RGBA")
            if im.size != (cw, ch):
                raise RuntimeError(f"{asset}/{name}: {im.size} is not the master canvas {cw}x{ch}")
            trimmed, sss = v3._trim(v3._premul_resize(im, (sw, sh)))
            frame = f"{asset}/{name}"
            frames.append((frame, trimmed, sss, (sw, sh)))
            return frame

        parts = []
        for p in reg["parts"]:
            part = {"name": p["name"], "frame": pack(p["name"]), "pivot": scale(p["pivot"]), "opacity": p.get("opacity", 1)}
            if p.get("restVisible") is False:
                part["restVisible"] = False
            parts.append(part)
        poses = {name: pack(name) for name in reg.get("poses", {}) if asset != "chest"}
        rig: dict = {
            "canvas": [sw, sh],
            # Centre of the still image inside the scaled canvas: the rig's origin.
            "origin": [round((x0 + x1) / 2 * k, 2), round((y0 + y1) / 2 * k, 2)],
            "size": [round((x1 - x0) * k, 2), round((y1 - y0) * k, 2)],
            "parts": parts,
        }
        if poses:
            rig["poses"] = poses
        if not parts and poses:
            rig["master"] = pack("master")
        landmarks = dict(reg.get("masterLandmarks") or {})
        if landmarks:
            rig["landmarks"] = {name: scale(pt) for name, pt in landmarks.items()}
        rigs[asset] = rig
    if not frames:
        return {}
    info = v3.pack_atlas(frames, out_dir, "rig-parts", os.path.join(root, "public"), quality=86)
    report["rigs"] = {"assets": sorted(rigs), "frames": len(frames), "pages": info["pages"], "bytes": info["bytes"], "decodedBytes": info["decodedBytes"]}
    print(f"rigs: {len(rigs)} assets, {len(frames)} frames, {info['pages']} page(s), {info['bytes'] / 1024:.0f} KB, decoded {info['decodedBytes'] / 2**20:.1f} MiB")
    return {"atlas": info["json"], "decodedBytes": info["decodedBytes"], "assets": rigs}


def export_chest(root: str, src_root: str, clean_alpha, alpha_floor: int, save_webp, report: dict, max_side: int = 192) -> dict:
    """The chest on the collection button: base, lid and the open pose, cropped alike."""
    reg = _registrations(root).get("chest")
    folder = os.path.join(src_root, "motion", "chest")
    if not reg or not os.path.exists(os.path.join(folder, "open.png")):
        return {}
    layers = {n: clean_alpha(np.array(Image.open(os.path.join(folder, f"{n}.png")).convert("RGBA"))) for n in ("base", "lid", "open")}
    boxes = [_box(a, alpha_floor) for a in layers.values()]
    x0, y0 = min(b[0] for b in boxes) - 4, min(b[1] for b in boxes) - 4
    x1, y1 = max(b[2] for b in boxes) + 4, max(b[3] for b in boxes) + 4
    w, h = x1 - x0, y1 - y0
    k = min(1.0, max_side / max(w, h))
    size = (round(w * k), round(h * k))
    out: dict = {"width": size[0], "height": size[1]}
    for name, arr in layers.items():
        img = v3._premul_resize(Image.fromarray(np.ascontiguousarray(arr[y0:y1, x0:x1])), size)
        rel = f"assets/ui/chest-{name}.webp"
        save_webp(img, os.path.join(root, "public", rel), quality=90)
        out[name] = rel
    lid = next(p for p in reg["parts"] if p["name"] == "lid")
    out["lidPivot"] = [round((lid["pivot"][0] - x0) / w, 4), round((lid["pivot"][1] - y0) / h, 4)]
    report["chest"] = out
    return out
