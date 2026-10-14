"""Preserve native artwork, add requested transparent padding, measure and preview."""
from pathlib import Path
import hashlib
import json
import math
import shutil
from PIL import Image

HERE = Path(__file__).resolve().parent
ART = HERE.parents[1]
NATIVE = HERE / 'native'
NATIVE.mkdir(exist_ok=True)
delivery = json.loads((ART/'manifest.json').read_text()).get('treasuresV2', {})
approved = delivery.get('ownerApproved', False)
jobs = [j for j in json.loads((ART / 'prompts/jobs-treasures.json').read_text())['jobs'] if j['priority'] == 1 and j['id'].endswith('-master')]
inputs = []
for j in jobs:
    name = Path(j['output']).parent.name
    raw = NATIVE / (name + '.png')
    if not raw.exists():
        shutil.copy2(ART / j['output'], raw)
    im = Image.open(raw).convert('RGBA')
    bounds = im.getchannel('A').point(lambda a: 255 if a >= 40 else 0).getbbox()
    assert bounds
    inputs.append((j, raw, im, bounds))
records, cards = [], []
for j, raw, im, b in inputs:
    name = raw.stem
    side = math.ceil(max(max(im.size), max(b[2]-b[0], b[3]-b[1])/.7)/16)*16
    dx = max(0, min(side-im.width, round(side/2-(b[0]+b[2])/2)))
    dy = max(0, min(side-im.height, round(side/2-(b[1]+b[3])/2)))
    padded = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    padded.paste(im, (dx, dy))  # No mask, resampling or crop: copy RGBA pixels exactly.
    out = ART / j['output']
    if approved and out.exists():
        assert Image.open(out).convert('RGBA').tobytes() == padded.tobytes(), 'Approved master would change; stopping'
    else:
        padded.save(out)
    assert padded.crop((dx,dy,dx+im.width,dy+im.height)).tobytes() == im.tobytes()
    bounds = [b[0]+dx,b[1]+dy,b[2]+dx,b[3]+dy]
    r = dict(id=j['id'], path=j['output'], approvedCopy=j['approvedCopy'], kind=j['kind'],
             status='master-approved' if approved else 'awaiting-owner-approval', size=[side,side], mode='RGBA',
             alphaRange=list(padded.getchannel('A').getextrema()), boundsAlpha40=bounds,
             subjectExtentFraction=round(max(b[2]-b[0],b[3]-b[1])/side,4),
             sha256=hashlib.sha256(out.read_bytes()).hexdigest(), bytes=out.stat().st_size,
             nativePath=str(raw.relative_to(ART)), nativeSize=list(im.size),
             nativeSha256=hashlib.sha256(raw.read_bytes()).hexdigest(),
             paddingOffset=[dx,dy], transform='transparent padding only; original RGBA pixels unchanged',
             generator='built-in GPT Imagegen', promptFiles=[str(p.relative_to(ART)) for p in sorted((ART/'prompts/treasures-executed').glob(j['id']+'*.txt'))])
    r['promptHashes']={p:hashlib.sha256((ART/p).read_bytes()).hexdigest() for p in r['promptFiles']}
    records.append(r)
    url = '../../'+j['output']; label=j['names']['pl']
    cards.append(f'<article><h2>{label} <small>{"Skarb Giganto" if j["kind"]=="giganto" else "Skarb klasyczny"}</small></h2><div class="pair"><div class="cream"><img src="{url}" alt="{label} — kremowe tło"></div><div class="dark"><img src="{url}" alt="{label} — ciemne tło"></div></div><div class="small"><img src="{url}" alt="{label} — 80 px"><span class="silhouette" style="--asset:url({url})" role="img" aria-label="{label} — sylwetka 80 px"></span><p>80 px: kolor i sylwetka<br>{side} × {side} · <a href="{url}">PNG</a></p></div></article>')
(HERE/'master-measurements.json').write_text(json.dumps(dict(stage='master-approved' if approved else 'awaiting-owner-approval',masterCount=4,partsGenerated=delivery.get('partsGenerated',0),approvedCopiesMade=delivery.get('approvedCopiesMade',0),assets=records),indent=2)+'\n')
(HERE/'index.html').write_text('''<!doctype html><html lang="pl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Dino Mazes — cztery nowe skarby</title><style>
*{box-sizing:border-box}body{margin:0;background:#f3edde;color:#253d31;font:16px system-ui;padding:24px}main{max-width:1100px;margin:auto}h1{font-size:30px;margin:0 0 8px}header p{line-height:1.5}a{color:#315f49}section{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}article{border:1px solid #d4cfbd;border-radius:18px;overflow:hidden;background:#fffbef}h2{font-size:20px;margin:12px 16px}h2 small{font-size:12px;font-weight:400;margin-left:10px}.pair{display:flex}.pair>div{width:50%;aspect-ratio:1}.cream{background:#f7f0dc}.dark{background:#1c3a2b}.pair img{display:block;width:100%;height:100%;object-fit:contain}.small{display:flex;align-items:center;gap:12px;padding:8px 16px}.small img,.silhouette{width:80px;height:80px;flex-shrink:0}.silhouette{display:block;background:#294d38;mask-image:var(--asset);mask-size:contain;mask-repeat:no-repeat;mask-position:center}.small p{font-size:12px;line-height:1.6}@media(max-width:650px){section{grid-template-columns:1fr}}
</style><main><header><h1>Cztery nowe skarby do akceptacji</h1><p>GPT Imagegen · obrazy-matki na dwóch tłach · kontrola sylwetek przy 80 px.<br>Przezroczyste marginesy dodane bez przycinania i skalowania. Części powstaną po Twojej akceptacji.</p><p><a href="../../CLAUDE_HANDOFF_TREASURES.md">Dokumentacja</a> · <a href="master-measurements.json">Wymiary i kontrola plików</a></p></header><section>'''+''.join(cards)+'</section></main></html>')
if approved:
    index = HERE/'index.html'
    html = index.read_text().replace('Cztery nowe skarby do akceptacji','Cztery zatwierdzone skarby').replace('Części powstaną po Twojej akceptacji.','Obrazy-matki zatwierdzone 14 października 2026. <a href="parts.html">Otwórz części i podgląd ruchu.</a>')
    index.write_text(html)
print(json.dumps({'masterCount':len(records),'canvases':{r['id']:r['size'] for r in records},'partsGenerated':delivery.get('partsGenerated',0),'pixelPreservation':'passed'},indent=2))
