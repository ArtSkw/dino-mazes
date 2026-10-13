#!/usr/bin/env python3
"""
Writes art/prompts/jobs-v3-characters.json: the GPT Imagegen job list for the
high-resolution, double-frame-rate character sets requested in
art/CODEX_REQUEST_V3.md. Run: python3 tools/art/make_v3_jobs.py

One master frame per character, then every other frame is an EDIT of the
master (or of its neighbouring key frames), one frame per image. Generating a
single frame per image is what makes the frames truly high resolution; editing
from one master is what keeps identity, scale and registration identical.
"""
from __future__ import annotations

import json
import os

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "art", "prompts", "jobs-v3-characters.json")

IDENTITY = {
    "bill": "BILL: blue/slate teal slender long-necked brachiosaurus, long pale cream rectangular muzzle and front neck, two nostril dots on top of the muzzle, bright blue eyes, small blue arms, blue mottled skin, small pointed head plume at the back of the head. Distinctive narrow face, not a generic smiling sauropod.",
    "tiny": "TINY: bright green triceratops, green rounded scalloped frill, two cream brow horns and a little nose horn, dark blue-gray beak, large green eyes, pale yellow underside. Preserve the dark beak and the real horn anatomy, not a generic green dinosaur.",
    "mazu": "MAZU: orange-brown compact ankylosaurus, large round eyes high on a spotted head, broad short orange-brown muzzle, cream jaw and belly, small arms. Precisely preserve her face and markings; no horns, glasses or accessories.",
    "rocky": "ROCKY: red/orange parasaurolophus, long cream narrow face and throat, signature backward-swept cream crest, large eyes, red mottled skin, small arms. Match the exact rectangular muzzle and crest shape.",
    "giganto": "GIGANTO: enormous moss-green Gigantosaurus, long broad crocodilian snout with raised brow ridges, small red/brown eyes, irregular dark green mottling, pale cream massive lower jaw and underside, row of small red back spikes, small arms. Friendly: relaxed closed mouth or small smile with only a few teeth showing; never aggressive or roaring. Facing viewer-right.",
}

COMMON = (
    "Polished 2D cartoon illustration in the style of the Gigantosaurus TV series: softly shaded dimensional shapes, "
    "crisp clean antialiased outlines, warm light from the upper left, rich but not oversaturated colour. "
    "TRUE transparent alpha background (no checkerboard pixels, no white or coloured matte, no halo). "
    "Upper-body bust, front three-quarter view, crop straight across at the waist at the bottom of the canvas; "
    "never crop the head, crest, frill, horns or plume. No text, numbers, grid lines, frame borders, floor shadow, "
    "scenery, foliage, props or other characters. Re-illustrate cleanly; do not cut pixels out of the reference photo."
)

CANVAS = (
    "Square canvas at the largest size the tool supports (2048x2048 preferred, never below 1024x1024). "
    "The character fills about 78% of the canvas height with 11% transparent margin above the highest point "
    "(crest/plume/frill) and the waist crop sitting exactly on the bottom edge; centred horizontally with at "
    "least 6% clear margin left and right."
)

EDIT_LOCK = (
    "Edit image 1. Keep EVERYTHING identical to image 1 — same character identity, colours, markings, line "
    "quality, canvas size, camera, scale, waist baseline on the bottom edge and head position (within 2% of the "
    "canvas) — and change ONLY the pose detail described here: "
)

