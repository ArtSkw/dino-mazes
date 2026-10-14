#!/usr/bin/env python3
"""
Writes art/prompts/jobs-motion.json: the GPT Imagegen jobs for the rigged,
"living" small assets in art/CODEX_REQUEST_MOTION.md.
Run: python3 tools/art/make_motion_jobs.py

Method (proven on the V3 characters): one ASSEMBLED master per asset first,
then every part is an EDIT of that master that keeps exactly the same canvas,
scale and position and erases everything except that part. Parts therefore
stack back into the master with no registration work, and Claude can measure
pivots from them.
"""
from __future__ import annotations

import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "art", "prompts", "jobs-motion.json")

STYLE = (
    "Polished 2D cartoon illustration matching the Gigantosaurus TV series and the existing Dino Mazes painted kit: "
    "softly shaded dimensional shapes, crisp clean antialiased outlines, warm light from the upper left, rich but not "
    "oversaturated colour. TRUE transparent alpha background (no checkerboard, no matte, no halo, no floor shadow). "
    "No text, letters, numbers, logos or watermark."
)
CANVAS = "Square 1024x1024 canvas; the assembled object is centred and fills about 70% of the canvas, with generous transparent margins on every side."
PART_RULES = (
    "Edit image 1. Keep the canvas size, scale and the exact position of this part identical to image 1. "
    "ERASE everything except the named part, leaving true transparency. Repaint the part as a COMPLETE piece: "
    "where another part used to cover it (a joint, a root, an overlap), continue its shape and painting naturally "
    "for a short distance under that area, so the part can rotate without revealing a gap. Do not move, resize, "
    "re-angle or restyle the part. "
)

