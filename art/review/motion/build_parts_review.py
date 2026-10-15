"""Bake measured affine registration and build art-only review outputs. No game code."""
from pathlib import Path
from PIL import Image,ImageDraw
import json,hashlib,math
HERE=Path(__file__).resolve().parent; ART=HERE.parents[1]
rig=json.loads((HERE/'registration.json').read_text()); tr=json.loads((ART/'review/treasures/registration.json').read_text())
# This historical builder only handles priority-1 rigs; preserve later registration entries.
assets={**{k:rig['assets'][k] for k in ('butterfly','coconut','nut','flower','berries','chest')},'strawberry':tr['assets']['strawberry']}; measurements=[]
S=360
sheet=Image.new('RGB',(S*4,len(assets)*(S+28)),'#203f35'); d=ImageDraw.Draw(sheet)
def affine(im,size,b,t):
 sx=(t[2]-t[0])/(b[2]-b[0]);sy=(t[3]-t[1])/(b[3]-b[1]);tx=t[0]-b[0]*sx;ty=t[1]-b[1]*sy
 out=im.convert('RGBa').transform(size,Image.Transform.AFFINE,(1/sx,0,-tx/sx,0,1/sy,-ty/sy),Image.Resampling.BICUBIC).convert('RGBA')
 return out,[sx,0,0,sy,tx,ty]
def scale_about(im,sx,sy,p,dy=0):
 x,y=p
 return im.convert('RGBa').transform(im.size,Image.Transform.AFFINE,(1/sx,0,x-x/sx,0,1/sy,y-(y+dy)/sy),Image.Resampling.BICUBIC).convert('RGBA')
def render(a,layers,t=0,mode='rest'):
 out=Image.new('RGBA',(S,S));phase=t*math.tau; v=math.sin(phase)
 for k,(p,src) in enumerate(layers):
  im=src.copy();n=p['name'];pivot=[v*S/assets[a]['canvas'][0] for v in p['pivot']];angle=0;sx=sy=1;dy=0
  if mode!='rest':
   if a=='butterfly' and n.startswith('wing'):sx=.2+.8*(.5+.5*math.cos(phase))
   if a=='coconut':angle=20*v if n=='body' else 10*math.sin(phase-.4) if n=='tuft' else 0
   if a=='nut' and n=='nut':dy=-.06*S*(.5-.5*math.cos(phase))
   if a=='flower' and n.startswith('petal'): 
    angle=5*math.sin(phase+k*.45);sx=sy=(.3+.7*(.5+.5*math.cos(phase))) if mode=='bloom' else 1
   if a=='berries' and n.startswith('berry'):sx=sy=1+.15*math.sin(phase+k*.9)
   if a=='chest' and n=='lid':angle=-15*(.5-.5*math.cos(phase))
   if a=='strawberry' and n=='cap':angle=6*v
  if sx!=1 or sy!=1 or dy:im=scale_about(im,sx,sy,pivot,dy)
  if angle:im=im.rotate(angle,Image.Resampling.BICUBIC,center=pivot)
  if p['opacity']!=1:im.putalpha(im.getchannel('A').point(lambda v:round(v*p['opacity'])))
  out.alpha_composite(im)
 return out
