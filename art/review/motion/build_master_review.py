"""Measure original masters and build a source-only approval gallery."""
from pathlib import Path
import hashlib
import html
import json
from PIL import Image

HERE = Path(__file__).resolve().parent
ART = HERE.parents[1]
jobs = json.loads((ART / 'prompts/jobs-motion.json').read_text())['jobs']
jobs = [j for j in jobs if j['priority'] == 1 and j['id'].endswith('-master')]
labels = dict(butterfly='Motyl', coconut='Kokos', nut='Orzech', flower='Kwiat', berries='Jagody', chest='Skrzynia')
records = []
cards = []
for job in jobs:
    path = ART / job['output']
    if not path.exists():
        continue
    name = path.parent.name
    with Image.open(path) as im:
        alpha = im.getchannel('A')
        bounds = alpha.point(lambda v: 255 if v >= 40 else 0).getbbox()
        assert alpha.getextrema()[0] == 0
        assert bounds and bounds[0] > 0 and bounds[1] > 0 and bounds[2] < im.width and bounds[3] < im.height
        record = dict(id=job['id'], path=job['output'], size=list(im.size), mode=im.mode,
                      alphaRange=list(alpha.getextrema()), boundsAlpha40=list(bounds),
                      bytes=path.stat().st_size, sha256=hashlib.sha256(path.read_bytes()).hexdigest(),
                      status='awaiting-owner-approval', generator='built-in GPT Imagegen',
                      promptFiles=[str(p.relative_to(ART)) for p in sorted((ART / 'prompts/motion-executed').glob(job['id']+'*.txt'))])
        records.append(record)
    url = '../../' + job['output']
    cards.append(f'<article><h2>{labels[name]}</h2><div class="pair"><div class="cream"><img src="{url}" alt="{labels[name]} — kremowe tło"></div><div class="dark"><img src="{url}" alt="{labels[name]} — ciemne tło"></div></div><p>{record["size"][0]} × {record["size"][1]} · RGBA · <a href="{url}">Oryginalny PNG</a></p></article>')
(HERE / 'master-measurements.json').write_text(json.dumps(dict(stage='awaiting-owner-approval', masterCount=len(records), expectedMasterCount=6, partsGenerated=0, assets=records), indent=2)+'\n')
(HERE / 'index.html').write_text('''<!doctype html><html lang="pl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Dino Mazes — obrazy-matki do akceptacji</title><style>
*{box-sizing:border-box}body{margin:0;background:#f3edde;color:#253d31;font:16px system-ui;padding:24px}main{max-width:1500px;margin:auto}h1{font-size:30px;margin:0 0 8px}header p{max-width:950px;line-height:1.5}a{color:#315f49}section{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}article{border:1px solid #d4cfbd;border-radius:18px;overflow:hidden;background:#fffbef}h2{font-size:20px;margin:14px 16px}.pair{display:flex}.pair>div{width:50%;aspect-ratio:1;display:flex;align-items:center}.cream{background:#f7f0dc}.dark{background:#1c3a2b}img{display:block;width:100%;height:100%;object-fit:contain}article p{font-size:12px;margin:12px 16px}@media(max-width:900px){section{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:560px){section{grid-template-columns:1fr}}
</style><main><header><h1>Sześć obrazów-matek do akceptacji</h1><p>Priorytet 1 · GPT Imagegen · oryginalne PNG na kremowym i ciemnozielonym tle. Części i animacje czekają na Twoją akceptację. Zgodnie z promptami: orzech ma zieloną okrywę, a kiść zawiera pięć jagód.</p><p><a href="../../CLAUDE_HANDOFF_MOTION.md">Notatka przekazania</a> · <a href="master-measurements.json">Wymiary i kontrola plików</a></p></header><section>'''+''.join(cards)+'</section></main></html>')
print(f'Measured {len(records)}/6 masters; no parts generated.')
