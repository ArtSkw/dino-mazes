#!/usr/bin/env python3
"""
Dino Mazes art packager (DEVELOPMENT_PLAN.md §5.4–5.5).

Reads immutable sources from art/source/ and writes optimized runtime
derivatives to public/assets/ plus QA aids to art/review/runtime/.

* Characters (V3) and intro assets: see tools/art/v3.py (36 frames per friend,
  tiered trimmed Phaser multiatlases; intro curtains, pop-ups, sign, sprout).
* Treasure, foliage and UI kits: isolated by alpha connected components.
* Backgrounds: converted to WebP at source resolution (never upscaled).

Sources are never modified. Run: npm run art
"""
from __future__ import annotations

import hashlib
import json
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rigs  # noqa: E402
import v3  # noqa: E402
import entry  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, "art", "source")
OUT = os.path.join(ROOT, "public", "assets")
REVIEW = os.path.join(ROOT, "art", "review", "runtime")

ALPHA_FLOOR = 10      # alpha below this is invisible generation residue -> 0
SOLID = 40            # alpha considered "subject" for measuring
MIN_ISLAND = 220      # px; smaller detached islands are specks



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


# New treasures (owner requests, 14 Oct 2026; art/CODEX_REQUEST_TREASURES.md,
# art/CODEX_REQUEST_FINISH.md): one approved transparent PNG each in
# source/treasures-v2/. A missing file is skipped, and the game leaves that
# treasure out until it exists (treasureHasArt).
NEW_TREASURES = ["feather", "strawberry", "amber", "gigaflower", "crystal"]
NEW_TREASURE_DIR = os.path.join(SRC, "treasures-v2")
# The approved motion masters replace the kit drawings of these stills, so the
# still and its rig show the same design (art/CLAUDE_HANDOFF_MOTION.md).
MOTION_MASTER_STILLS = {
    "treasures": ["coconut", "nut", "flower", "berries", "stone", "shell"],
    "foliage": ["butterfly", "banana-plant", "fern", "monstera"],
}
# Max side of each rig's still (its parts are packed at that scale): what it is
# drawn at on a tablet at 2x, not more.
RIG_SIZES = {"butterfly": 320, "banana-plant": 384, "fern": 384, "monstera": 384, "confetti": 320, "pointer": 192, "ladybug": 128, "snail": 128, "frog": 128}


def export_still(path: str, rel: str, max_side: int) -> dict:
    """One transparent image trimmed to its alpha box and scaled to `max_side`."""
    rgba = clean_alpha(np.array(Image.open(path).convert("RGBA")))
    ys, xs = np.nonzero(rgba[:, :, 3] >= ALPHA_FLOOR)
    if len(xs) == 0:
        raise RuntimeError(f"{path}: empty image")
    img = Image.fromarray(np.ascontiguousarray(rgba[ys.min() : ys.max() + 1, xs.min() : xs.max() + 1]))
    scale = min(1.0, max_side / max(img.size))
    if scale < 1:
        img = premul_resize(img, (round(img.width * scale), round(img.height * scale)))
    nbytes = save_webp(img, os.path.join(ROOT, "public", rel), quality=88)
    return {"image": rel, "width": img.width, "height": img.height, "bytes": nbytes, "sourceSha256": sha256(path)}


def export_single_treasures(max_side: int, report: dict) -> dict:
    out: dict = {}
    for name in NEW_TREASURES:
        path = os.path.join(NEW_TREASURE_DIR, f"{name}.png")
        if not os.path.exists(path):
            print(f"treasure {name}: no art yet ({os.path.relpath(path, ROOT)}), left out of the game")
            continue
        out[name] = export_still(path, f"assets/treasures/{name}.webp", max_side)
    report["treasures-v2"] = out
    return out


def export_motion_master_stills(folder: str, max_side: int, report: dict) -> dict:
    out: dict = {}
    for name in MOTION_MASTER_STILLS[folder]:
        path = os.path.join(SRC, "motion", name, "master.png")
        if os.path.exists(path):
            out[name] = export_still(path, f"assets/{folder}/{name}.webp", RIG_SIZES.get(name, max_side))
    report[f"motion-master-stills-{folder}"] = out
    return out