for row,(a,asset) in enumerate(assets.items()):
 size=tuple(asset['canvas']);family='treasures' if a=='strawberry' else 'motion';layers=[]
 for p in asset['parts']:
  raw=ART/'review'/family/'parts-native'/a/(p['name']+'.png');im=Image.open(raw).convert('RGBA')
  out,transform=affine(im,size,p['sourceBounds'],p['targetBounds']);p['nativeToCanvas']=transform
  dest=ART/'source/motion'/a/(p['name']+'.png');out.save(dest)
  alpha=out.getchannel('A');bbox=alpha.point(lambda v:255 if v>40 else 0).getbbox()
  assert alpha.getextrema()[0]==0 and bbox and bbox[0]>0 and bbox[1]>0 and bbox[2]<size[0] and bbox[3]<size[1],dest
  id=('treasure-' if a=='strawberry' else 'motion-')+a+'-'+p['name'];prompts=sorted((ART/'prompts/finish-executed').glob(id+'*.txt'))
  measurements.append(dict(id=id,path=str(dest.relative_to(ART)),size=size,mode='RGBA',alphaRange=alpha.getextrema(),boundsAlpha40=bbox,sha256=hashlib.sha256(dest.read_bytes()).hexdigest(),bytes=dest.stat().st_size,nativePath=str(raw.relative_to(ART)),nativeSize=im.size,nativeSha256=hashlib.sha256(raw.read_bytes()).hexdigest(),transform=transform,pivot=p['pivot'],opacity=p['opacity'],generator='built-in GPT Imagegen',promptFiles=[str(x.relative_to(ART)) for x in prompts],promptHashes={str(x.relative_to(ART)):hashlib.sha256(x.read_bytes()).hexdigest() for x in prompts}))
  layers.append((p,out.resize((S,S),Image.Resampling.LANCZOS)))
 master=Image.open(ART/'source/motion'/a/'master.png').convert('RGBA').resize((S,S),Image.Resampling.LANCZOS)
 rest=render(a,layers);rest.save(HERE/(a+'-assembled.png'))
 for col,im in enumerate([master,rest,master,rest]):
  bg=Image.new('RGBA',(S,S),'#fff3d4' if col<2 else '#203f35');bg.alpha_composite(im);sheet.paste(bg,(col*S,row*(S+28)))
  d.text((col*S+8,row*(S+28)+S+7),a+' '+('MASTER' if col%2==0 else 'LAYERS'),fill='white')
 for mode in (['stress','bloom'] if a=='flower' else ['stress']):
  frames=[]
  for f in range(32):
   im=render(a,layers,f/32,mode);bg=Image.new('RGBA',(S*2,S),'#fff3d4');green=Image.new('RGBA',(S,S),'#203f35');green.alpha_composite(im);bg.alpha_composite(im);bg.paste(green,(S,0));frames.append(bg.convert('RGB'))
  frames[0].save(HERE/f'{a}-{mode}.gif',save_all=True,append_images=frames[1:],duration=85,loop=0,disposal=2)
  snap=Image.new('RGB',(S*4,S*2),'#203f35')
  for j,t in enumerate([0,.25,.5,.75]):
   im=render(a,layers,t,mode)
   for k,color in enumerate(['#fff3d4','#203f35']):bg=Image.new('RGBA',(S,S),color);bg.alpha_composite(im);snap.paste(bg,(j*S,k*S))
  snap.save(HERE/f'{a}-{mode}.png')
sheet.save(HERE/'parts-comparison.png')
# Extra poses have their own registration; never include them in the rest draw stack.
for a,n,target in [('butterfly','perched',[515,375,1182,1191]),('chest','open',[245,185,1387,1293])]:
 raw=HERE/'parts-native'/a/(n+'.png');im=Image.open(raw).convert('RGBA');b=im.getchannel('A').point(lambda v:255 if v>40 else 0).getbbox();size=tuple(assets[a]['canvas']);out,m=affine(im,size,b,target);dest=ART/'source/motion'/a/(n+'.png');out.save(dest)
 rig['assets'][a]['poses']={n:dict(sourceBounds=b,targetBounds=target,nativeToCanvas=m)}
 prompt=ART/'prompts/finish-executed'/f'motion-{a}-{n}.txt'
 measurements.append(dict(id=f'motion-{a}-{n}',path=str(dest.relative_to(ART)),size=size,mode='RGBA',alphaRange=out.getchannel('A').getextrema(),sha256=hashlib.sha256(dest.read_bytes()).hexdigest(),bytes=dest.stat().st_size,nativePath=str(raw.relative_to(ART)),nativeSize=im.size,nativeSha256=hashlib.sha256(raw.read_bytes()).hexdigest(),transform=m,generator='built-in GPT Imagegen',promptFiles=[str(prompt.relative_to(ART))],promptHashes={str(prompt.relative_to(ART)):hashlib.sha256(prompt.read_bytes()).hexdigest()}))
(HERE/'registration.json').write_text(json.dumps(rig,indent=2)+'\n');tr['assets']['strawberry']=assets['strawberry'];(ART/'review/treasures/registration.json').write_text(json.dumps(tr,indent=2)+'\n')
(HERE/'parts-measurements.json').write_text(json.dumps({'count':len(measurements),'assets':measurements},indent=2)+'\n')
print('Registered',len(measurements),'generated assets; generated 8 stress GIFs and comparison sheet.')
