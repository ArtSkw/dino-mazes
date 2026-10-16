"""
V3 art packaging (art/CLAUDE_HANDOFF_V3.md, art/INTRO_ASSET_HANDOFF.md).

Characters: 36 individually generated 1254x1254 frames per friend. Codex kept
one canvas per character with the waist on the bottom edge; measurements
(docs/STATUS.md, art/review/RUNTIME_QA.md) show the back contour stable within
2-3 source px, so frames are NOT re-shifted (automatic shifting was tried and
fooled by asymmetric poses). Each frame is cropped to the character's shared
union box, scaled to a tier, trimmed, and packed into Phaser multiatlases:

  corner tier (CORNER_SUBJECT px tall subject): idle, wave (encouragement),
      more (drawing, celebration, talk) - separate atlases so they can be loaded
      and released independently;
  stage tier (STAGE_SUBJECT px): idle + encouragement, only for the quest intro.

Intro: curtains, light shafts, Giganto peek, friend pop-ups (bushes registered
with Codex's translations), dust, sprout stages, title sign and vine.
"""
from __future__ import annotations

import json
import math
import os
import shutil

import numpy as np
from PIL import Image

CORNER_SUBJECT = 512
STAGE_SUBJECT = 800
# WebP quality: chosen to keep the complete offline download within PRD §9
# (≤ 12 MB) while staying visually lossless at display size.
# Alpha at 70 is indistinguishable at 2× zoom on dark green and saves ~10 %.
CORNER_QUALITY = 76
STAGE_QUALITY = 76
ALPHA_QUALITY = 70
ATLAS_MAX = 2048
PAD = 2
# Every character is a bust cut flat at the waist (the bottom edge of the
# frame). The last CUT_FADE of the frame height fades out to transparent, and
# the game sinks that band below the screen edge at rest; if a hop or a camera
# shake ever lifts the base into view, it dissolves instead of showing a line.
CUT_FADE = 0.03
# The opening's Giganto peek is cut straight on its left and bottom: those edges
# fade out over this share of the 512 cell.
PEEK_FADE = 0.06
CHAR_IDS = ["bill", "tiny", "mazu", "rocky", "giganto"]
SEQ = {
    "idle": [f"idle-{i:02d}" for i in range(0, 8)],
    "drawing": [f"drawing-{i:02d}" for i in range(8, 16)],
    "encouragement": [f"encouragement-{i:02d}" for i in range(16, 24)],
    "celebration": [f"celebration-{i:02d}" for i in range(24, 32)],
    "talk": [f"talk-{i:02d}" for i in range(32, 36)],
}
GROUPS = {
    "idle": SEQ["idle"],
    "wave": SEQ["encouragement"],
    "more": SEQ["drawing"] + SEQ["celebration"] + SEQ["talk"],
}
# The quest-intro pose is on screen for a few seconds: key poses are enough
# (breath + blink, and a wave whose tilt frames repeat), at full sharpness.
STAGE_IDLE = ["idle-00", "idle-02", "idle-04", "idle-06"]
STAGE_WAVE = ["encouragement-16", "encouragement-18", "encouragement-19", "encouragement-20", "encouragement-21", "encouragement-22"]
STAGE_FRAMES = STAGE_IDLE + STAGE_WAVE


def _premul_resize(im: Image.Image, size: tuple[int, int]) -> Image.Image:
    return im.convert("RGBa").resize(size, Image.LANCZOS).convert("RGBA")


def _save_webp(im: Image.Image, path: str, quality: int, alpha_quality: int = 100) -> int:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    arr = np.array(im.convert("RGBA"))
    arr[arr[:, :, 3] == 0, :3] = 0
    Image.fromarray(arr).save(path, "WEBP", quality=quality, alpha_quality=alpha_quality, method=6, exact=False)
    return os.path.getsize(path)


def _floor_alpha(arr: np.ndarray, floor: int = 10) -> np.ndarray:
    out = arr.copy()
    a = out[:, :, 3]
    a[a < floor] = 0
    out[a == 0, :3] = 0
    return out


