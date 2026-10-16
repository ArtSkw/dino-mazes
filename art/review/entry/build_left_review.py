"""Review-only compositing and measurement. Generated source pixels remain unchanged."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json,hashlib,math
import numpy as np
R=Path(__file__).resolve().parent;A=R.parents[1];W,H=1024,1536
# Guard the historical checkpoint against replacing the final combined registration.
if (R/'registration.json').exists() and json.loads((R/'registration.json').read_text()).get('stage') != 'left-curtain-awaiting-owner-approval':
 raise SystemExit('Historical approval checkpoint only. Rebuild the delivered set with build_entry_review.py instead.')
names=['back','mid','front-top','front-bottom'];ims=[Image.open(A/f'source/entry/curtain-left-{n}.png').convert('RGBA') for n in names]
def stack(images):
 s=Image.new('RGBA',(W,H))
 for im in images:s.alpha_composite(im)
 return s
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def bounds(im):return im.getchannel('A').point(lambda v:255 if v>=40 else 0).getbbox()
def transform(im,dx,angle):
 r=math.radians(angle);c=math.cos(r);s=math.sin(r);px,py=0,H/2
 # inverse rotation about left-edge midpoint plus horizontal translation
 return im.convert('RGBa').transform((W,H),Image.Transform.AFFINE,(c,s,px-c*(px+dx)-s*py,-s,c,py+s*(px+dx)-c*py),Image.Resampling.BICUBIC).convert('RGBA')
def onbg(im,color):
 out=Image.new('RGBA',im.size,color);out.alpha_composite(im);return out.convert('RGB')
assembled=stack(ims);assembled.save(R/'left-stacked.png');ref=Image.open(A/'source/intro-leaf-curtain-left.png').convert('RGBA')
font=ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc',28)
for color,label in [('#fff3d8','cream'),('#163d32','green')]:
 out=Image.new('RGB',(W*2,H+64),color);out.paste(onbg(ref,color),(0,64));out.paste(onbg(assembled,color),(W,64));d=ImageDraw.Draw(out);ink='#244537' if label=='cream' else '#fff3d8'
 d.text((24,18),'Obecna kurtyna — 1024 × 1536',font=font,fill=ink);d.text((W+24,18),'Nowa — 4 warstwy, 1024 × 1536',font=font,fill=ink);out.save(R/f'left-comparison-{label}.jpg',quality=95)
 onbg(assembled,color).save(R/f'left-stacked-{label}-1x.png')
 onbg(assembled,color).resize((2*W,2*H),Image.Resampling.LANCZOS).save(R/f'left-stacked-{label}-2x.jpg',quality=94)
# All layers at equal scale on cream and green.
sheet=Image.new('RGB',(W*2,H+64),'#fff3d8');d=ImageDraw.Draw(sheet)
for i,(name,im) in enumerate(zip(names,ims)):
 d.text((i*512+14,20),name,font=font,fill='#244537')
 for k,bg in enumerate(['#fff3d8','#163d32']):sheet.paste(onbg(im,bg).resize((512,768),Image.Resampling.LANCZOS),(i*512,64+k*768))
sheet.save(R/'left-layers.jpg',quality=95)
# Stress samples, not runtime animation. Compare raw canvas boundary with 48px overscan.
qa={'threshold':40,'testedTranslationPx':[-24,24],'testedRotationDegrees':[-1.5,1.5],'pivot':[0,768],'safeViewport':[48,48,1024,1488],'individualLayerExtremes':[]}
for i,name in enumerate(names):
 for dx in [-24,0,24]:
  for ang in [-1.5,0,1.5]:
   arr=ims.copy();arr[i]=transform(arr[i],dx,ang);a=np.asarray(stack(arr).getchannel('A'))
   qa['individualLayerExtremes'].append({'layer':name,'dx':dx,'angle':ang,'rawOuterEdgeUncoveredRows':int((a[:,0]<40).sum()),'safeOuterEdgeUncoveredRows':int((a[48:1488,48]<40).sum()),'safeCoreUncoveredPixels':int((a[48:1488,48:350]<40).sum())})
frames=[];samples=[]
for k in range(32):
 phase=2*math.pi*k/32;arr=[transform(im,24*math.sin(phase+i*.9),1.5*math.sin(phase+i*1.2)) for i,im in enumerate(ims)];s=stack(arr);a=np.asarray(s.getchannel('A'))
 samples.append({'sample':k,'rawOuterEdgeUncoveredRows':int((a[:,0]<40).sum()),'safeOuterEdgeUncoveredRows':int((a[48:1488,48]<40).sum()),'safeCoreUncoveredPixels':int((a[48:1488,48:350]<40).sum())})
 viewport=s.crop((48,48,1024,1488));f=Image.new('RGB',(650,480))
 for b,col in enumerate(['#fff3d8','#163d32']):f.paste(onbg(viewport,col).resize((325,480),Image.Resampling.LANCZOS),(b*325,0))
 frames.append(f)
frames[0].save(R/'left-stress.gif',save_all=True,append_images=frames[1:],duration=100,loop=0,disposal=2)
qa['animatedSamples']=samples
qa['safeViewportPass']=all(x['safeCoreUncoveredPixels']==0 for x in samples+qa['individualLayerExtremes'])
qa['rawCanvasPass']=all(x['rawOuterEdgeUncoveredRows']==0 for x in samples+qa['individualLayerExtremes'])
qa['restCoreUncoveredPixels']=int((np.asarray(assembled.getchannel('A'))[:,:350]<40).sum())
qa['frontOverlapBoundsY']=[bounds(ims[3])[1],bounds(ims[2])[3]];qa['frontOverlapHeightFraction']=(qa['frontOverlapBoundsY'][1]-qa['frontOverlapBoundsY'][0])/H
(R/'left-qa.json').write_text(json.dumps(qa,indent=2)+'\n')
# Registration uses the unmodified native canvases; stress inset is a runtime clip, not baked artwork.
reg={'schemaVersion':1,'stage':'left-curtain-awaiting-owner-approval','date':'2026-10-16','coordinateSystem':'Native PNG pixels; alpha bounds are half-open and use alpha >=40. Sources unmodified.','drawOrder':['curtain-left-'+n for n in names],'left':{'canvas':[W,H],'position':[0,0],'pivot':[0,768],'suggestedOverscanPx':48,'stressViewport':[48,48,1024,1488],'frontOverlapHeightFraction':qa['frontOverlapHeightFraction']},'assets':{},'remainingJobs':6}
for name,im in zip(names,ims):
 p=A/f'source/entry/curtain-left-{name}.png';a=np.asarray(im.getchannel('A'));edges={'left':a[:,0],'top':a[0,:],'right':a[:,-1],'bottom':a[-1,:]};prompts=sorted(str(p.relative_to(A)) for p in (A/'prompts/entry-executed').glob(f'entry-curtain-left-{name}*.txt'))
 reg['assets']['curtain-left-'+name]={'path':str(p.relative_to(A)),'canvas':list(im.size),'alphaBounds':list(bounds(im)),'alphaExtrema':list(im.getchannel('A').getextrema()),'outerEdgeContact':[n for n,x in edges.items() if (x>=40).any()],'edgeContactPixelCounts':{n:int((x>=40).sum()) for n,x in edges.items()},'position':[0,0],'scale':[1,1],'rotation':0,'pivot':[0,768],'sha256':sha(p),'bytes':p.stat().st_size,'generator':'built-in GPT Imagegen','approvalStatus':'pending','promptFiles':prompts,'promptHashes':{f:sha(A/f) for f in prompts}}
(R/'registration.json').write_text(json.dumps(reg,indent=2)+'\n')
html='''<!doctype html><html lang="pl"><meta charset="utf-8"><title>Dino Mazes — lewa kurtyna do akceptacji</title><style>body{margin:24px;background:#fff3d8;color:#183e31;font:17px system-ui}h1{max-width:1000px}img{display:block;max-width:100%;height:auto;margin:16px 0}a{color:#166849}.actual{overflow:auto;border:1px solid #b8b99a}.actual img{max-width:none}button{padding:10px 20px;margin:8px;border-radius:18px;border:1px solid #526746;background:#e5edbd;font:inherit}.pair{display:flex;gap:16px;align-items:flex-start}.pair img{width:48%}p{max-width:1050px}</style><h1>Lewa kurtyna — cztery warstwy do akceptacji</h1><p>Po lewej obecna grafika, po prawej złożenie back → mid → front-top → front-bottom. Obie mają identyczny rozmiar 1024 × 1536. Źródła zachowują natywne piksele i prawdziwą przezroczystość. Prawa kurtyna, backing i listki czekają na akceptację.</p><img src="left-comparison-cream.jpg" alt="Obecna i nowa kurtyna na kremowym tle"><img src="left-comparison-green.jpg" alt="To samo porównanie na ciemnozielonym tle"><h2>Warstwy oddzielnie</h2><img src="left-layers.jpg" alt="Cztery warstwy na dwóch tłach"><h2>Test ruchu</h2><p>±24 px, ±1,5°, obrót wokół środka lewej krawędzi. Podgląd wykorzystuje 48 px zapasu poza widocznym obszarem. Bez zapasu przesunięcie całej kurtyny odsłania krawędź płótna. To test warstw, nie gotowa animacja wejścia.</p><img src="left-stress.gif" alt="Test warstw na dwóch tłach"><h2>Kontrola w rozmiarze 1× / 2×</h2><p>2× to powiększenie kontrolne istniejących pikseli, nie dodatkowa rozdzielczość. Wyświetlanie CSS nie gwarantuje ostrości na fizycznym ekranie Retina.</p><button onclick="document.getElementById('detail').style.width='1024px'">1×</button><button onclick="document.getElementById('detail').style.width='2048px'">2×</button><div class="actual"><img id="detail" src="left-stacked-cream-1x.png" style="width:1024px" alt="Złożenie w skali 1 do 1 lub 2 do 1"></div><p><a href="registration.json">Rejestracja</a> · <a href="left-qa.json">Wyniki pomiarów</a></p></html>'''
(R/'left-approval.html').write_text(html)
print(json.dumps({k:v for k,v in qa.items() if k not in ['individualLayerExtremes','animatedSamples']},indent=2))