# 36 frames per character: four 8-frame reactions (double the old 4) plus an
# optional 4-frame talk loop for the new speech bubble. Old frame k maps to
# new frame 2k inside each reaction; odd frames are new in-betweens.
FRAMES: list[tuple[str, str, str]] = [
    # (frame id, base for the edit, pose delta)
    ("idle-00", "master", "neutral gentle closed-mouth smile, arms relaxed (this IS the master pose; reproduce it exactly)"),
    ("idle-01", "idle-00", "begin a slow inhale: chest and shoulders rise by about 1% of the canvas height"),
    ("idle-02", "idle-00", "full gentle inhale: chest and shoulders 2% higher, head tilts up very slightly"),
    ("idle-03", "idle-02", "same as image 1 but upper eyelids half closed"),
    ("idle-04", "idle-02", "same as image 1 but eyes fully closed in a soft blink"),
    ("idle-05", "idle-02", "same as image 1 but eyelids half open, coming out of the blink"),
    ("idle-06", "idle-00", "returning to neutral: chest 1% higher than image 1, eyes open"),
    ("idle-07", "idle-00", "tiny exhale settle: shoulders 0.5% lower than image 1, otherwise identical"),
    ("drawing-08", "idle-00", "attentive: eyes open a little wider, eyebrows slightly raised, mouth a small interested smile"),
    ("drawing-09", "drawing-08", "head turned halfway toward viewer-right, eyes leading the turn"),
    ("drawing-10", "drawing-08", "head turned toward viewer-right as if watching something exciting, eyes looking right"),
    ("drawing-11", "drawing-08", "head dipping halfway into a small encouraging nod"),
    ("drawing-12", "drawing-08", "small nod: head lowered about 3% of the canvas height, chin down, eyes still open and friendly"),
    ("drawing-13", "drawing-08", "head rising back up from the nod, halfway"),
    ("drawing-14", "drawing-08", "back to the attentive pose of image 1, slight happy squint"),
    ("drawing-15", "idle-00", "settling from attentive to neutral: eyebrows halfway down"),
    ("encouragement-16", "idle-00", "friendly open smile, eyes bright"),
    ("encouragement-17", "encouragement-16", "one small hand (viewer-right hand) starts to rise: elbow bent, hand at belly height"),
    ("encouragement-18", "encouragement-16", "the same hand raised to chest height, palm turning toward the viewer"),
    ("encouragement-19", "encouragement-16", "the same hand at shoulder height, open palm facing the viewer"),
    ("encouragement-20", "encouragement-19", "wave: the raised hand tilts outward (away from the face) about 15 degrees"),
    ("encouragement-21", "encouragement-19", "wave: the raised hand tilts inward (toward the face) about 15 degrees"),
    ("encouragement-22", "encouragement-16", "the hand lowering, back at chest height, still smiling"),
    ("encouragement-23", "encouragement-16", "hand back at rest, warm closed-mouth smile"),
    ("celebration-24", "idle-00", "happy anticipation: big eyes, delighted open smile, shoulders slightly raised"),
    ("celebration-25", "celebration-24", "small anticipation squash: body 1.5% lower and slightly wider, arms pulled in"),
    ("celebration-26", "celebration-24", "both small arms slightly raised in joy"),
    ("celebration-27", "celebration-24", "both arms higher, eyes squeezed into happy crescents"),
    ("celebration-28", "celebration-24", "delighted broad open smile, arms up, peak of the cheer"),
    ("celebration-29", "celebration-28", "small happy bounce: whole bust 2% higher than image 1, arms up"),
    ("celebration-30", "celebration-24", "happy settle: arms coming down, big smile"),
    ("celebration-31", "idle-00", "arms back at rest, content happy smile, eyes soft"),
    # Optional (priority 2): talk loop shown while the speech bubble is visible.
    ("talk-32", "idle-00", "mouth gently closed, friendly smile, eyes looking at the viewer"),
    ("talk-33", "idle-00", "mouth slightly open as if starting a word, eyes looking at the viewer"),
    ("talk-34", "idle-00", "mouth open on an 'ah' sound (friendly, small, not roaring), eyes looking at the viewer"),
    ("talk-35", "idle-00", "mouth rounded on an 'oh' sound, eyes looking at the viewer"),
]


def master_prompt(cid: str) -> str:
    return (
        f"Use case: identity-preserve. ONE single high-resolution character frame (not a sheet). {IDENTITY[cid]} "
        "Image 1 is the identity reference (the TV cast); image 2 is the current game frame for this character, "
        "which fixes the pose, crop and three-quarter angle to keep. Keep the look of image 2 but render it far "
        f"sharper and cleaner, matching image 1's character design exactly. Pose: neutral gentle closed-mouth smile, arms relaxed. {CANVAS} {COMMON}"
    )


def edit_prompt(cid: str, delta: str) -> str:
    return f"{EDIT_LOCK}{delta}. {IDENTITY[cid]} {COMMON}"


def export_frame0_refs() -> None:
    """Frame 0 of each current runtime sheet: the pose/crop reference for the masters."""
    with open(os.path.join(ROOT, "src", "data", "assetManifest.json")) as fh:
        manifest = json.load(fh)
    for cid, meta in manifest["characters"].items():
        sheet = Image.open(os.path.join(ROOT, "public", meta["image"])).convert("RGBA")
        frame = sheet.crop((0, 0, meta["frameWidth"], meta["frameHeight"]))
        frame.save(os.path.join(ROOT, "art", "review", "runtime", f"{cid}-frame0.png"))


def main() -> None:
    export_frame0_refs()
    jobs = []
    for cid in IDENTITY:
        folder = f"source/character-{cid}-v3"
        jobs.append(
            {
                "id": f"character-{cid}-v3-master",
                "output": f"{folder}/master.png",
                "prompt": master_prompt(cid),
                "alpha": True,
                "refs": ["references/gigantosaurus-cast.png", f"review/runtime/{cid}-frame0.png"],
                "priority": 1,
            }
        )
        for fid, base, delta in FRAMES:
            base_path = f"{folder}/master.png" if base == "master" else f"{folder}/{base}.png"
            if fid == "idle-00":
                # The master itself is idle-00 (copy, no generation).
                jobs.append({"id": f"character-{cid}-v3-{fid}", "output": f"{folder}/{fid}.png", "copyOf": f"{folder}/master.png", "priority": 1})
                continue
            jobs.append(
                {
                    "id": f"character-{cid}-v3-{fid}",
                    "output": f"{folder}/{fid}.png",
                    "edit": base_path,
                    "prompt": edit_prompt(cid, delta),
                    "alpha": True,
                    "refs": ["references/gigantosaurus-cast.png"],
                    "priority": 2 if fid.startswith("talk") else 1,
                }
            )
    with open(OUT, "w") as fh:
        json.dump({"schemaVersion": 1, "request": "art/CODEX_REQUEST_V3.md", "jobs": jobs}, fh, indent=1, ensure_ascii=False)
    print(f"wrote {len(jobs)} jobs to {os.path.relpath(OUT, ROOT)}")


if __name__ == "__main__":
    main()