def _bbox(alpha: np.ndarray, thr: int) -> tuple[int, int, int, int] | None:
    ys, xs = np.nonzero(alpha >= thr)
    if len(xs) == 0:
        return None
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def _fade_cut(im: Image.Image, fraction: float = CUT_FADE) -> Image.Image:
    """Fade the bottom `fraction` of the frame to transparent (smoothstep)."""
    arr = np.array(im.convert("RGBA")).astype(np.float32)
    h = arr.shape[0]
    band = max(2, round(h * fraction))
    # Distance from the bottom edge, in band units, at each row's centre.
    u = np.clip((h - np.arange(h) - 0.5) / band, 0.0, 1.0)
    k = u * u * (3 - 2 * u)
    arr[:, :, 3] *= k[:, None]
    out = np.clip(np.rint(arr), 0, 255).astype(np.uint8)
    out[out[:, :, 3] == 0, :3] = 0
    return Image.fromarray(out)


def _trim(im: Image.Image) -> tuple[Image.Image, tuple[int, int, int, int]]:
    """Trim to the non-transparent box (with a 1 px transparent margin kept)."""
    box = _bbox(np.array(im)[:, :, 3], 1)
    if box is None:
        return im.crop((0, 0, 1, 1)), (0, 0, 1, 1)
    x0, y0, x1, y1 = box
    x0, y0 = max(0, x0 - 1), max(0, y0 - 1)
    x1, y1 = min(im.width, x1 + 1), min(im.height, y1 + 1)
    return im.crop((x0, y0, x1, y1)), (x0, y0, x1 - x0, y1 - y0)


def pack_atlas(frames: list[tuple[str, Image.Image, tuple[int, int, int, int], tuple[int, int]]], out_dir: str, name: str, root: str, quality: int = 90) -> dict:
    """
    Shelf-pack trimmed frames into pages of at most ATLAS_MAX px and write a
    Phaser multiatlas JSON. frames: (frame name, trimmed image, sprite source
    box x,y,w,h, source size w,h). Returns {json, pages, bytes, decodedBytes}.
    """
    items = sorted(frames, key=lambda f: (-f[1].height, f[0]))
    pages: list[list[tuple]] = [[]]
    x = y = PAD
    shelf = 0
    for item in items:
        w, h = item[1].size
        if w + 2 * PAD > ATLAS_MAX or h + 2 * PAD > ATLAS_MAX:
            raise RuntimeError(f"{name}: frame {item[0]} {w}x{h} exceeds atlas size")
        if x + w + PAD > ATLAS_MAX:
            x, y, shelf = PAD, y + shelf + PAD, 0
        if y + h + PAD > ATLAS_MAX:
            pages.append([])
            x, y, shelf = PAD, PAD, 0
        pages[-1].append((item, x, y))
        x += w + PAD
        shelf = max(shelf, h)
    textures = []
    total_bytes = 0
    decoded = 0
    for i, page in enumerate(pages):
        pw = max(px + it[1].width for it, px, _ in page) + PAD
        ph = max(py + it[1].height for it, _, py in page) + PAD
        canvas = Image.new("RGBA", (pw, ph), (0, 0, 0, 0))
        out_frames = []
        for (fname, im, sss, src), px, py in page:
            canvas.paste(im, (px, py))
            out_frames.append({
                "filename": fname,
                "rotated": False,
                "trimmed": True,
                "frame": {"x": px, "y": py, "w": im.width, "h": im.height},
                "spriteSourceSize": {"x": sss[0], "y": sss[1], "w": sss[2], "h": sss[3]},
                "sourceSize": {"w": src[0], "h": src[1]},
            })
        image_name = f"{name}-{i}.webp"
        total_bytes += _save_webp(canvas, os.path.join(out_dir, image_name), quality, ALPHA_QUALITY)
        decoded += pw * ph * 4
        textures.append({"image": image_name, "format": "RGBA8888", "size": {"w": pw, "h": ph}, "scale": 1, "frames": sorted(out_frames, key=lambda f: f["filename"])})
    json_path = os.path.join(out_dir, f"{name}.json")
    with open(json_path, "w") as fh:
        json.dump({"textures": textures, "meta": {"app": "tools/art/v3.py", "version": "1"}}, fh, separators=(",", ":"))
    total_bytes += os.path.getsize(json_path)
    return {"json": os.path.relpath(json_path, root).replace(os.sep, "/"), "pages": len(pages), "bytes": total_bytes, "decodedBytes": decoded}


