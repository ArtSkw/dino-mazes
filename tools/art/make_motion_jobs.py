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
        "master": "One smooth turquoise shiny pebble with fine darker veins and a soft painted glint, the same design as the stone treasure already in the game (refs: source/treasure-kit-v1.png): it must stay recognisably the same pebble.",
        "parts": {
            "body": "the pebble WITHOUT its shine: evenly painted turquoise where the glint was",
            "glint": "ONLY the bright glint and soft sheen as a separate translucent white shape, kept SMALL and well inside the pebble's outline, everything else transparent",
        },
        "motion": "Still body; the glint drifts a little and pulses; on find it slides across inside the pebble and a four-point star flares on it.",
    },
    {
        "id": "shell",
        "priority": 2,
        "master": "One peach spiral seashell, the same design as the shell treasure already in the game (refs: source/treasure-kit-v1.png): it must stay recognisably the same shell.",
        "parts": {
            "body": "the shell WITHOUT highlights: evenly painted where the shine was",
            "glint": "ONLY the highlights along the spiral as a separate translucent white shape, kept inside the shell's outline, everything else transparent",
        },
        "motion": "Glints pulse one after another along the spiral; on find the shell wobbles and turns over with a squash.",
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
        "master": "Six small separate celebration confetti pieces in the game's painted style, laid out in two rows of three with WIDE transparent gaps (at least a quarter of the canvas between pieces): a slim green jungle leaf, a round green leaf, a coral-pink hibiscus petal, a pink petal, a small yellow petal and a tiny round pink blossom. Each piece flat and simple, readable at 24 px, painted alike on both faces (it will flip).",
        "parts": {
            "piece-1": "only the top-left piece (the slim green leaf)",
            "piece-2": "only the top-middle piece (the round green leaf)",
            "piece-3": "only the top-right piece (the coral-pink petal)",
            "piece-4": "only the bottom-left piece (the pink petal)",
            "piece-5": "only the bottom-middle piece (the yellow petal)",
            "piece-6": "only the bottom-right piece (the tiny pink blossom)",
        },
        "motion": "Replace the code-drawn leaves and petals that burst from a found treasure: painted pieces that flip (scaleX through zero), spin a little and drift down with drag.",
    },
    {
        "id": "banana-plant",
        "priority": 2,
        "master": "The broad-leaf banana plant already in the game (refs: source/foliage-kit-v1.png), the same design: a short base of stems with several big leaves fanning up and out, each leaf clearly separate.",
        "parts": {
            "base": "only the base and stem cluster, continued a little up into where the leaves start",
            "leaves-back": "only the leaves at the back (behind the others), each still attached at its own root, roots continued slightly into the stems",
            "leaves-front": "only the leaves in front, each still attached at its own root, roots continued slightly into the stems",
        },
        "motion": "The shared wind moves the base a little and each leaf layer more, with a delay, so a gust ripples through the plant.",
    },
    {
        "id": "fern",
        "priority": 2,
        "master": "The curled fern already in the game (refs: source/foliage-kit-v1.png), the same design: fronds arching out of one low base, each frond clearly separate.",
        "parts": {
            "base": "only the low base where the fronds start",
            "leaves-back": "only the fronds at the back, roots continued slightly into the base",
            "leaves-front": "only the fronds in front, roots continued slightly into the base",
        },
        "motion": "The fronds sway with the shared wind, the front ones a beat after the back ones.",
    },
    {
        "id": "monstera",
        "priority": 2,
        "master": "The monstera already in the game (refs: source/foliage-kit-v1.png), the same design: split heart-shaped leaves on long stems from one base, each leaf clearly separate.",
        "parts": {
            "base": "only the stems and base, continued a little into the leaf joints",
            "leaves-back": "only the leaves at the back, each attached at its stem, roots continued slightly",
            "leaves-front": "only the leaves in front, each attached at its stem, roots continued slightly",
        },
        "motion": "The leaves nod on their long stems with the shared wind, front and back out of step.",
    },
    {
        "id": "pointer",
        "priority": 3,
        "master": "A friendly cartoon child's hand with the index finger pointing up, soft rounded shapes, light skin, the same painted style, seen from the front; readable at 60 px.",
        "parts": {},
        "extra": {"press": "The SAME hand pressing down: the fingertip slightly squashed, with a small soft round press shadow under the tip. Same canvas; the fingertip at EXACTLY the same point as in the master."},
        "motion": "Replaces the code-drawn hand of the first-maze demo: press (squash), drag along the path with ease-in-out, lift with a little follow-through.",
    },
    {
        "id": "ladybug",
        "priority": 3,
        "master": "One small red ladybug seen from directly above, black spots and head, six tiny legs, wing cases closed, friendly and round; readable at 30 px.",
        "parts": {
            "body": "only the body, head and legs, continued under the wing cases",
            "shell-left": "only the LEFT wing case, its inner edge continued slightly under the right one",
            "shell-right": "only the RIGHT wing case, its inner edge continued slightly under the left one",
            "wings": "only the two thin translucent flight wings, unfolded and fanned out as if under the lifted wing cases, everything else transparent",
        },
        "motion": "Hidden on a hedge (never on a corridor): tapped, it lifts its wing cases, buzzes its wings and flies off.",
    },
    {
        "id": "snail",
        "priority": 3,
        "master": "One small friendly snail seen from directly above, a spiral shell in warm brown and cream with a soft green-grey body and two little eye stalks; readable at 30 px.",
        "parts": {
            "shell": "only the spiral shell, with a dark opening where the body enters it",
            "body": "only the soft body with the eye stalks, continued under the shell",
        },
        "motion": "Creeps a little along a hedge; tapped, it pulls into its shell and peeks out again.",
    },
    {
        "id": "frog",
        "priority": 3,
        "master": "One small green frog sitting, seen from directly above, big friendly eyes, legs tucked; readable at 30 px.",
        "parts": {},
        "extra": {"jump": "The SAME frog mid-hop seen from above: legs stretched out behind, front legs reaching forward. Same canvas; the body centre at the same point."},
        "motion": "Sits on a hedge and blinks; tapped, it hops to another spot.",
    },
]


