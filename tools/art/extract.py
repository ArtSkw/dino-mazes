#!/usr/bin/env python3
"""
Dino Mazes art packager (DEVELOPMENT_PLAN.md §5.4–5.5).

Reads immutable sources from art/source/ and writes optimized runtime
derivatives to public/assets/ plus QA aids to art/review/runtime/.

* Character sheets: frames are cut at *measured* transparent gutters (the
  nominal 313.5 px grid is fractional and unreliable), cleaned of stray
  near-transparent specks, registered to frame 0 by cross-correlating the
  torso band, and placed on one common untrimmed canvas so playback never
  wobbles. Output is a uniform 4x4 spritesheet with transparent gutters.
* Treasure, foliage and UI kits: isolated by alpha connected components.
* Backgrounds: converted to WebP at source resolution (never upscaled).

Sources are never modified. Run: npm run art
"""
from __future__ import annotations

import hashlib
import json
import os
import sys
from dataclasses import dataclass

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, "art", "source")
OUT = os.path.join(ROOT, "public", "assets")
REVIEW = os.path.join(ROOT, "art", "review", "runtime")

ALPHA_FLOOR = 10      # alpha below this is invisible generation residue -> 0
SOLID = 40            # alpha considered "subject" for measuring
MIN_ISLAND = 220      # px; smaller detached islands are specks

CHARACTERS = {
    "bill": "character-bill-v2.png",
    "tiny": "character-tiny-v1.png",
    "mazu": "character-mazu-v1.png",
    "rocky": "character-rocky-v1.png",
    "giganto": "character-giganto-v2.png",
}
SEQUENCES = {"idle": [0, 1, 2, 3], "drawing": [4, 5, 6, 7], "encouragement": [8, 9, 10, 11], "celebration": [12, 13, 14, 15]}