def _fractions(box: tuple[int, int, int, int], cw: int, ch: int) -> dict:
    x0, y0, x1, y1 = box
    return {"x": round(x0 / cw, 4), "y": round(y0 / ch, 4), "w": round((x1 - x0) / cw, 4), "h": round((y1 - y0) / ch, 4)}


def process_characters(src_root: str, public_root: str, review_root: str, report: dict) -> dict:
    out_root = os.path.join(public_root, "assets", "characters")
    if os.path.isdir(out_root):
        shutil.rmtree(out_root)  # derived output only; old 4x4 sheets and portraits go
    os.makedirs(out_root)
    manifest: dict = {}
    for cid in CHAR_IDS:
        folder = os.path.join(src_root, f"character-{cid}-v3")
        names = [n for seq in SEQ.values() for n in seq]
        frames = {n: _floor_alpha(np.array(Image.open(os.path.join(folder, f"{n}.png")).convert("RGBA"))) for n in names}
        sizes = {f.shape[:2] for f in frames.values()}
        if len(sizes) != 1:
            raise RuntimeError(f"{cid}: frames differ in size {sizes}")
        H, W = next(iter(sizes))
        master = _floor_alpha(np.array(Image.open(os.path.join(folder, "master.png")).convert("RGBA")))
        mb = _bbox(master[:, :, 3], 40)
        assert mb is not None
        subject_h = mb[3] - mb[1]
        # Shared union canvas (waist stays on the bottom edge).
        boxes = [_bbox(f[:, :, 3], 1) for f in frames.values()]
        ux0 = max(0, min(b[0] for b in boxes if b) - 6)
        ux1 = min(W, max(b[2] for b in boxes if b) + 6)
        uy0 = max(0, min(b[1] for b in boxes if b) - 6)
        uy1 = H
        cw, ch = ux1 - ux0, uy1 - uy0

        def solid_box(names_: list[str]) -> tuple[int, int, int, int]:
            bs = [_bbox(frames[n][:, :, 3], 40) for n in names_]
            return (min(b[0] for b in bs) - ux0, min(b[1] for b in bs) - uy0, max(b[2] for b in bs) - ux0, max(b[3] for b in bs) - uy0)

        content = _fractions(solid_box(["idle-00"]), cw, ch)
        content_active = _fractions(solid_box(SEQ["idle"] + SEQ["drawing"] + SEQ["encouragement"] + SEQ["talk"]), cw, ch)
        bottom = np.nonzero(master[H - 3, :, 3] >= 40)[0]
        pivot_x = round(((bottom.min() + bottom.max()) / 2 - ux0) / cw, 4)

        out_dir = os.path.join(out_root, cid)
        entry: dict = {
            "atlases": {},
            "decodedBytes": {},
            "bytes": 0,
            "pivot": {"x": pivot_x, "y": 1.0},
            "cutFade": CUT_FADE,
            "content": content,
            "contentActive": content_active,
            "sequences": SEQ,
            "stageSequences": {"idle": STAGE_IDLE, "encouragement": STAGE_WAVE[:5] + ["encouragement-20", "encouragement-21", "encouragement-22"]},
        }
        for tier, subject, groups, quality in (
            ("corner", CORNER_SUBJECT, GROUPS, CORNER_QUALITY),
            ("stage", STAGE_SUBJECT, {"stage": STAGE_FRAMES}, STAGE_QUALITY),
        ):
            k = subject / subject_h
            tw, th = round(cw * k), round(ch * k)
            if tier == "corner":
                entry["frameWidth"], entry["frameHeight"] = tw, th
            else:
                entry["stage"] = {"frameWidth": tw, "frameHeight": th}
            for group, gnames in groups.items():
                packed = []
                for n in gnames:
                    crop = Image.fromarray(frames[n][uy0:uy1, ux0:ux1])
                    scaled = _fade_cut(_premul_resize(crop, (tw, th)))
                    trimmed, sss = _trim(scaled)
                    packed.append((n, trimmed, sss, (tw, th)))
                info = pack_atlas(packed, out_dir, group, public_root, quality=quality)
                entry["atlases"][group] = info["json"]
                entry["decodedBytes"][group] = info["decodedBytes"]
                entry["bytes"] += info["bytes"]
                if tier == "corner" and group == "idle":
                    _review_character(cid, packed, review_root)
        manifest[cid] = entry
        report[f"character-{cid}-v3"] = {
            "unionBoxSource": [ux0, uy0, ux1, uy1],
            "masterSubjectHeight": subject_h,
            "cornerFrame": [entry["frameWidth"], entry["frameHeight"]],
            "stageFrame": [entry["stage"]["frameWidth"], entry["stage"]["frameHeight"]],
            "decodedBytes": entry["decodedBytes"],
            "bytes": entry["bytes"],
            "registration": "Codex canvas kept (no automatic shift); see RUNTIME_QA.md",
        }
        print(f"character {cid}: corner {entry['frameWidth']}x{entry['frameHeight']} stage {entry['stage']['frameWidth']}x{entry['stage']['frameHeight']} decoded {sum(entry['decodedBytes'].values()) / 2**20:.1f} MiB files {entry['bytes'] / 1024:.0f} KB")
    return manifest


