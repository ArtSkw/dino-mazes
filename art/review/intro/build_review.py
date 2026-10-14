"""Measure intro sources and assemble review GIFs/HTML, never modify sources."""
from pathlib import Path
from PIL import Image
import json, hashlib

HERE=Path(__file__).resolve().parent
ART=HERE.parents[1]
jobs=json.loads((ART/'prompts/jobs-intro-prepared.json').read_text())['jobs']
records=[]
for job in jobs:
    path=ART/job['output']
    if not path.exists(): continue
    im=Image.open(path)
    assert im.mode=='RGBA', path
    w,h=im.size
    a=im.getchannel('A'); hist=a.histogram()
    assert hist[0]>0 and sum(hist[1:])>0, path
    name=job['id']
    grid=[2,2] if 'friend-popup' in name else [3,2] if name=='intro-giganto-peek' else [4,1] if name=='intro-sprout' else [3,1] if name=='intro-dust-puff' else [1,1]
    rects=[]
    for y in range(grid[1]):
        for x in range(grid[0]):
            rects.append([round(x*w/grid[0]),round(y*h/grid[1]),round((x+1)*w/grid[0]),round((y+1)*h/grid[1])])
    override=HERE/'cell-rects.json'
    if override.exists(): rects=json.loads(override.read_text()).get(name,rects)
    cells=[]; frames=[]
    for i,rect in enumerate(rects):
        cell=im.crop(rect); ca=cell.getchannel('A'); solid=ca.point(lambda v:255 if v>=40 else 0)
        bounds=solid.getbbox()
        edges={key:sum(v>=40 for v in ca.crop(box).getdata()) for key,box in [('left',(0,0,1,cell.height)),('right',(cell.width-1,0,cell.width,cell.height)),('top',(0,0,cell.width,1)),('bottom',(0,cell.height-1,cell.width,cell.height))]}
        cells.append({'index':i,'rect':rect,'boundsAlpha40':bounds,'edgePixelsAlpha40':edges})
        if len(rects)>1:
            target=cell.copy(); target.thumbnail((420,420),Image.Resampling.LANCZOS)
            bg=Image.new('RGBA',(420,420),'#f4eddd');bg.alpha_composite(target,((420-target.width)//2,(420-target.height)//2));frames.append(bg.convert('RGB'))
    if frames:
        frames[0].save(HERE/(name+'.gif'),save_all=True,append_images=frames[1:],duration=180,loop=0,optimize=False,disposal=2)
        assert Image.open(HERE/(name+'.gif')).n_frames==len(frames)
    if 'friend-popup' in name:
        first=cells[0]['boundsAlpha40']
        for c in cells:
            b=c['boundsAlpha40']
            c['suggestedTranslationToFirstBush']=[round((first[0]+first[2]-b[0]-b[2])/2),first[3]-b[3]]
            c['registrationNote']='Approximate bush-bounds translation only; does not correct leaf-detail differences. Preview remains raw.'
    prompt_files=[job['promptFile']]+[str(p.relative_to(ART)) for p in sorted((ART/'prompts/intro-prepared').glob(name+'-*-revision.txt'))]
    records.append({'id':name,'path':job['output'],'requestedSize':job['size'],'size':[w,h],'mode':im.mode,'alphaRange':a.getextrema(),'alphaZeroFraction':hist[0]/(w*h),'alphaTranslucentFraction':sum(hist[1:240])/(w*h),'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'grid':grid,'frameCount':len(rects),'cells':cells,'promptFiles':prompt_files,'gif':name+'.gif' if frames else None})
report={'assetCount':len(records),'sheetCount':sum(r['frameCount']>1 for r in records),'animationCellCount':sum(r['frameCount'] for r in records if r['frameCount']>1),'assets':records}
(HERE/'measurements.json').write_text(json.dumps(report,indent=2)+'\n')
html='''<!doctype html><html lang="en"><meta charset="utf-8"><title>Dino Mazes · Intro source review</title><style>body{font:16px system-ui;margin:24px;background:#f4eddd;color:#243e32}h1{margin-bottom:8px}button,select{font:inherit;padding:10px;border:1px solid #abb7aa;border-radius:8px;margin:8px} .pair{display:grid;grid-template-columns:1fr 1fr;gap:16px} .panel{height:460px;display:flex;align-items:center;justify-content:center;border:1px solid #bbc6b6;border-radius:14px;overflow:hidden;position:relative} .panel img{max-width:100%;max-height:100%;object-fit:contain}.dark{background:#183e30}.panel small{position:absolute;top:8px;left:8px;background:#f4eddd;color:#243e32;padding:4px} .cells{display:flex;gap:12px;flex-wrap:wrap;margin:20px 0}.cell{width:180px;height:180px;overflow:hidden;position:relative;background:#183e30;border:1px solid #879987}.cell img{position:absolute;max-width:none} .gallery{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}.gallery img{width:100%;background:#183e30} .note{max-width:950px} canvas{height:100%;max-width:100%;object-fit:contain}</style>
<h1>Dino Mazes · Opening intro source review</h1><p id="summary"></p><p class="note">Original alpha PNGs on cream and dark green. Sheet playback uses measured extraction rectangles. Generative foliage/detail differences remain visible; Claude must stabilize the bush and register frames during integration. This page is an art review, not the game intro.</p><a href="../../INTRO_ASSET_HANDOFF.md">Claude handoff</a> · <a href="measurements.json">Measurements</a><br><label>Asset <select id="asset"></select></label><button id="mode">Play cells</button><button id="next">Next cell</button><span id="label"></span><div class="pair"><div class="panel"><small>Cream</small><canvas id="light"></canvas></div><div class="panel dark"><small>Dark green</small><canvas id="dark"></canvas></div></div><div id="cells" class="cells"></div><h2>All source assets</h2><div id="gallery" class="gallery"></div><script>
const data=DATA; const assets=data.assets; const select=document.querySelector('#asset');const canvases=[document.querySelector('#light'),document.querySelector('#dark')];let current=0,frame=0,playing=false;const images=assets.map(r=>{const i=new Image();i.src='../../'+r.path;i.onload=()=>draw();return i;});
document.querySelector('#summary').textContent=`${data.assetCount} PNG assets · ${data.sheetCount} animation sheets · ${data.animationCellCount} cells`;
assets.forEach((r,i)=>{select.add(new Option(r.id,i));const e=document.createElement('div');e.innerHTML=`<img src="../../${r.path}" alt="${r.id}"><p>${r.id}<br>${r.size.join(' × ')} · ${r.frameCount} cell(s)</p>`;document.querySelector('#gallery').append(e)});
function draw(){const r=assets[current],im=images[current];if(!im.complete||!im.naturalWidth)return;let rect=playing?r.cells[frame].rect:[0,0,...r.size];for(const c of canvases){c.width=rect[2]-rect[0];c.height=rect[3]-rect[1];c.getContext('2d').drawImage(im,rect[0],rect[1],c.width,c.height,0,0,c.width,c.height)}document.querySelector('#label').textContent=playing?`Cell ${frame+1}/${r.frameCount}`:`${r.size.join(' × ')} RGBA`;}
function change(){frame=0;playing=false;document.querySelector('#mode').textContent='Play cells';const r=assets[current];const cells=document.querySelector('#cells');cells.innerHTML='';if(r.frameCount>1)r.cells.forEach((c,i)=>{const el=document.createElement('button');el.className='cell';el.setAttribute('aria-label',`Cell ${i+1}`);const rect=c.rect,s=180/Math.max(rect[2]-rect[0],rect[3]-rect[1]);el.innerHTML=`<img alt="Cell ${i+1}" src="../../${r.path}" style="width:${r.size[0]*s}px;height:${r.size[1]*s}px;left:${-rect[0]*s}px;top:${-rect[1]*s}px">`;el.onclick=()=>{frame=i;playing=true;draw();playing=false;};cells.append(el)});draw();}
select.onchange=()=>{current=+select.value;change()};document.querySelector('#mode').onclick=()=>{playing=!playing;document.querySelector('#mode').textContent=playing?'Show sheet':'Play cells';draw()};document.querySelector('#next').onclick=()=>{frame=(frame+1)%assets[current].frameCount;const saved=playing;playing=true;draw();playing=saved};setInterval(()=>{if(playing){frame=(frame+1)%assets[current].frameCount;draw()}},180);change();
</script></html>'''.replace('DATA',json.dumps(report))
(HERE/'index.html').write_text(html)
print(json.dumps({k:v for k,v in report.items() if k!='assets'}))
print(json.dumps({r['id']:[c['index'] for c in r['cells'] if any(c['edgePixelsAlpha40'].values())] for r in records},indent=2))
