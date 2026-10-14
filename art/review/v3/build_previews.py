"""Build requested review GIFs and metadata. Never modifies source artwork.

Run from any directory with Python + Pillow. --partial permits work-in-progress.
"""
from pathlib import Path
from PIL import Image
import hashlib, json, sys

HERE = Path(__file__).resolve().parent
ART = HERE.parents[1]
CHARACTERS = ['bill', 'tiny', 'mazu', 'rocky', 'giganto']
REACTIONS = {'idle': range(8), 'drawing': range(8,16), 'encouragement': range(16,24), 'celebration': range(24,32), 'talk': range(32,36)}
partial = '--partial' in sys.argv
records, missing, previews = [], [], []
for character in CHARACTERS:
    folder = ART / 'source' / f'character-{character}-v3'
    for reaction, numbers in REACTIONS.items():
        frames = []
        for n in numbers:
            path = folder / f'{reaction}-{n:02}.png'
            if not path.exists():
                missing.append(str(path.relative_to(ART)))
                continue
            with Image.open(path) as source:
                assert source.mode == 'RGBA' and source.size == (1254,1254), path
                alpha = source.getchannel('A')
                assert alpha.getextrema() == (0,255), path
                bounds = alpha.point(lambda x: 255 if x >= 40 else 0).getbbox()
                edges = {label: sum(v >= 40 for v in alpha.crop(box).getdata()) for label, box in {
                    'top': (0,0,1254,1), 'left': (0,0,1,1254), 'right': (1253,0,1254,1254), 'bottom': (0,1253,1254,1254)}.items()}
                record = {'character': character, 'reaction': reaction, 'index': n, 'path': str(path.relative_to(ART)), 'width':1254, 'height':1254, 'mode':'RGBA', 'alphaRange':[0,255], 'subjectBoundsAlpha40':bounds, 'edgePixelsAlpha40':edges, 'bytes':path.stat().st_size, 'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
                prompts = sorted((ART/'prompts/v3-executed').glob(f'{character}-{reaction}-{n:02}*.txt'), key=lambda p:p.stat().st_mtime)
                if n == 0:
                    prompts = [ART/'prompts/v3-executed'/f'{character}-master-framing.txt']
                record['promptFiles'] = [str(p.relative_to(ART)) for p in prompts]
                records.append(record)
                cream = Image.new('RGBA', source.size, (245,239,222,255))
                cream.alpha_composite(source)
                frames.append(cream.convert('RGB').resize((420,420),Image.Resampling.LANCZOS))
        if len(frames) == len(numbers):
            gif = HERE / f'{character}-{reaction}.gif'
            frames[0].save(gif, save_all=True, append_images=frames[1:], duration=100, loop=0, optimize=False)
            with Image.open(gif) as check:
                assert check.n_frames == len(numbers), gif
            previews.append(gif.name)

report = {'schemaVersion':1, 'sourceFrameCount':len(records), 'expectedFrameCount':180, 'missing':missing, 'previewCount':len(previews), 'previewFrameDurationMs':100, 'frames':records, 'scope':'Metadata and alpha-edge checks only; head/eye registration and final runtime animation QA are separate.'}
(HERE/'animation-measurements.json').write_text(json.dumps(report,indent=2)+'\n')
data = json.dumps({'characters':CHARACTERS,'reactions':{k:list(v) for k,v in REACTIONS.items()},'available':[r['path'] for r in records], 'previews':previews})
html = '''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Dino Mazes · V3 character animation review</title>
<style>*{box-sizing:border-box}body{margin:0;background:#f5efde;color:#233d30;font:16px/1.5 system-ui}header,main{max-width:1300px;margin:auto;padding:24px}h1{margin:0;font-size:30px}p{max-width:950px}nav, .controls{display:flex;gap:12px;flex-wrap:wrap;align-items:center}a{color:#28644a}select,button{font:inherit;padding:9px 14px;border:1px solid #a4b3a0;border-radius:10px;background:#fff;color:inherit}label{display:inline-flex;gap:8px;align-items:center}.stage{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin:20px 0}.canvas{position:relative;aspect-ratio:1;background:#f5efde;border:1px solid #bbc5b5;border-radius:16px;overflow:hidden}.dark{background:#153b2e}.canvas img{width:100%;height:100%;object-fit:contain;position:absolute;inset:0}.ghost{opacity:0;pointer-events:none}.overlay .ghost{opacity:.5}.canvas span{position:absolute;left:10px;top:8px;padding:2px 6px;background:#f5efde;border-radius:5px;font-size:12px}.frames{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:6px}.frames button{padding:0;background:#153b2e;border:2px solid transparent;overflow:hidden}.frames button.active{border-color:#df9d24}.frames img{width:100%;display:block}.frames small{display:block;background:#f5efde;font-size:11px}.gifs{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px}.gifs img{width:100%;display:block;border-radius:12px;border:1px solid #cbd3c2}.gifs figure{margin:0}.gifs figcaption{font-size:13px}.note{background:#e4eadb;padding:12px 16px;border-radius:12px}footer{padding:30px} @media(max-width:700px){.gifs{grid-template-columns:repeat(2,1fr)}.frames{grid-template-columns:repeat(4,1fr)}header,main{padding:16px}}</style>
<header><h1>Dino Mazes · Character animations V3</h1><p id="summary"></p><nav><a href="../../CLAUDE_HANDOFF_V3.md">Claude handoff</a><a href="../../manifest.json">Asset manifest</a><a href="animation-measurements.json">Measurements</a></nav><p class="note">Source-frame review. The player uses the original transparent PNGs at 10 fps. GIFs below are cream-background previews. Packing, anchor registration and final in-game checks belong to the integration pass.</p></header>
<main><div class="controls"><label>Character <select id="character"></select></label><label>Reaction <select id="reaction"></select></label><button id="play">Pause</button><button id="prev">Previous frame</button><button id="next">Next frame</button><label><input type="checkbox" id="overlay">50% master overlay</label><strong id="frameLabel"></strong></div>
<div class="stage"><div class="canvas"><img id="light" alt="Selected animation on cream"><img class="ghost" alt="Neutral master overlay"><span>Cream</span></div><div class="canvas dark"><img id="dark" alt="Selected animation on dark green"><img class="ghost" alt="Neutral master overlay"><span>Dark green</span></div></div><div class="frames" id="frames"></div><h2>Reaction loops · 10 fps</h2><div id="gallery"></div></main>
<script>const DATA=__DATA__;const $=s=>document.querySelector(s);let character='bill',reaction='idle',index=0,playing=true,list=[],cache=[];const url=(c,r,n)=>'../../source/character-'+c+'-v3/'+r+'-'+String(n).padStart(2,'0')+'.png';$('#summary').textContent=DATA.available.length+' of 180 frames available · 5 characters · 1254 × 1254 RGBA · '+DATA.previews.length+' reaction GIFs';for(const c of DATA.characters)$('#character').add(new Option(c[0].toUpperCase()+c.slice(1),c));for(const r of Object.keys(DATA.reactions))$('#reaction').add(new Option(r,r));function render(){if(!list.length){$('#frameLabel').textContent='Frames pending';return}const n=list[index];for(const id of ['light','dark'])$('#'+id).src=url(character,reaction,n);$('#frameLabel').textContent=reaction+'-'+String(n).padStart(2,'0');document.querySelectorAll('.frames button').forEach((e,i)=>e.classList.toggle('active',i===index));}function choose(){character=$('#character').value;reaction=$('#reaction').value;list=DATA.reactions[reaction].filter(n=>DATA.available.includes('source/character-'+character+'-v3/'+reaction+'-'+String(n).padStart(2,'0')+'.png'));index=0;$('#frames').replaceChildren();cache=list.map((n,i)=>{const im=new Image();im.src=url(character,reaction,n);const b=document.createElement('button');b.setAttribute('aria-label','Frame '+n);b.innerHTML='<img src="'+im.src+'" alt="'+reaction+' '+n+'"><small>'+reaction+'-'+String(n).padStart(2,'0')+'</small>';b.onclick=()=>{playing=false;$('#play').textContent='Play';index=i;render()};$('#frames').append(b);return im});document.querySelectorAll('.ghost').forEach(e=>e.src='../../source/character-'+character+'-v3/master.png');render()}$('#character').onchange=choose;$('#reaction').onchange=choose;$('#play').onclick=()=>{playing=!playing;$('#play').textContent=playing?'Pause':'Play'};for(const [id,delta] of [['prev',-1],['next',1]])$('#'+id).onclick=()=>{playing=false;$('#play').textContent='Play';index=(index+delta+list.length)%list.length;render()};$('#overlay').onchange=()=>document.querySelectorAll('.canvas').forEach(e=>e.classList.toggle('overlay',$('#overlay').checked));setInterval(()=>{if(playing&&list.length){index=(index+1)%list.length;render()}},100);for(const r of Object.keys(DATA.reactions)){const h=document.createElement('h3');h.textContent=r;$('#gallery').append(h);const row=document.createElement('div');row.className='gifs';for(const c of DATA.characters){if(!DATA.previews.includes(c+'-'+r+'.gif'))continue;const f=document.createElement('figure');f.innerHTML='<img loading="lazy" src="'+c+'-'+r+'.gif" alt="'+c+' '+r+' loop"><figcaption>'+c+' · '+DATA.reactions[r].length+' frames</figcaption>';row.append(f)}$('#gallery').append(row)}choose();</script></html>'''.replace('__DATA__',data)
(HERE/'index.html').write_text(html)
(HERE/'animations.html').write_text(html)
print(json.dumps({'frames':len(records),'previews':len(previews),'missing':missing,'sideOrTopEdgeContact':[r['path'] for r in records if any(r['edgePixelsAlpha40'][k] for k in ['top','left','right'])]},indent=2))
if missing and not partial:
    raise SystemExit('Incomplete source set; see measurements. Manifest not updated.')
