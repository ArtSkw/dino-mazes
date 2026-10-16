"""Final source registration + review-only composites; never modifies source PNGs."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont,ImageOps
import numpy as np
import json,hashlib,math
R=Path(__file__).resolve().parent;A=R.parents[1];W,H=1024,1536
names=['back','mid','front-top','front-bottom'];font=ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc',23)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def bounds(im):return im.getchannel('A').point(lambda v:255 if v>=40 else 0).getbbox()
def stack(ims):
 out=Image.new('RGBA',(W,H))
 for im in ims:out.alpha_composite(im)
 return out
def onbg(im,color):
 out=Image.new('RGBA',im.size,color);out.alpha_composite(im);return out.convert('RGB')
def trans(im,dx,angle,side):
 t=math.radians(angle);c=math.cos(t);s=math.sin(t);px=0 if side=='left' else W;py=H/2
 return im.convert('RGBa').transform((W,H),Image.Transform.AFFINE,(c,s,px-c*(px+dx)-s*py,-s,c,py+s*(px+dx)-c*py),Image.Resampling.BICUBIC).convert('RGBA')
reg=json.loads((R/'registration.json').read_text());reg.update(stage='source-set-complete',remainingJobs=0,completedDate='2026-10-16');reg['drawOrder']=['curtain-'+side+'-'+n for side in ['left','right'] for n in names]
qa={'date':'2026-10-16','alphaThreshold':40,'sides':{}};allims={};stacked={}
for side in ['left','right']:
 ims=[Image.open(A/f'source/entry/curtain-{side}-{n}.png').convert('RGBA') for n in names];allims[side]=ims;assembled=stack(ims);stacked[side]=assembled;assembled.save(R/f'{side}-stacked.png')
 pivot=[0 if side=='left' else W,H/2];vp=[48,48,W,1488] if side=='left' else [0,48,W-48,1488]
 topb=bounds(ims[2]);botb=bounds(ims[3]);overlap=(topb[3]-botb[1])/H
 reg[side]={'canvas':[W,H],'position':[0,0],'pivot':pivot,'suggestedOverscanPx':48,'stressViewport':vp,'frontOverlapBoundsY':[botb[1],topb[3]],'frontOverlapHeightFraction':overlap,'ownerApproved':side=='left'}
 if side=='left':reg[side]['approvalDate']='2026-10-16'
 for n,im in zip(names,ims):
  p=A/f'source/entry/curtain-{side}-{n}.png';a=np.array(im.getchannel('A'));edges={'left':a[:,0],'top':a[0,:],'right':a[:,-1],'bottom':a[-1,:]};prompts=sorted(str(p.relative_to(A)) for p in (A/'prompts/entry-executed').glob(f'entry-curtain-{side}-{n}*.txt'))
  reg['assets'][f'curtain-{side}-{n}']={'path':str(p.relative_to(A)),'canvas':list(im.size),'alphaBounds':list(bounds(im)),'alphaExtrema':list(im.getchannel('A').getextrema()),'outerEdgeContact':[k for k,v in edges.items() if (v>=40).any()],'edgeContactPixelCounts':{k:int((v>=40).sum()) for k,v in edges.items()},'position':[0,0],'scale':[1,1],'rotation':0,'pivot':pivot,'sha256':sha(p),'bytes':p.stat().st_size,'generator':'built-in GPT Imagegen','approvalStatus':'approved' if side=='left' else 'source-qa-complete','promptFiles':prompts,'promptHashes':{f:sha(A/f) for f in prompts}}
  if side=='left':reg['assets'][f'curtain-{side}-{n}']['ownerApprovalDate']='2026-10-16'
 # Same-size reference comparison and individual layer strips.
 ref=Image.open(A/f'source/intro-leaf-curtain-{side}.png').convert('RGBA')
 for color,label in [('#fff3d8','cream'),('#163d32','green')]:
  out=Image.new('RGB',(2048,1600),color);out.paste(onbg(ref,color),(0,64));out.paste(onbg(assembled,color),(1024,64));d=ImageDraw.Draw(out);ink='#214b36' if label=='cream' else '#fff3d8';d.text((24,18),'Original / 1024 x 1536',font=font,fill=ink);d.text((1048,18),'New four layers / 1024 x 1536',font=font,fill=ink);out.save(R/f'{side}-final-comparison-{label}.jpg',quality=95)
 strip=Image.new('RGB',(2048,1600),'#fff3d8');d=ImageDraw.Draw(strip)
 for i,(n,im) in enumerate(zip(names,ims)):
  d.text((i*512+16,18),n,font=font,fill='#214b36')
  for k,bg in enumerate(['#fff3d8','#163d32']):strip.paste(onbg(im,bg).resize((512,768),Image.Resampling.LANCZOS),(i*512,64+k*768))
 strip.save(R/f'{side}-final-layers.jpg',quality=95)
 def metrics(s):
  a=np.array(s.getchannel('A'));core=a[48:1488,48:350] if side=='left' else a[48:1488,674:976];edge=a[:,0] if side=='left' else a[:,-1]
  return {'rawOuterEdgeUncoveredRows':int((edge<40).sum()),'safeCoreUncoveredPixels':int((core<40).sum())}
 tests=[]
 for i,n in enumerate(names):
  for dx in [-24,0,24]:
   for angle in [-1.5,0,1.5]:
    arr=ims.copy();arr[i]=trans(arr[i],dx,angle,side);tests.append({'layer':n,'dx':dx,'angle':angle,**metrics(stack(arr))})
 frames=[];samples=[]
 for k in range(32):
  t=2*math.pi*k/32;s=stack([trans(im,24*math.sin(t+i*.9),1.5*math.sin(t+i*1.2),side) for i,im in enumerate(ims)]);samples.append({'sample':k,**metrics(s)});s=s.crop(vp);f=Image.new('RGB',(650,480))
  for b,col in enumerate(['#fff3d8','#163d32']):f.paste(onbg(s,col).resize((325,480),Image.Resampling.LANCZOS),(325*b,0))
  frames.append(f)
 frames[0].save(R/f'{side}-final-stress.gif',save_all=True,append_images=frames[1:],duration=100,loop=0,disposal=2)
 a=np.array(assembled.getchannel('A'));core=a[:,:350] if side=='left' else a[:,674:]
 qa['sides'][side]={'translationPx':[-24,24],'rotationDegrees':[-1.5,1.5],'pivot':pivot,'safeViewport':vp,'individualExtremes':tests,'samples':samples,'safeViewportPass':all(v['safeCoreUncoveredPixels']==0 for v in tests+samples),'rawCanvasPass':all(v['rawOuterEdgeUncoveredRows']==0 for v in tests+samples),'restCoreUncoveredPixels':int((core<40).sum()),'frontOverlapFraction':overlap}
# Original opaque backing used behind each side at native 1x and paired native canvas.
bg=Image.open(A/'source/entry/backing.png').convert('RGB')
for side in ['left','right']:
 out=ImageOps.fit(bg,(W,H),Image.Resampling.LANCZOS).convert('RGBA');out.alpha_composite(stacked[side]);out.convert('RGB').save(R/f'{side}-on-backing-1x.jpg',quality=95);out.convert('RGB').resize((W*2,H*2),Image.Resampling.LANCZOS).save(R/f'{side}-on-backing-2x.jpg',quality=95)
pair=ImageOps.fit(bg,(W*2,H),Image.Resampling.LANCZOS).convert('RGBA');pair.alpha_composite(stacked['left'],(0,0));pair.alpha_composite(stacked['right'],(W,0));pair.convert('RGB').save(R/'pair-on-backing-1x.jpg',quality=95);pair.convert('RGB').resize((W*4,H*2),Image.Resampling.LANCZOS).save(R/'pair-on-backing-2x.jpg',quality=95)
# Paired breathing/parallax preview with the measured overscan; no gameplay implementation.
frames=[]
for k in range(32):
 out=ImageOps.fit(bg,(976*2,1440),Image.Resampling.LANCZOS).convert('RGBA');t=2*math.pi*k/32
 for side,x in [('left',0),('right',976)]:
  ims=allims[side];s=stack([trans(im,24*math.sin(t+i*.9),1.5*math.sin(t+i*1.2),side) for i,im in enumerate(ims)]).crop(reg[side]['stressViewport']);out.alpha_composite(s,(x,0))
 frames.append(out.convert('RGB').resize((976,720),Image.Resampling.LANCZOS))
frames[0].save(R/'pair-motion.gif',save_all=True,append_images=frames[1:],duration=100,loop=0,disposal=2)
# Six half-open cells on native sheet; measure subject bounds without deleting trace alpha.
im=Image.open(A/'source/entry/leaves.png').convert('RGBA');a=np.array(im.getchannel('A'));leafnames=['monstera','heart','fern','banana','curled-round','two-leaf-sprig'];cells=[];thumbs=[]
for i,name in enumerate(leafnames):
 c=i%3;r=i//3;box=[c*512,r*512,(c+1)*512,(r+1)*512];crop=im.crop(box);b=bounds(crop);edge=np.concatenate([np.array(crop.getchannel('A'))[0,:],np.array(crop.getchannel('A'))[-1,:],np.array(crop.getchannel('A'))[:,0],np.array(crop.getchannel('A'))[:,-1]])
 cells.append({'index':i,'name':name,'rect':box,'alphaBounds':[b[0]+box[0],b[1]+box[1],b[2]+box[0],b[3]+box[1]],'cellEdgeMaxAlpha':int(edge.max()),'visibleBoundsInsideCell':b[0]>0 and b[1]>0 and b[2]<512 and b[3]<512,'pivot':[(b[0]+b[2])/2,(b[1]+b[3])/2],'pivotSpace':'cell-local'})
 subject=crop.crop(b);s=40/max(subject.size);thumb=subject.resize((max(1,round(subject.width*s)),max(1,round(subject.height*s))),Image.Resampling.LANCZOS);thumbs.append(thumb)
# Static inspection at actual 40px, plus edge-on 10% width on both backgrounds.
check=Image.new('RGB',(960,400),'#fff3d8');d=ImageDraw.Draw(check)
for row,col in enumerate(['#fff3d8','#163d32']):
 d.rectangle((0,row*200,960,(row+1)*200),fill=col);ink='#244537' if row==0 else '#fff3d8'
 for i,(n,thumb) in enumerate(zip(leafnames,thumbs)):
  d.text((i*160+8,row*200+10),n,font=font,fill=ink);d.text((i*160+8,row*200+50),'40 px',fill=ink);check.paste(onbg(thumb,col),(i*160+32,row*200+76));flip=thumb.resize((max(1,round(thumb.width*.1)),thumb.height),Image.Resampling.LANCZOS);check.paste(onbg(flip,col),(i*160+110,row*200+76));d.text((i*160+88,row*200+130),'10% width',fill=ink)
check.save(R/'leaves-40px.png')
frames=[]
for k in range(32):
 f=Image.new('RGB',(480,160),'#fff3d8');d=ImageDraw.Draw(f);d.rectangle((0,80,480,160),fill='#163d32')
 for row,col in enumerate(['#fff3d8','#163d32']):
  for i,th in enumerate(thumbs):
   factor=.1+.9*abs(math.cos(2*math.pi*k/32+i*.4));t=th.resize((max(1,round(th.width*factor)),th.height),Image.Resampling.LANCZOS);f.paste(onbg(t,col),(i*80+(80-t.width)//2,row*80+(80-t.height)//2))
 frames.append(f)
frames[0].save(R/'leaves-flip.gif',save_all=True,append_images=frames[1:],duration=100,loop=0,disposal=2)
for key in ['backing','leaves']:
 p=A/f'source/entry/{key}.png';im=Image.open(p);prompts=sorted(str(p.relative_to(A)) for p in (A/'prompts/entry-executed').glob(f'entry-{key}*.txt'));v={'path':str(p.relative_to(A)),'canvas':list(im.size),'mode':im.mode,'hasAlpha':im.mode=='RGBA','sha256':sha(p),'bytes':p.stat().st_size,'generator':'built-in GPT Imagegen','promptFiles':prompts,'promptHashes':{f:sha(A/f) for f in prompts},'status':'source-qa-complete'}
 if key=='leaves':v.update(alphaBounds=list(bounds(im)),alphaExtrema=list(im.getchannel('A').getextrema()),cells=cells,cellConvention='half-open rectangles, row-major; trace alpha <=1 at some cell boundaries retained from native output')
 reg['assets'][key]=v
qa['leaves']={'count':6,'cells':cells,'allCellsUnclipped':all(c['visibleBoundsInsideCell'] for c in cells),'edgeAlphaMaximum':max(c['cellEdgeMaxAlpha'] for c in cells),'testSizes':{'maxDimension':40,'horizontalFlipMinimum':.1}};qa['backing']={'mode':bg.mode,'opaque':True,'size':list(bg.size)}
(R/'registration.json').write_text(json.dumps(reg,ensure_ascii=False,indent=2)+'\n');(R/'entry-qa.json').write_text(json.dumps(qa,ensure_ascii=False,indent=2)+'\n')
html='''<!doctype html><html lang="pl"><meta charset="utf-8"><title>Dino Mazes — entry: komplet</title><style>body{margin:24px;background:#fff3d8;color:#183e31;font:17px system-ui}img{display:block;max-width:100%;height:auto;margin:16px 0}a{color:#166849}.actual{overflow:auto;border:1px solid #b8b99a}.actual img{max-width:none}button{padding:10px 20px;margin:8px;border-radius:18px;border:1px solid #526746;background:#e5edbd;font:inherit}p{max-width:1050px}</style><h1>Wejście do dżungli — komplet 10 grafik</h1><p>Osiem osobnych warstw kurtyn, spokojne tło i sześć listków na jednym arkuszu. Lewa strona zatwierdzona przez właściciela; prawa namalowana osobno. Grafiki źródłowe zachowują natywne piksele.</p><img src="pair-on-backing-1x.jpg" alt="Obie kurtyny na nowym tle"><h2>Ruch warstw</h2><p>Podgląd testowy ±24 px i ±1,5°, z 48 px zapasu poza widoczną krawędzią. Nie jest gotową animacją gry.</p><img src="pair-motion.gif" alt="Wspólny test ruchu"><h2>Warstwy prawej kurtyny</h2><img src="right-final-layers.jpg" alt="Cztery warstwy na dwóch tłach"><h2>Prawa: oryginał i nowy komplet w tym samym rozmiarze</h2><img src="right-final-comparison-cream.jpg" alt="Porównanie prawej kurtyny"><h2>Listki w skali gry</h2><img src="leaves-40px.png" alt="Sześć listków przy 40 px oraz 10 procentach szerokości"><img src="leaves-flip.gif" alt="Obrót listków"><h2>Kontrola 1× / 2×</h2><p>Każda kurtyna w parze ma natywne 1024 × 1536. Powiększenie 2× pokazuje istniejące piksele; nie dodaje rozdzielczości. Docelowy ekran Retina sprawdzi Claude po wdrożeniu.</p><button onclick="document.getElementById('detail').style.width='2048px'">1×</button><button onclick="document.getElementById('detail').style.width='4096px'">2×</button><div class="actual"><img id="detail" src="pair-on-backing-1x.jpg" style="width:2048px" alt="Obie kurtyny w skali 1 do 1 lub 2 do 1"></div><p><a href="registration.json">Rejestracja i komórki arkusza</a> · <a href="entry-qa.json">Wyniki QA</a> · <a href="../../CLAUDE_HANDOFF_ENTRY.md">Handoff</a></p></html>'''
(R/'index.html').write_text(html)
print(json.dumps({'sides':{k:{x:v[x] for x in ['safeViewportPass','rawCanvasPass','restCoreUncoveredPixels','frontOverlapFraction']} for k,v in qa['sides'].items()},'leaves':qa['leaves']},indent=2))