def export_emblem(ui: dict, report: dict, max_side: int = 192) -> None:
    """Giganto's footprint badge for the collection (art/CODEX_REQUEST_FINISH.md), when delivered."""
    path = os.path.join(SRC, "ui", "giganto-emblem.png")
    if not os.path.exists(path):
        print("giganto-emblem: no art yet, the game draws a footprint")
        return
    rgba = clean_alpha(np.array(Image.open(path).convert("RGBA")))
    ys, xs = np.nonzero(rgba[:, :, 3] >= ALPHA_FLOOR)
    img = Image.fromarray(np.ascontiguousarray(rgba[ys.min() : ys.max() + 1, xs.min() : xs.max() + 1]))
    scale = min(1.0, max_side / max(img.size))
    if scale < 1:
        img = premul_resize(img, (round(img.width * scale), round(img.height * scale)))
    rel = "assets/ui/giganto-emblem.webp"
    nbytes = save_webp(img, os.path.join(ROOT, "public", rel), quality=88)
    ui["giganto-emblem"] = {"image": rel, "width": img.width, "height": img.height, "bytes": nbytes, "sourceSha256": sha256(path)}
    report["giganto-emblem"] = ui["giganto-emblem"]


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
    manifest: dict = {"schemaVersion": 2, "generatedBy": "tools/art/extract.py", "characters": {}, "treasures": {}, "foliage": {}, "ui": {}, "backgrounds": {}}

    # Characters V3: 36 frames per friend, tiered trimmed atlases (tools/art/v3.py).
    manifest["characters"] = v3.process_characters(SRC, os.path.join(ROOT, "public"), REVIEW, report)

    manifest["treasures"] = export_items("treasure-kit-v1.png", ["coconut", "nut", "flower", "stone", "shell", "berries"], "treasures", 320, report)
    manifest["treasures"].update(export_motion_master_stills("treasures", 320, report))
    manifest["treasures"].update(export_single_treasures(320, report))
    manifest["foliage"] = export_items(
        "foliage-kit-v1.png",
        ["hedge-a", "hedge-b", "rocks", "flower-bush", "banana-plant", "fern", "monstera", "butterfly"],
        "foliage",
        384,
        report,
    )
    manifest["foliage"].update(export_motion_master_stills("foliage", 320, report))
    # Painted parts (art/CLAUDE_HANDOFF_TREASURES.md, art/CLAUDE_HANDOFF_MOTION.md):
    # every treasure that has them, and the butterfly; the chest goes to the DOM.
    manifest["rigs"] = rigs.process_rigs(ROOT, SRC, {**{t: 320 for t in manifest["treasures"]}, **RIG_SIZES}, clean_alpha, ALPHA_FLOOR, report)
    manifest["chest"] = rigs.export_chest(ROOT, SRC, clean_alpha, ALPHA_FLOOR, save_webp, report)
    manifest["ui"] = export_items("ui-surfaces-v1.png", ["wood-button", "leaf-button", "cream-pill", "cream-panel"], "ui", 720, report)
    split_panel_leaf(manifest["ui"], report)
    export_emblem(manifest["ui"], report)
    manifest["backgrounds"]["jungle"] = export_background("jungle-backdrop-v1.png", "assets/bg/jungle.webp", 80, report)
    manifest["backgrounds"]["collection"] = export_background("collection-background-v1.png", "assets/bg/collection.webp", 80, report)
    manifest["backgrounds"]["ground"] = export_background("ground-plate-v1.png", "assets/bg/ground.webp", 82, report)
    manifest["entry"] = entry.process_entry(SRC, os.path.join(ROOT, "public"), os.path.join(ROOT, "art", "review", "entry", "registration.json"), report)
    manifest["intro"] = v3.process_intro(
        SRC,
        os.path.join(ROOT, "public"),
        os.path.join(ROOT, "art", "review", "intro", "measurements.json"),
        os.path.join(ROOT, "art", "review", "intro", "cell-rects.json"),
        report,
    )

    total = 0
    for group in ("characters", "treasures", "foliage", "ui", "backgrounds", "intro"):
        for v in manifest[group].values():
            if isinstance(v, dict):
                total += v.get("bytes", 0)
    total += manifest["entry"]["bytes"]
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