ASSETS: list[dict] = [
    {
        "id": "butterfly",
        "priority": 1,
        "master": "One small golden-orange jungle butterfly seen from DIRECTLY ABOVE, wings fully open and flat, body vertical in the centre (head at the top), two thin curled antennae. Wings: rounded orange-gold forewings and hindwings with soft dark edges and a few cream spots, matching the butterfly already in the game.",
        "parts": {
            "body": "the body with head and both antennae (no wings); continue the thorax slightly where the wings were attached",
            "wing-left-fore": "only the LEFT forewing (viewer's left, upper); extend its root slightly under where the body was",
            "wing-left-hind": "only the LEFT hindwing (viewer's left, lower); extend its root slightly under the body area",
            "wing-right-fore": "only the RIGHT forewing (viewer's right, upper); extend its root slightly under the body area",
            "wing-right-hind": "only the RIGHT hindwing (viewer's right, lower); extend its root slightly under the body area",
        },
        "extra": {
            "perched": "The SAME butterfly seen from the SIDE, perched with its wings folded up together above the body, legs resting on an invisible twig. Same colours and painting style. Separate image, same canvas size."
        },
        "motion": "Wings hinge at their roots: fast down-stroke, slow up-stroke, hindwings 2 frames behind the forewings; the body lifts on each beat; glides with wings open; lands and folds (perched view) with slow breathing.",
    },
    {
        "id": "coconut",
        "priority": 1,
        "master": "One whole fuzzy brown coconut, the same design as the coconut treasure already in the game (fibrous husk, three dark eyes on one end), slightly tilted, sitting on nothing.",
        "parts": {
            "body": "the coconut WITHOUT its glossy highlight: paint the husk evenly lit where the highlight was",
            "highlight": "ONLY the soft glossy highlight / rim light of the coconut as a separate soft translucent white-cream shape, everything else transparent",
            "tuft": "only the small loose tuft of husk fibres at the top, with its root continued slightly under the shell",
        },
        "motion": "Rocks with anticipation and rolls along a short arc while the highlight stays fixed (light does not rotate); the tuft lags and settles.",
    },
    {
        "id": "nut",
        "priority": 1,
        "master": "One golden-brown hazelnut sitting in its frilly leafy green cup (cupule), the same design as the nut treasure already in the game.",
        "parts": {
            "nut": "only the hazelnut itself, continued smoothly where the leafy cup covered it",
            "cup": "only the frilly leafy cup (cupule), its inside continued where the nut covered it",
        },
        "motion": "Crouch, hop with stretch, squash on landing; the cup lags 4 frames and flutters back (follow-through).",
    },
    {
        "id": "flower",
        "priority": 1,
        "master": "One friendly coral-pink five-petalled jungle flower facing the viewer, a short green stem and two leaves, the same design as the flower treasure already in the game; the five petals clearly separated from each other.",
        "parts": {
            "center": "only the flower centre (stamens / disc)",
            "petal-1": "only the TOP petal; continue its base under the centre",
            "petal-2": "only the UPPER-RIGHT petal; continue its base under the centre",
            "petal-3": "only the LOWER-RIGHT petal; continue its base under the centre",
            "petal-4": "only the LOWER-LEFT petal; continue its base under the centre",
            "petal-5": "only the UPPER-LEFT petal; continue its base under the centre",
            "stem": "only the stem; continue its top under the flower head",
            "leaf-left": "only the left leaf; continue its base into the stem",
            "leaf-right": "only the right leaf; continue its base into the stem",
        },
        "motion": "Petals sway individually and out of step around their bases; the stem bends with the shared wind; on find the petals open from closed with a 60 ms stagger and pollen puffs.",
    },
    {
        "id": "stone",
        "priority": 2,
        "master": "One smooth turquoise shiny pebble with a soft painted glint, the same design as the stone treasure already in the game.",
        "parts": {
            "body": "the pebble WITHOUT its shine: evenly painted turquoise where the glint was",
            "glint": "ONLY the bright glint and soft sheen as a separate translucent white shape, everything else transparent",
        },
        "motion": "Still body; the glint sweeps across inside the pebble's silhouette (masked); on find a four-point star flares on the glint.",
    },
    {
        "id": "shell",
        "priority": 2,
        "master": "One peach spiral seashell, the same design as the shell treasure already in the game.",
        "parts": {
            "body": "the shell WITHOUT highlights: evenly painted where the shine was",
            "glint": "ONLY the highlights of the shell as a separate translucent white shape, everything else transparent",
        },
        "motion": "A glint travels along the spiral (Claude traces the spiral path); the shell wobbles and turns over with squash on find.",
    },
    {
        "id": "berries",
        "priority": 1,
        "master": "A small bunch of exactly FIVE round blue blueberries on a short green stem with two leaves, the same design as the berries treasure already in the game; each berry clearly separate.",
        "parts": {
            "berry-1": "only the TOP-LEFT berry, completed where neighbours overlapped it",
            "berry-2": "only the TOP-RIGHT berry, completed where neighbours overlapped it",
            "berry-3": "only the MIDDLE berry, completed where neighbours overlapped it",
            "berry-4": "only the BOTTOM-LEFT berry, completed where neighbours overlapped it",
            "berry-5": "only the BOTTOM-RIGHT berry, completed where neighbours overlapped it",
            "stem": "only the stem, continued under the berries",
            "leaves": "only the two leaves, continued into the stem",
        },
        "motion": "Each berry jiggles on its own, out of step, like jelly; the leaves flutter; on find they bounce with overlapping lag.",
    },
    {
        "id": "chest",
        "priority": 1,
        "master": "A small friendly treasure chest made of the same warm honey wood as the game's wooden buttons, with rounded corners, soft gold trim and a rounded latch, lid CLOSED, front three-quarter view.",
        "parts": {
            "base": "only the chest's lower box (without the lid); paint its open top edge and a little dark interior where the lid covered it",
            "lid": "only the lid, including its full back edge and hinge side",
        },
        "extra": {
            "open": "The SAME chest with the lid wide open, a warm golden glow inside, no objects in it. Separate image, same canvas size and chest position.",
        },
        "motion": "On the collection button and at the end of a celebration: anticipation squash, the lid pops open on a playful spring (damping 0.5), the treasure drops in, the lid snaps shut with a bounce; the count badge springs.",
    },
    {
        "id": "confetti",
        "priority": 2,
        "master": "A loose set of six small separate celebration confetti pieces in the game's painted style, spread across the canvas with wide transparent gaps: two different green jungle leaves, two coral-pink flower petals, one small yellow petal and one tiny round pink flower.",
        "parts": {},
        "motion": "Painted pieces that flip (scaleX through zero) and drift with drag instead of flat blobs exploding at once.",
    },
    {
        "id": "plants",
        "priority": 2,
        "master": "The three framing plants already in the game, side by side with wide gaps: a broad-leaf banana plant, a curled fern and a monstera; each plant made of clearly separate leaves / fronds growing from one base.",
        "parts": {
            "banana-base": "only the banana plant's base and stem cluster",
            "banana-leaves": "only the banana plant's leaves, each still attached at its own root",
            "fern-base": "only the fern's base",
            "fern-fronds": "only the fern's fronds",
            "monstera-base": "only the monstera's stems",
            "monstera-leaves": "only the monstera's leaves",
        },
        "motion": "The shared wind moves bases a little and leaves/fronds more, each with a delay (follow-through), so gusts ripple through the plant.",
    },
    {
        "id": "pointer",
        "priority": 3,
        "master": "A friendly cartoon child's hand with the index finger pointing up, soft rounded shapes, light skin, the same painted style; seen from the front.",
        "parts": {},
        "extra": {"press": "The SAME hand pressing down: the fingertip slightly squashed, with a small soft round press shadow under the tip. Same canvas and position."},
        "motion": "Replaces the code-drawn hand of the first-maze demo: press (squash), drag along the path with ease-in-out, lift with a little follow-through.",
    },
    {
        "id": "critters",
        "priority": 3,
        "master": "Three tiny jungle critters seen from directly above, spread across the canvas with wide gaps: a red ladybug, a small snail with a spiral shell, a little green frog sitting.",
        "parts": {
            "ladybug-shell": "only the ladybug's spotted wing cases",
            "ladybug-body": "only the ladybug's body, head and legs, continued under the wing cases",
            "snail-shell": "only the snail's shell",
            "snail-body": "only the snail's soft body, continued under the shell",
            "frog": "only the frog",
        },
        "motion": "Optional hidden critters on the hedge (never on corridors): the ladybug opens its wing cases and flies off when tapped, the snail pulls into its shell, the frog hops.",
    },
]