def _review_character(cid: str, packed: list, review_root: str) -> None:
    os.makedirs(review_root, exist_ok=True)
    tw, th = packed[0][3]
    frames = []
    for _, im, sss, _ in packed:
        canvas = Image.new("RGBA", (tw, th), (0, 0, 0, 0))
        canvas.paste(im, (sss[0], sss[1]))
        frames.append(canvas)
    sheet = Image.new("RGB", (tw * len(frames), th * 2), (0, 0, 0))
    for row, bg in enumerate([(244, 236, 214), (28, 46, 34)]):
        for i, f in enumerate(frames):
            tile = Image.new("RGBA", (tw, th), bg + (255,))
            tile.alpha_composite(f)
            sheet.paste(tile.convert("RGB"), (i * tw, row * th))
    sheet.thumbnail((2400, 600))
    sheet.save(os.path.join(review_root, f"{cid}-v3-idle-contact.png"))


# ---------------------------------------------------------------------------
# Intro assets

def _cells(img: Image.Image, rects: list[list[int]]) -> list[Image.Image]:
    return [img.crop(tuple(r)) for r in rects]


def process_intro(src_root: str, public_root: str, measurements_path: str, cell_rects_path: str, report: dict) -> dict:
    out_dir = os.path.join(public_root, "assets", "intro")
    if os.path.isdir(out_dir):
        shutil.rmtree(out_dir)
    os.makedirs(out_dir)
    meas = {a["id"]: a for a in json.load(open(measurements_path))["assets"]}
    rel = lambda p: os.path.relpath(p, public_root).replace(os.sep, "/")
    src = lambda n: Image.open(os.path.join(src_root, f"{n}.png")).convert("RGBA")
    m: dict = {}

    # The leaf curtains are layered now (tools/art/entry.py, manifest key `entry`).

    im = Image.fromarray(_floor_alpha(np.array(src("intro-light-shafts")), 4))
    path = os.path.join(out_dir, "light-shafts.webp")
    m["lightShafts"] = {"image": rel(path), "width": im.width, "height": im.height, "bytes": _save_webp(im, path, 80)}

    # Giganto peek: six 512 cells, packed trimmed on the shared 512 canvas. The
    # painted cell is cut straight on its left and bottom (a little inside the
    # canvas): those edges fade out over PEEK_FADE of the canvas, measured on the
    # union of all cells so the fade never moves, and the game keeps them
    # beyond the screen edge (opening.ts, peekRest in layout.ts).
    peek_src = src("intro-giganto-peek")
    peek_cells = [_floor_alpha(np.array(c)) for c in _cells(peek_src, [c["rect"] for c in meas["intro-giganto-peek"]["cells"]])]
    union = np.max(np.stack([c[:, :, 3] for c in peek_cells]), axis=0)
    cols = np.nonzero((union >= 40).any(axis=0))[0]
    rows = np.nonzero((union >= 40).any(axis=1))[0]
    cut_left, cut_bottom = int(cols.min()), int(rows.max()) + 1
    size = peek_cells[0].shape[0]
    band = round(size * PEEK_FADE)
    packed = []
    for i, arr in enumerate(peek_cells):
        a = arr.astype(np.float32)
        h, w = a.shape[:2]
        ux = np.clip((np.arange(w) + 0.5 - cut_left) / band, 0, 1)
        uy = np.clip((cut_bottom - np.arange(h) - 0.5) / band, 0, 1)
        k = (ux * ux * (3 - 2 * ux))[None, :] * (uy * uy * (3 - 2 * uy))[:, None]
        a[:, :, 3] *= k
        out = np.clip(np.rint(a), 0, 255).astype(np.uint8)
        out[out[:, :, 3] == 0, :3] = 0
        cell = Image.fromarray(out)
        t, sss = _trim(cell)
        packed.append((f"peek-{i}", t, sss, cell.size))
    info = pack_atlas(packed, out_dir, "giganto-peek", public_root, quality=88)
    m["gigantoPeek"] = {
        "atlas": info["json"],
        "frames": [f"peek-{i}" for i in range(6)],
        "frameSize": 512,
        # The straight cut edges as fractions of the cell, and the fade band.
        "cut": {"left": round(cut_left / size, 4), "bottom": round(cut_bottom / size, 4), "band": round(band / size, 4)},
        "bytes": info["bytes"],
        "decodedBytes": info["decodedBytes"],
    }

    # Friend pop-ups: register each pose's bush to the first pose (Codex's
    # bounds-based translations), scale 0.8, one shared atlas.
    packed = []
    scale = 0.8
    for cid in ("bill", "tiny", "mazu", "rocky"):
        a = meas[f"intro-friend-popup-{cid}"]
        sheet = src(f"intro-friend-popup-{cid}")
        for i, c in enumerate(a["cells"]):
            cell = Image.fromarray(_floor_alpha(np.array(sheet.crop(tuple(c["rect"])))))
            dx, dy = c.get("suggestedTranslationToFirstBush", [0, 0])
            moved = Image.new("RGBA", cell.size, (0, 0, 0, 0))
            moved.paste(cell, (int(dx), int(dy)), cell)
            size = (round(cell.width * scale), round(cell.height * scale))
            t, sss = _trim(_premul_resize(moved, size))
            packed.append((f"{cid}-{i}", t, sss, size))
    info = pack_atlas(packed, out_dir, "popups", public_root, quality=88)
    m["popups"] = {"atlas": info["json"], "cellSize": round(627 * scale), "bytes": info["bytes"], "decodedBytes": info["decodedBytes"]}

    # Dust: three cells at half size.
    dust_src = src("intro-dust-puff")
    packed = []
    for i, c in enumerate(meas["intro-dust-puff"]["cells"]):
        cell = Image.fromarray(_floor_alpha(np.array(dust_src.crop(tuple(c["rect"]))), 4))
        size = (round(cell.width * 0.5), round(cell.height * 0.5))
        t, sss = _trim(_premul_resize(cell, size))
        packed.append((f"dust-{i}", t, sss, size))
    info = pack_atlas(packed, out_dir, "dust", public_root, quality=85)
    m["dust"] = {"atlas": info["json"], "frames": ["dust-0", "dust-1", "dust-2"], "bytes": info["bytes"], "decodedBytes": info["decodedBytes"]}

    # Sprout (DOM): four stages on one common canvas. Each stage is aligned on
    # its soil mound (centre of the brown pixels, bottom of the mound), so the
    # seedling grows in place in the loader and in the "Graj" sprout.
    rects = json.load(open(cell_rects_path))["intro-sprout"]
    sprout_src = src("intro-sprout")
    stages = []
    for r, c in zip(rects, meas["intro-sprout"]["cells"]):
        cell = Image.fromarray(_floor_alpha(np.array(sprout_src.crop(tuple(r)))))
        b = c["boundsAlpha40"]
        im = cell.crop((b[0], b[1], b[2], b[3]))
        arr = np.array(im).astype(int)
        soil = (arr[:, :, 3] > 128) & (arr[:, :, 0] > arr[:, :, 1] + 15) & (arr[:, :, 0] > 70)
        sx = float(np.nonzero(soil)[1].mean()) if soil.any() else im.width / 2
        sy = int(np.nonzero(soil.any(axis=1))[0].max()) if soil.any() else im.height - 1
        stages.append((im, sx, sy))
    left = max(sx for _, sx, _ in stages)
    right = max(im.width - sx for im, sx, _ in stages)
    up = max(sy for _, _, sy in stages)
    down = max(im.height - sy for im, _, sy in stages)
    cw, chh = int(left + right) + 8, int(up + down) + 8
    m["sprout"] = {"stages": [], "width": 0, "height": 0}
    for i, (im, sx, sy) in enumerate(stages):
        canvas = Image.new("RGBA", (cw, chh), (0, 0, 0, 0))
        canvas.paste(im, (int(round(4 + left - sx)), int(round(4 + up - sy))), im)
        canvas = _premul_resize(canvas, (round(cw * 0.6), round(chh * 0.6)))
        path = os.path.join(out_dir, f"sprout-{i}.webp")
        _save_webp(canvas, path, 88)
        m["sprout"]["stages"].append(rel(path))
        m["sprout"]["width"], m["sprout"]["height"] = canvas.width, canvas.height
    m["sprout"]["soil"] = {"x": round((4 + left) / cw, 4), "y": round((4 + up) / chh, 4)}

    # Title sign (DOM): crop, then record rope loops and the plank text area.
    sign = Image.fromarray(_floor_alpha(np.array(src("intro-title-sign"))))
    x0, y0, x1, y1 = meas["intro-title-sign"]["cells"][0]["boundsAlpha40"]
    x0, y0, x1, y1 = max(0, x0 - 6), max(0, y0 - 6), min(sign.width, x1 + 6), min(sign.height, y1 + 6)
    sign = sign.crop((x0, y0, x1, y1))
    alpha = np.array(sign)[:, :, 3]
    sw, sh = sign.size
    widths = [(alpha[y] >= 40).sum() for y in range(sh)]
    plank_top = next(y for y in range(sh) if widths[y] > sw * 0.6)
    plank_bottom = max(y for y in range(sh) if widths[y] > sw * 0.6)
    loop_band = alpha[: max(1, plank_top - 20)]
    cols = np.nonzero((loop_band >= 40).any(axis=0))[0]
    groups = np.split(cols, np.where(np.diff(cols) > 30)[0] + 1)
    loops = [{"x": round(((g.min() + g.max()) / 2) / sw, 4), "y": round(int(np.nonzero((alpha[:, g.min():g.max() + 1] >= 40).any(axis=1))[0].min()) / sh, 4)} for g in groups if len(g) > 20]
    sign = _premul_resize(sign, (round(sw * 0.5), round(sh * 0.5)))
    path = os.path.join(out_dir, "title-sign.webp")
    m["titleSign"] = {
        "image": rel(path),
        "width": sign.width,
        "height": sign.height,
        "loops": loops,
        "plank": {"top": round(plank_top / sh, 4), "bottom": round(plank_bottom / sh, 4)},
        "bytes": _save_webp(sign, path, 88),
    }

    # Vine (DOM): crop to the vine, record where its bottom loop is.
    vine = Image.fromarray(_floor_alpha(np.array(src("intro-vine"))))
    vx0, vy0, vx1, vy1 = meas["intro-vine"]["cells"][0]["boundsAlpha40"]
    vine = vine.crop((max(0, vx0 - 4), 0, min(vine.width, vx1 + 4), min(vine.height, vy1 + 4)))
    va = np.array(vine)[:, :, 3]
    tail = np.nonzero((va[-int(vine.height * 0.08):] >= 40).any(axis=0))[0]
    vine = _premul_resize(vine, (round(vine.width * 0.5), round(vine.height * 0.5)))
    path = os.path.join(out_dir, "vine.webp")
    m["vine"] = {
        "image": rel(path),
        "width": vine.width,
        "height": vine.height,
        "bottomX": round(((tail.min() + tail.max()) / 2) / (va.shape[1]), 4),
        "bytes": _save_webp(vine, path, 85),
    }
    report["intro"] = {k: {kk: vv for kk, vv in v.items() if kk in ("bytes", "decodedBytes", "width", "height")} for k, v in m.items() if isinstance(v, dict)}
    print("intro:", ", ".join(f"{k} {v.get('bytes', 0) / 1024:.0f} KB" for k, v in m.items() if isinstance(v, dict)))
    return m
