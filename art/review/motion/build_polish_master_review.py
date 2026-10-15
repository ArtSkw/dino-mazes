"""Read-only source QA and approval previews. Does not pad or change source artwork."""
import json, hashlib, html
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ART=Path(__file__).resolve().parents[2]
OUT=ART/'review/motion'
NAMES=['stone','shell','confetti','banana-plant','fern','monstera','pointer','ladybug','snail','frog']
LABELS=['Kamień','Muszla','Konfetti','Bananowiec','Paproć','Monstera','Dłoń','Biedronka','Ślimak','Żaba']
FONT='/System/Library/Fonts/Supplemental/Arial.ttf'
font=ImageFont.truetype(FONT,22)
small=ImageFont.truetype(FONT,16)
records=[]
sprites=[]
def bbox(im): return im.getchannel('A').point(lambda x:255 if x>40 else 0).getbbox()
def thumb(im,size):
    im=im.copy(); im.thumbnail(size,Image.Resampling.LANCZOS); return im
for name in NAMES:
    rel=f'source/motion/{name}/master.png'; p=ART/rel
    im=Image.open(p).convert('RGBA'); a=im.getchannel('A'); b=bbox(im)
    hist=a.histogram(); w,h=im.size
    edge=a.crop((0,0,w,1)).getextrema()[1]+a.crop((0,h-1,w,h)).getextrema()[1]+a.crop((0,0,1,h)).getextrema()[1]+a.crop((w-1,0,w,h)).getextrema()[1]
    r={'id':f'motion-{name}-master','source':rel,'size':[w,h],'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size,'alphaExtrema':list(a.getextrema()),'transparentPixelFraction':hist[0]/(w*h),'alpha40Bounds':list(b),'edgeAlphaSum':edge,'occupancyMaxDimension':max((b[2]-b[0])/w,(b[3]-b[1])/h),'approvalStatus':'pending','paddingStatus':'pending owner approval','generator':'built-in GPT Imagegen'}
    r['promptFiles']=[f'prompts/polish-executed/motion-{name}-master.txt']
    if name=='confetti': r['promptFiles'] += ['prompts/polish-executed/motion-confetti-master-spacing.txt','prompts/polish-executed/motion-confetti-master-spacing-final.txt']
    r['promptHashes']={s:hashlib.sha256((ART/s).read_bytes()).hexdigest() for s in r['promptFiles']}
    r['edgeNote']='Trace alpha 1/255 at canvas edges; original preserved, no visible silhouette clipping.' if edge else 'Fully transparent canvas edges.'
    assert a.getextrema()==(0,255) and b[0]>0 and b[1]>0 and b[2]<w and b[3]<h, (name,'alpha/clipping')
    records.append(r); sprites.append(im)

# Review-only cells for the six confetti pieces; never delivered as animation parts.
confetti=sprites[2]; w,h=confetti.size; boxes=[]; pieces=[]
for row in range(2):
    for col in range(3):
        x0=col*w//3; y0=row*h//2
        cell=confetti.crop((x0,y0,(col+1)*w//3,(row+1)*h//2)); b=bbox(cell)
        assert b
        boxes.append([x0+b[0],y0+b[1],x0+b[2],y0+b[3]])
        pieces.append(cell.crop(b))
gaps=[boxes[r*3+c+1][0]-boxes[r*3+c][2] for r in range(2) for c in range(2)]
records[2]['sixCellBounds']=boxes
records[2]['horizontalGapsPixels']=gaps
records[2]['minimumGapFraction']=min(gaps)/w
assert min(gaps)>=w*.25, gaps

for bg,key in [('#fff3d8','cream'),('#163d32','green')]:
    board=Image.new('RGBA',(1500,720),bg); d=ImageDraw.Draw(board)
    for i,(label,im) in enumerate(zip(LABELS,sprites)):
        x=(i%5)*300; y=(i//5)*360
        t=thumb(im,(282,282)); board.alpha_composite(t,(x+(300-t.width)//2,y+20+(282-t.height)//2))
        d.text((x+15,y+315),label,font=font,fill='#2b4435' if key=='cream' else '#fff3d8')
    board.convert('RGB').save(OUT/f'polish-masters-{key}.png')

board=Image.new('RGBA',(1000,400),'#fff3d8'); d=ImageDraw.Draw(board)
for row,bg in enumerate(['#fff3d8','#163d32']):
    y=row*200; d.rectangle((0,y,1000,y+200),fill=bg); color='#2b4435' if row==0 else '#fff3d8'
    d.text((20,y+15),'Rzeczywisty rozmiar: zwierzęta 30 px, dłoń 60 px, konfetti 24 px',font=small,fill=color)
    for i,idx in enumerate([7,8,9,6]):
        im=sprites[idx]; t=thumb(im.crop(bbox(im)),(60,60) if idx==6 else (30,30))
        board.alpha_composite(t,(25+i*130,y+60)); d.text((20+i*130,y+135),LABELS[idx],font=small,fill=color)
    for i,piece in enumerate(pieces):
        t=thumb(piece,(24,24)); board.alpha_composite(t,(565+i*65,y+65))
        squeezed=t.resize((max(1,round(t.width*.1)),t.height),Image.Resampling.LANCZOS)
        board.alpha_composite(squeezed,(565+i*65,y+110))
    d.text((550,y+155),'Konfetti: 100% / 10% szerokości',font=small,fill=color)
board.convert('RGB').save(OUT/'polish-small-scale.png')
(OUT/'polish-master-measurements.json').write_text(json.dumps({'stage':'awaiting-owner-approval','sources':records,'remainingPartsAndPoses':27,'stressTests':'Deferred until parts exist and owner approves masters.'},ensure_ascii=False,indent=2)+'\n')
cards=''.join(f'<article><h2>{html.escape(label)}</h2><div class="pic"><img src="../../source/motion/{name}/master.png"></div><a href="../../source/motion/{name}/master.png">PNG 1254 × 1254</a></article>' for name,label in zip(NAMES,LABELS))
(OUT/'polish-masters.html').write_text('<!doctype html><meta charset="utf-8"><title>Dino Mazes — 10 obrazów-matek</title><style>body{font:18px system-ui;background:#fff3d8;color:#234437;margin:32px}button{padding:12px 20px;font:inherit}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:20px}article{border:1px solid #aaa;border-radius:16px;padding:14px}.pic{background:var(--bg,#fff3d8);border-radius:12px}.pic img{display:block;width:100%}a{color:#286751}h2{font-size:20px}#small{max-width:100%}</style><h1>10 obrazów-matek do zatwierdzenia</h1><p>Priorytet 2 → 3. Części, pozy i testy ruchu dopiero po akceptacji. Oryginały bez zmiany pikseli; marginesy zostaną wyrównane po zatwierdzeniu.</p><button onclick="document.documentElement.style.setProperty(\'--bg\',\'#fff3d8\')">Kremowe tło</button> <button onclick="document.documentElement.style.setProperty(\'--bg\',\'#163d32\')">Ciemnozielone tło</button><main>'+cards+'</main><h2>Czytelność w małej skali</h2><img id="small" src="polish-small-scale.png"><p>Ściśnięcie konfetti to podgląd kontrolny obrazów-matek, nie gotowe części.</p>')
print(json.dumps({'masters':len(records),'sizes':[r['size'] for r in records],'confettiGaps':gaps,'minimumGapFraction':min(gaps)/w,'alphaChecks':'pass'},indent=2))