# Owner-approved masters (art/CLAUDE_HANDOFF_MOTION.md); their parts are to do.
APPROVED_MASTERS = {"butterfly", "coconut", "nut", "flower", "berries", "chest"}


def main() -> None:
    jobs = []
    for a in ASSETS:
        folder = f"source/motion/{a['id']}"
        jobs.append({
            "id": f"motion-{a['id']}-master",
            "output": f"{folder}/master.png",
            "prompt": f"{a['master']} {CANVAS} {STYLE}",
            "refs": ["source/treasure-kit-v1.png", "source/foliage-kit-v1.png", "source/ui-surfaces-v1.png"],
            "alpha": True,
            "priority": a["priority"],
            "status": "done" if a["id"] in APPROVED_MASTERS else "todo",
            "motion": a["motion"],
        })
        for name, what in a["parts"].items():
            jobs.append({
                "id": f"motion-{a['id']}-{name}",
                "output": f"{folder}/{name}.png",
                "edit": f"{folder}/master.png",
                "prompt": f"{PART_RULES}The part to keep: {what}. {STYLE}",
                "alpha": True,
                "priority": a["priority"],
                "status": "todo",
            })
        for name, what in a.get("extra", {}).items():
            jobs.append({
                "id": f"motion-{a['id']}-{name}",
                "output": f"{folder}/{name}.png",
                "edit": f"{folder}/master.png",
                "prompt": f"Edit image 1. {what} {STYLE}",
                "alpha": True,
                "priority": a["priority"],
                "status": "todo",
            })
    with open(OUT, "w") as fh:
        json.dump({"schemaVersion": 1, "request": "art/CODEX_REQUEST_MOTION.md", "jobs": jobs}, fh, indent=1, ensure_ascii=False)
    by = {}
    for j in jobs:
        by[j["priority"]] = by.get(j["priority"], 0) + 1
    print(f"wrote {len(jobs)} jobs to {os.path.relpath(OUT, ROOT)} (by priority: {dict(sorted(by.items()))})")


if __name__ == "__main__":
    main()