# Delivered in full: masters, parts and extra poses (art/CLAUDE_HANDOFF_MOTION.md, 15 Oct 2026).
DELIVERED = {"butterfly", "coconut", "nut", "flower", "berries", "chest"}


def keep_delivery_records(out: str, jobs: list[dict]) -> list[dict]:
    """Keep what Codex wrote into existing jobs (delivery dates, QA, prompt files, a done status)."""
    if not os.path.exists(out):
        return jobs
    old = {j["id"]: j for j in json.load(open(out)).get("jobs", [])}
    merged = []
    for j in jobs:
        prev = old.get(j["id"], {})
        extra = {k: v for k, v in prev.items() if k not in j}
        status = "done" if prev.get("status") == "done" else j.get("status")
        merged.append({**j, **extra, **({"status": status} if status else {})})
    return merged


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
            "status": "done" if a["id"] in DELIVERED else "todo",
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
                "status": "done" if a["id"] in DELIVERED else "todo",
            })
        for name, what in a.get("extra", {}).items():
            jobs.append({
                "id": f"motion-{a['id']}-{name}",
                "output": f"{folder}/{name}.png",
                "edit": f"{folder}/master.png",
                "prompt": f"Edit image 1. {what} {STYLE}",
                "alpha": True,
                "priority": a["priority"],
                "status": "done" if a["id"] in DELIVERED else "todo",
            })
    jobs = keep_delivery_records(OUT, jobs)
    with open(OUT, "w") as fh:
        json.dump({"schemaVersion": 1, "request": "art/CODEX_REQUEST_MOTION.md", "jobs": jobs}, fh, indent=2, ensure_ascii=False)
    by = {}
    for j in jobs:
        by[j["priority"]] = by.get(j["priority"], 0) + 1
    print(f"wrote {len(jobs)} jobs to {os.path.relpath(OUT, ROOT)} (by priority: {dict(sorted(by.items()))})")


if __name__ == "__main__":
    main()
