#!/usr/bin/env python3
"""
Writes art/prompts/jobs-treasures.json: the GPT Imagegen jobs for the four new
treasures in art/CODEX_REQUEST_TREASURES.md (owner request, 14 Oct 2026:
seven classic treasures found with the friends, three only with Giganto).
Run: python3 tools/art/make_treasure_jobs.py

Same method as the motion request (tools/art/make_motion_jobs.py): one
assembled master per treasure first (it is also the game's runtime image),
then, after the owner approves the master, its parts as edits of the master.
"""
from __future__ import annotations

import json
import os

from make_motion_jobs import CANVAS, PART_RULES, STYLE

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "art", "prompts", "jobs-treasures.json")

KIT = (
    "It joins the existing treasure set (coconut, hazelnut, coral hibiscus flower, turquoise pebble, peach spiral shell, "
    "blueberry bunch) and must look like part of the same painted kit: same outline weight, softness, light and scale of detail. "
    "Its silhouette must read clearly at 80 px and differ from every existing treasure, because unfound treasures are shown "
    "as a flat silhouette in the collection."
)

TREASURES: list[dict] = [
    {
        "id": "feather",
        "kind": "classic",
        "names": {"pl": "Piórko", "en": "Feather"},
        "lore": "Miłka/Tiny paints with it when her brush falls apart; Czupur/Rocky wants to fly with it.",
        "master": "One soft, gently curved bird feather lying diagonally (quill at the lower left, tip at the upper right): a golden-yellow vane that warms to orange and a soft coral tip, a few playful separated barbs near the quill, a cream quill.",
        "parts": {
            "quill": "only the cream quill (shaft), continued slightly where the vane covered it",
            "vane-left": "only the vane on the left/upper side of the quill, its root continued slightly under the quill",
            "vane-right": "only the vane on the right/lower side of the quill, its root continued slightly under the quill",
        },
        "motion": "Floats down and lands with a little flutter; in the collection it sways and its barbs ruffle.",
    },
    {
        "id": "amber",
        "kind": "giganto",
        "names": {"pl": "Bursztyn", "en": "Amber"},
        "lore": "One of Giganto's own treasures: a tiny fern leaf sleeps inside.",
        "master": "One chunk of glowing golden amber shaped like a soft rounded TEARDROP with a few smooth broad facets (not a round pebble): translucent honey colour with warm light shining through, a tiny curled green fern leaf clearly visible inside, a bright soft highlight on the upper left. It should feel precious and a little magical.",
        "parts": {
            "body": "the amber WITHOUT its highlight and WITHOUT the leaf: evenly painted translucent honey where they were",
            "leaf": "ONLY the tiny fern leaf inside, as it appears through the amber, everything else transparent",
            "glint": "ONLY the bright highlight as a separate soft translucent white-cream shape, everything else transparent",
        },
        "motion": "Warm light pulses slowly inside; the glint slides across; the leaf seems to sway a hair.",
    },
    {
        "id": "gigaflower",
        "kind": "giganto",
        "names": {"pl": "Gigakwiat", "en": "Giga flower"},
        "lore": "The rare Giga Flower of the series, blooming only once in a long while. Giganto's own.",
        "master": "The rare jungle Giga Flower: one big star-shaped bloom with SIX wide pointed petals in violet and deep purple with lilac edges, a glowing golden centre with a few soft pollen sparkles, a short thick green stem and two broad leaves. It must look clearly different from the small coral five-petal hibiscus treasure: bigger, pointier, purple, glowing.",
        "parts": {
            "center": "only the glowing golden centre",
            **{f"petal-{i}": f"only petal {i} counting clockwise from the top petal; continue its base under the centre" for i in range(1, 7)},
            "stem": "only the stem; continue its top under the flower head",
            "leaf-left": "only the left leaf; continue its base into the stem",
            "leaf-right": "only the right leaf; continue its base into the stem",
        },
        "motion": "Opens from a bud with a staggered petal bloom and a puff of glowing pollen; breathes slowly.",
    },
    {
        "id": "crystal",
        "kind": "giganto",
        "names": {"pl": "Kryształ", "en": "Crystal"},
        "lore": "Something sparkles in Giganto's cave. Giganto's own.",
        "master": "A small cluster of four clear crystals growing from a rounded grey stone base: two tall and two short pointed prisms, pale ice blue shading to soft lavender, crisp facets with bright painted glints. Precious and cave-born, friendly and rounded rather than sharp or threatening.",
        "parts": {
            "base": "only the grey stone base, continued under the crystals",
            "crystal-1": "only the tallest crystal, its foot continued slightly into the base",
            "crystal-2": "only the second tallest crystal, its foot continued slightly into the base",
            "crystal-3": "only the two short crystals together, their feet continued slightly into the base",
            "glint": "ONLY the bright glints and sparkles as separate translucent white shapes, everything else transparent",
        },
        "motion": "Glints run up the facets one after another; on find a star flares at the tip.",
    },
]

EMBLEM = {
    "id": "giganto-emblem",
    "master": "A small round painted badge for 'Giganto's treasures': Giganto's big three-toed footprint pressed into warm golden sand inside a rounded honey-wood ring with soft gold trim. No text.",
}


def main() -> None:
    jobs = []
    for t in TREASURES:
        folder = f"source/motion/{t['id']}"
        jobs.append({
            "id": f"treasure-{t['id']}-master",
            "output": f"{folder}/master.png",
            "approvedCopy": f"source/treasures-v2/{t['id']}.png",
            "prompt": f"{t['master']} {KIT} {CANVAS} {STYLE}",
            "refs": ["source/treasure-kit-v1.png", "source/motion/coconut/master.png", "source/motion/flower/master.png"],
            "alpha": True,
            "priority": 1,
            "kind": t["kind"],
            "names": t["names"],
            "lore": t["lore"],
            "motion": t["motion"],
        })
    for t in TREASURES:
        folder = f"source/motion/{t['id']}"
        for name, what in t["parts"].items():
            jobs.append({
                "id": f"treasure-{t['id']}-{name}",
                "output": f"{folder}/{name}.png",
                "edit": f"{folder}/master.png",
                "prompt": f"{PART_RULES}The part to keep: {what}. {STYLE}",
                "alpha": True,
                "priority": 2,
            })
    jobs.append({
        "id": f"ui-{EMBLEM['id']}",
        "output": f"source/ui/{EMBLEM['id']}.png",
        "prompt": f"{EMBLEM['master']} Square 1024x1024 canvas, the badge centred and filling about 80%. {STYLE}",
        "refs": ["source/ui-surfaces-v1.png"],
        "alpha": True,
        "priority": 3,
    })
    with open(OUT, "w") as fh:
        json.dump({"schemaVersion": 1, "request": "art/CODEX_REQUEST_TREASURES.md", "jobs": jobs}, fh, indent=1, ensure_ascii=False)
    by: dict = {}
    for j in jobs:
        by[j["priority"]] = by.get(j["priority"], 0) + 1
    print(f"wrote {len(jobs)} jobs to {os.path.relpath(OUT, ROOT)} (by priority: {dict(sorted(by.items()))})")


if __name__ == "__main__":
    main()