def sha256(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def ensure(path: str) -> None:
    os.makedirs(path, exist_ok=True)


def label_components(mask: np.ndarray) -> tuple[np.ndarray, int]:
    """4-connected component labelling without scipy (iterative flood fill)."""
    h, w = mask.shape
    labels = np.zeros((h, w), dtype=np.int32)
    current = 0
    ys, xs = np.nonzero(mask)
    for y0, x0 in zip(ys, xs):
        if labels[y0, x0]:
            continue
        current += 1
        stack = [(y0, x0)]
        labels[y0, x0] = current
        while stack:
            y, x = stack.pop()
            for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not labels[ny, nx]:
                    labels[ny, nx] = current
                    stack.append((ny, nx))
    return labels, current


def clean_alpha(rgba: np.ndarray, min_island: int = MIN_ISLAND) -> np.ndarray:
    """Zero invisible residue and drop small detached specks; returns a copy."""
    out = rgba.copy()
    a = out[:, :, 3]
    a[a < ALPHA_FLOOR] = 0
    # Work on a downsampled mask for speed, then map back.
    mask = a >= SOLID
    small = mask[::2, ::2]
    labels, n = label_components(small)
    if n > 1:
        sizes = np.bincount(labels.ravel())
        keep = np.zeros_like(sizes, dtype=bool)
        keep[1:] = sizes[1:] * 4 >= min_island
        keep_small = keep[labels]
        keep_full = np.repeat(np.repeat(keep_small, 2, axis=0), 2, axis=1)[: a.shape[0], : a.shape[1]]
        # Pixels near kept regions survive (soft edges); isolated specks vanish.
        from PIL import ImageFilter
        grown = Image.fromarray((keep_full * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(9))
        a[np.array(grown) == 0] = 0
    out[:, :, 3] = a
    out[a == 0, :3] = 0
    return out


def runs_of_empty(v: np.ndarray) -> list[tuple[int, int]]:
    out, start = [], None
    for i, x in enumerate(v):
        if x == 0 and start is None:
            start = i
        if x != 0 and start is not None:
            out.append((start, i - 1))
            start = None
    if start is not None:
        out.append((start, len(v) - 1))
    return out


def gutter_cuts(profile: np.ndarray, count: int) -> list[int]:
    """Return count+1 cut positions using the widest interior empty runs."""
    n = len(profile)
    runs = runs_of_empty(profile)
    interior = [r for r in runs if r[0] > 0 and r[1] < n - 1]
    interior.sort(key=lambda r: r[1] - r[0], reverse=True)
    chosen = sorted(interior[: count - 1])
    if len(chosen) != count - 1:
        raise RuntimeError(f"expected {count - 1} gutters, found {len(chosen)}")
    return [0] + [(r[0] + r[1]) // 2 for r in chosen] + [n]


def premul_resize(im: Image.Image, size: tuple[int, int]) -> Image.Image:
    return im.convert("RGBa").resize(size, Image.LANCZOS).convert("RGBA")


def save_webp(im: Image.Image, path: str, quality: int = 88, lossless: bool = False) -> int:
    ensure(os.path.dirname(path))
    if im.mode == "RGBA":
        arr = np.array(im)
        arr[arr[:, :, 3] == 0, :3] = 0
        im = Image.fromarray(arr)
    im.save(path, "WEBP", quality=quality, method=6, lossless=lossless, exact=False)
    return os.path.getsize(path)


@dataclass
class Frame:
    image: np.ndarray  # cleaned RGBA crop of the cell
    bbox: tuple[int, int, int, int]  # x0, y0, x1, y1 within the cell (solid alpha)
    cell_origin: tuple[int, int]


def torso_profile(a: np.ndarray, bbox: tuple[int, int, int, int], band: float = 0.32) -> tuple[np.ndarray, int]:
    x0, y0, x1, y1 = bbox
    h = y1 - y0
    top = int(y1 - h * band)
    prof = (a[top:y1, :] >= SOLID).sum(axis=0).astype(float)
    return prof, y1


def best_shift(ref: np.ndarray, cur: np.ndarray, max_shift: int = 140) -> int:
    """Integer x shift s maximizing correlation of cur(x - s) with ref(x)."""
    n = max(len(ref), len(cur))
    r = np.zeros(n + 2 * max_shift)
    c = np.zeros(n + 2 * max_shift)
    r[max_shift : max_shift + len(ref)] = ref
    c[max_shift : max_shift + len(cur)] = cur
    best, best_s = -1.0, 0
    for s in range(-max_shift, max_shift + 1):
        score = float(np.dot(r, np.roll(c, s)))
        if score > best:
            best, best_s = score, s
    return best_s


def process_character(cid: str, filename: str, report: dict) -> dict:
    path = os.path.join(SRC, filename)
    im = Image.open(path).convert("RGBA")
    raw = np.array(im)
    a = raw[:, :, 3]
    mask = a >= SOLID
    xcuts = gutter_cuts(mask.sum(axis=0), 4)
    ycuts = gutter_cuts(mask.sum(axis=1), 4)

    frames: list[Frame] = []
    edge_touch = []
    for row in range(4):
        for col in range(4):
            x0, x1 = xcuts[col], xcuts[col + 1]
            y0, y1 = ycuts[row], ycuts[row + 1]
            cell = clean_alpha(raw[y0:y1, x0:x1])
            ca = cell[:, :, 3]
            ys, xs = np.nonzero(ca >= SOLID)
            bb = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
            # Does the subject touch the sheet edge (possible clipping)?
            if (x0 == 0 and bb[0] == 0) or (x1 == im.width and bb[2] >= x1 - x0) or (y0 == 0 and bb[1] == 0) or (y1 == im.height and bb[3] >= y1 - y0):
                edge_touch.append(row * 4 + col)
            frames.append(Frame(cell, bb, (x0, y0)))

    # Registration: align every frame's torso band to frame 0 horizontally, and
    # bottoms vertically (the busts are cut by a horizontal line at the bottom).
    ref_prof, _ = torso_profile(frames[0].image[:, :, 3], frames[0].bbox)
    anchors = []
    for i, f in enumerate(frames):
        prof, bottom = torso_profile(f.image[:, :, 3], f.bbox)
        # Pad profiles to a common length.
        L = max(len(prof), len(ref_prof))
        p = np.zeros(L); p[: len(prof)] = prof
        r = np.zeros(L); r[: len(ref_prof)] = ref_prof
        shift = best_shift(r, p)
        anchors.append((shift, bottom))

    # Common canvas: place each frame so its (aligned) bottom sits on a shared baseline.
    placed = []
    for f, (shift, bottom) in zip(frames, anchors):
        x0, y0, x1, y1 = f.bbox
        # Position of the bbox in a shared coordinate system (frame-0 cell space).
        gx0 = x0 + shift
        gy0 = y0 + (frames[0].bbox[3] - bottom)
        placed.append((gx0, gy0, gx0 + (x1 - x0), gy0 + (y1 - y0)))
    pad = 6
    minx = min(p[0] for p in placed) - pad
    miny = min(p[1] for p in placed) - pad
    maxx = max(p[2] for p in placed) + pad
    maxy = max(p[3] for p in placed)  # bottom is the cut line, no padding below
    W, H = int(maxx - minx), int(maxy - miny)

    gutter = 4
    sheet = Image.new("RGBA", (4 * W + 3 * gutter, 4 * H + 3 * gutter), (0, 0, 0, 0))
    frame_imgs = []
    for i, (f, (gx0, gy0, gx1, gy1)) in enumerate(zip(frames, placed)):
        x0, y0, x1, y1 = f.bbox
        crop = Image.fromarray(np.ascontiguousarray(f.image[y0:y1, x0:x1]))
        canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        canvas.paste(crop, (int(gx0 - minx), int(gy0 - miny)), crop)
        frame_imgs.append(canvas)
        sheet.paste(canvas, ((i % 4) * (W + gutter), (i // 4) * (H + gutter)))

    out_path = os.path.join(OUT, "characters", f"{cid}.webp")
    nbytes = save_webp(sheet, out_path, quality=90)

    # Visible content boxes (alpha >= SOLID) as fractions of the frame, so the
    # game can place UI next to the painted character instead of its padded
    # frame: frame 0 (rest pose) and the union of the frames used outside the
    # celebration (idle, drawing, encouragement: 0-11), where controls sit.
    def content_box(idx: list[int]) -> dict:
        boxes = []
        for i in idx:
            a = np.array(frame_imgs[i])[:, :, 3]
            ys, xs = np.nonzero(a >= SOLID)
            boxes.append((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
        x0 = min(b[0] for b in boxes); y0 = min(b[1] for b in boxes)
        x1 = max(b[2] for b in boxes); y1 = max(b[3] for b in boxes)
        return {"x": round(x0 / W, 4), "y": round(y0 / H, 4), "w": round((x1 - x0) / W, 4), "h": round((y1 - y0) / H, 4)}

    content_rest = content_box([0])
    content_active = content_box(list(range(12)))

    # Measured anchor: bottom-centre of frame-0 torso in the common canvas.
    f0 = placed[0]
    anchor_x = ((f0[0] + f0[2]) / 2 - minx) / W
    meta = {
        "id": cid,
        "source": f"art/source/{filename}",
        "sourceSha256": sha256(path),
        "image": f"assets/characters/{cid}.webp",
        "frameWidth": W,
        "frameHeight": H,
        "spacing": gutter,
        "columns": 4,
        "frames": 16,
        "pivot": {"x": round(anchor_x, 4), "y": 1.0},
        "content": content_rest,
        "contentActive": content_active,
        "sequences": SEQUENCES,
        "measuredCells": {"x": xcuts, "y": ycuts},
        "registrationShiftsX": [s for s, _ in anchors],
        "bottoms": [b for _, b in anchors],
        "edgeTouchingFrames": edge_touch,
        "bytes": nbytes,
        "decodedBytes": sheet.width * sheet.height * 4,
    }
    with open(os.path.join(OUT, "characters", f"{cid}.json"), "w") as fh:
        json.dump(meta, fh, indent=1)

    # Portrait thumbnail for DOM UI (quest chip): the head region of frame 0,
    # measured from alpha so long snouts (Giganto) and crests (Rocky) fit.
    f0img = frame_imgs[0]
    fa = np.array(f0img)[:, :, 3]
    ys, xs = np.nonzero(fa >= SOLID)
    top, bottom = int(ys.min()), int(ys.max())
    head_bottom = top + int((bottom - top) * 0.62)
    hx = np.nonzero((fa[top:head_bottom] >= SOLID).any(axis=0))[0]
    x0, x1 = int(hx.min()), int(hx.max())
    side = int(max(x1 - x0, head_bottom - top) * 1.06)
    cx = (x0 + x1) // 2
    box = (cx - side // 2, top - int(side * 0.03), cx - side // 2 + side, top - int(side * 0.03) + side)
    portrait = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    portrait.paste(f0img.crop(box), (0, 0))
    portrait = premul_resize(portrait, (192, 192))
    save_webp(portrait, os.path.join(OUT, "characters", f"{cid}-portrait.webp"), quality=90)

    # Review aids: contact sheet on light+dark with a fixed registration guide, and loop GIFs.
    ensure(REVIEW)
    cs_w = 4 * W
    contact = Image.new("RGBA", (cs_w * 2 + 20, 4 * H), (0, 0, 0, 255))
    for bg_i, bg in enumerate([(244, 236, 214, 255), (32, 52, 38, 255)]):
        panel = Image.new("RGBA", (cs_w, 4 * H), bg)
        d = ImageDraw.Draw(panel)
        for i, fi in enumerate(frame_imgs):
            ox, oy = (i % 4) * W, (i // 4) * H
            panel.alpha_composite(fi, (ox, oy))
            gx = ox + int(anchor_x * W)
            d.line([(gx, oy), (gx, oy + H)], fill=(255, 0, 120, 160), width=1)
            d.line([(ox, oy + H - 1), (ox + W, oy + H - 1)], fill=(255, 0, 120, 160), width=1)
        contact.paste(panel, (bg_i * (cs_w + 20), 0))
    contact.convert("RGB").save(os.path.join(REVIEW, f"{cid}-contact.png"))
    for seq, idx in SEQUENCES.items():
        gif_frames = []
        for j in idx + [idx[0]]:
            bgim = Image.new("RGBA", (W, H), (244, 236, 214, 255))
            bgim.alpha_composite(frame_imgs[j])
            gif_frames.append(bgim.convert("P", palette=Image.ADAPTIVE))
        gif_frames[0].save(os.path.join(REVIEW, f"{cid}-{seq}.gif"), save_all=True, append_images=gif_frames[1:], duration=200, loop=0)

    report[cid] = {
        "frameSize": [W, H],
        "shiftsX": meta["registrationShiftsX"],
        "bottoms": meta["bottoms"],
        "edgeTouching": edge_touch,
        "bytes": nbytes,
    }
    return meta


def components_of(path: str, expected: int, min_area: int = 4000, alpha_solid: int = SOLID) -> tuple[np.ndarray, list[tuple[int, int, int, int]]]:
    im = Image.open(path).convert("RGBA")
    raw = clean_alpha(np.array(im), min_island=min_area)
    a = raw[:, :, 3]
    mask = a >= alpha_solid
    small = mask[::4, ::4]
    labels, n = label_components(small)
    sizes = np.bincount(labels.ravel())
    order = [i for i in np.argsort(-sizes) if i != 0][:expected]
    boxes = []
    for lab in order:
        ys, xs = np.nonzero(labels == lab)
        boxes.append((int(xs.min()) * 4, int(ys.min()) * 4, int(xs.max()) * 4 + 4, int(ys.max()) * 4 + 4))
    return raw, boxes


def export_items(src_name: str, names_in_reading_order: list[str], folder: str, max_side: int, report: dict, min_area: int = 4000) -> dict:
    path = os.path.join(SRC, src_name)
    raw, boxes = components_of(path, len(names_in_reading_order), min_area=min_area)
    if len(boxes) != len(names_in_reading_order):
        raise RuntimeError(f"{src_name}: found {len(boxes)} items, expected {len(names_in_reading_order)}")
    # Reading order: rows by centre y (tolerant), then x.
    rows: list[list[tuple[int, int, int, int]]] = []
    for b in sorted(boxes, key=lambda b: (b[1] + b[3]) / 2):
        cy = (b[1] + b[3]) / 2
        if rows and abs(((rows[-1][0][1] + rows[-1][0][3]) / 2) - cy) < 180:
            rows[-1].append(b)
        else:
            rows.append([b])
    ordered = [b for r in rows for b in sorted(r, key=lambda b: b[0])]
    out = {}
    h, w = raw.shape[:2]
    for name, (x0, y0, x1, y1) in zip(names_in_reading_order, ordered):
        m = 10
        x0, y0, x1, y1 = max(0, x0 - m), max(0, y0 - m), min(w, x1 + m), min(h, y1 + m)
        crop = raw[y0:y1, x0:x1].copy()
        # Remove fragments of neighbouring items that leaked into the box.
        crop = clean_alpha(crop, min_island=min_area)
        ca = crop[:, :, 3]
        ys, xs = np.nonzero(ca >= ALPHA_FLOOR)
        crop = crop[ys.min() : ys.max() + 1, xs.min() : xs.max() + 1]
        img = Image.fromarray(np.ascontiguousarray(crop))
        scale = min(1.0, max_side / max(img.size))
        if scale < 1:
            img = premul_resize(img, (round(img.width * scale), round(img.height * scale)))
        rel = f"assets/{folder}/{name}.webp"
        nbytes = save_webp(img, os.path.join(ROOT, "public", rel), quality=88)
        out[name] = {"image": rel, "width": img.width, "height": img.height, "bytes": nbytes, "sourceBox": [x0, y0, x1, y1]}
    report[src_name] = out

    # Review sheet on light and dark.
    ensure(REVIEW)
    items = [Image.open(os.path.join(ROOT, "public", v["image"])).convert("RGBA") for v in out.values()]
    cw = max(i.width for i in items) + 20
    ch = max(i.height for i in items) + 20
    sheet = Image.new("RGBA", (cw * len(items), ch * 2), (0, 0, 0, 255))
    for row, bg in enumerate([(244, 236, 214, 255), (28, 46, 34, 255)]):
        for i, it in enumerate(items):
            tile = Image.new("RGBA", (cw, ch), bg)
            tile.alpha_composite(it, ((cw - it.width) // 2, (ch - it.height) // 2))
            sheet.paste(tile, (i * cw, row * ch))
    sheet.convert("RGB").save(os.path.join(REVIEW, f"{folder}-{os.path.splitext(src_name)[0]}.png"))
    return out


def split_panel_leaf(ui: dict, report: dict) -> None:
    """
    The cream panel arrives with a leaf accent baked into its top-right corner.
    As a 9-slice border the leaf falls outside the corner slice, so it gets
    stretched along the top and right edges and sits under whatever control
    lives in that corner. Split it into a clean, symmetric frame (right half =
    mirrored left half; the frame shape is symmetric) plus a separate leaf
    sprite that CSS places as an independent, non-interactive decoration.
    """
    entry = ui["cream-panel"]
    path = os.path.join(ROOT, "public", entry["image"])
    im = np.array(Image.open(path).convert("RGBA")).astype(np.int32)
    h, w = im.shape[:2]
    r, g, b, a = im[..., 0], im[..., 1], im[..., 2], im[..., 3]
    green = (g > r + 6) & (g > b + 6) & (a > 8)
    region = np.zeros_like(green)
    region[: h // 2, w // 2 :] = True
    green &= region
    leaf_mask = np.array(Image.fromarray((green * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5))) > 0
    ys, xs = np.nonzero(leaf_mask)
    leaf = im.copy()
    leaf[..., 3] = np.where(leaf_mask, a, 0)
    leaf = leaf[ys.min() : ys.max() + 1, xs.min() : xs.max() + 1]
    leaf_img = Image.fromarray(leaf.astype(np.uint8))
    leaf_rel = "assets/ui/panel-leaf.webp"
    leaf_bytes = save_webp(leaf_img, os.path.join(ROOT, "public", leaf_rel), quality=90)

    clean = im.copy()
    half = (w + 1) // 2
    clean[:, w - half :] = im[:, :half][:, ::-1]
    nbytes = save_webp(Image.fromarray(clean.astype(np.uint8)), path, quality=88)
    entry["bytes"] = nbytes
    entry["leafRemoved"] = True
    # Leaf position relative to the panel's top-right corner (source px), for CSS placement.
    ui["panel-leaf"] = {
        "image": leaf_rel,
        "width": leaf_img.width,
        "height": leaf_img.height,
        "bytes": leaf_bytes,
        "fromPanelRight": int(w - 1 - xs.max()),
        "fromPanelTop": int(ys.min()),
    }
    report["panel-leaf"] = ui["panel-leaf"]


def export_background(src_name: str, rel: str, quality: int, report: dict, max_w: int | None = None) -> dict:
    path = os.path.join(SRC, src_name)
    im = Image.open(path).convert("RGB")
    if max_w and im.width > max_w:
        im = im.resize((max_w, round(im.height * max_w / im.width)), Image.LANCZOS)
    nbytes = save_webp(im, os.path.join(ROOT, "public", rel), quality=quality)
    entry = {"image": rel, "width": im.width, "height": im.height, "bytes": nbytes, "sourceSha256": sha256(path)}
    report[src_name] = entry
    return entry


def main() -> int:
    ensure(OUT)
    report: dict = {}
    manifest: dict = {"schemaVersion": 1, "generatedBy": "tools/art/extract.py", "characters": {}, "treasures": {}, "foliage": {}, "ui": {}, "backgrounds": {}}

    for cid, fn in CHARACTERS.items():
        meta = process_character(cid, fn, report)
        manifest["characters"][cid] = {
            "image": meta["image"],
            "portrait": f"assets/characters/{cid}-portrait.webp",
            "frameWidth": meta["frameWidth"],
            "frameHeight": meta["frameHeight"],
            "spacing": meta["spacing"],
            "pivot": meta["pivot"],
            "content": meta["content"],
            "contentActive": meta["contentActive"],
            "sequences": meta["sequences"],
            "bytes": meta["bytes"],
            "decodedBytes": meta["decodedBytes"],
        }
        print(f"character {cid}: frame {meta['frameWidth']}x{meta['frameHeight']} shifts {meta['registrationShiftsX']} edge {meta['edgeTouchingFrames']}")

    manifest["treasures"] = export_items("treasure-kit-v1.png", ["coconut", "nut", "flower", "stone", "shell", "berries"], "treasures", 320, report)
    manifest["foliage"] = export_items(
        "foliage-kit-v1.png",
        ["hedge-a", "hedge-b", "rocks", "flower-bush", "banana-plant", "fern", "monstera", "butterfly"],
        "foliage",
        384,
        report,
    )
    manifest["ui"] = export_items("ui-surfaces-v1.png", ["wood-button", "leaf-button", "cream-pill", "cream-panel"], "ui", 720, report)
    split_panel_leaf(manifest["ui"], report)
    manifest["backgrounds"]["jungle"] = export_background("jungle-backdrop-v1.png", "assets/bg/jungle.webp", 80, report)
    manifest["backgrounds"]["collection"] = export_background("collection-background-v1.png", "assets/bg/collection.webp", 80, report)
    manifest["backgrounds"]["ground"] = export_background("ground-plate-v1.png", "assets/bg/ground.webp", 82, report)

    total = 0
    for group in ("characters", "treasures", "foliage", "ui", "backgrounds"):
        for v in manifest[group].values():
            total += v.get("bytes", 0)
    manifest["totalBytes"] = total
    with open(os.path.join(OUT, "manifest.json"), "w") as fh:
        json.dump(manifest, fh, indent=1)
    # Typed copy for the app bundle (imported statically by src/game/assets.ts).
    with open(os.path.join(ROOT, "src", "data", "assetManifest.json"), "w") as fh:
        json.dump(manifest, fh, indent=1)
    ensure(REVIEW)
    with open(os.path.join(REVIEW, "extraction-report.json"), "w") as fh:
        json.dump(report, fh, indent=1)
    print(f"total runtime bytes: {total}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
