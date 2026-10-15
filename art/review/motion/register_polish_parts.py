"""Register only Polish P2/P3 assets; preserve all earlier rigs. No generated artwork is painted here."""
from pathlib import Path
from PIL import Image, ImageDraw
import json, math, hashlib
HERE=Path(__file__).resolve().parent; ART=HERE.parents[1]
pads={r['asset']:r for r in json.loads((HERE/'polish-padded-masters.json').read_text())}
reg=json.loads((HERE/'registration.json').read_text())
rawroot=HERE/'polish-parts-native'
def bounds(im):return im.getchannel('A').point(lambda v:255 if v>40 else 0).getbbox()
def shifted(a,b):
 o=pads[a]['offset'];return [b[0]+o[0],b[1]+o[1],b[2]+o[0],b[3]+o[1]]
def point(a,p):return [p[0]+pads[a]['offset'][0],p[1]+pads[a]['offset'][1]]
def fit(im,size,b,t):
 sx=(t[2]-t[0])/(b[2]-b[0]);sy=(t[3]-t[1])/(b[3]-b[1]);tx=t[0]-b[0]*sx;ty=t[1]-b[1]*sy
 out=im.convert('RGBa').transform(size,Image.Transform.AFFINE,(1/sx,0,-tx/sx,0,1/sy,-ty/sy),Image.Resampling.BICUBIC).convert('RGBA')
 return out,[sx,0,0,sy,tx,ty]
spec={
'stone':[('body',[173,247,1079,1027],[626,637],1),('glint',[400,400,540,550],[470,475],.7)],
'shell':[('body',[158,169,1127,1119],[643,644],1),('glint',[430,580,660,810],[545,695],.4)],
'banana-plant':[('base',[440,830,790,1120],[635,1090],1),('leaves-back',[90,123,1200,1120],[635,1090],1),('leaves-front',[88,530,1225,1148],[635,1090],1)],
'fern':[('base',[440,975,850,1180],[640,1130],1),('leaves-back',[142,102,1173,1140],[640,1130],1),('leaves-front',[142,615,1173,1193],[640,1130],1)],
'monstera':[('base',[440,750,820,1110],[620,1080],1),('leaves-back',[122,134,1162,1110],[620,1080],1),('leaves-front',[122,470,1162,1110],[620,1080],1)],
'ladybug':[('body',[178,215,1075,1018],[627,620],1),('wings',[110,420,1140,900],[627,435],.7),('shell-left',[315,445,635,980],[612,460],1),('shell-right',[620,445,940,980],[642,460],1)],
'snail':[('body',[67,282,1234,993],[865,610],1),('shell',[170,290,1030,993],[865,610],1)]
}
mastermeasure=json.loads((HERE/'polish-master-measurements.json').read_text())
boxes=next(r for r in mastermeasure['sources'] if r['id']=='motion-confetti-master')['sixCellBounds']
spec['confetti']=[(f'piece-{i+1}',b,[(b[0]+b[2])/2,(b[1]+b[3])/2],1) for i,b in enumerate(boxes)]
measurements=[]
for a,parts in spec.items():
 size=tuple(pads[a]['canvas']);asset={'canvas':list(size),'parts':[],'ownerApproved':True,'approvalDate':'2026-10-15'}
 for n,t,p,opacity in parts:
  raw=rawroot/a/(n+'.png');im=Image.open(raw).convert('RGBA');b=bounds(im);target=shifted(a,t);out,m=fit(im,size,b,target)
  dest=ART/'source/motion'/a/(n+'.png');out.save(dest)
  layer=dict(name=n,sourceBounds=list(b),targetBounds=target,pivot=point(a,p),opacity=opacity,nativeToCanvas=m)
  if a=='ladybug' and n=='wings':layer['restVisible']=False;layer['note']='Show only during flight; supplied unfolded wings are hidden in the rest stack.'
  if a=='confetti':layer['note']='Independent particle. Crop by targetBounds and subtract trim offset from pivot; do not draw the entire sheet as one particle.'
  asset['parts'].append(layer)
  measurements.append(dict(id=f'motion-{a}-{n}',path=str(dest.relative_to(ART)),size=list(size),nativePath=str(raw.relative_to(ART)),nativeSize=list(im.size),sourceBounds=list(b),targetBounds=target,transform=m,pivot=layer['pivot'],opacity=opacity))
 reg['assets'][a]=asset
# Whole alternate poses, registered by a fixed landmark, not as additional layers.
def fingertip(im):
 a=im.getchannel('A'); b=bounds(im); pts=[]
 for y in range(b[1],b[1]+5):
  for x in range(b[0],b[2]):
   if a.getpixel((x,y))>128:pts.append(x)
 return [sum(pts)/len(pts),b[1]]
for a,n in [('pointer','press'),('frog','jump')]:
 master=Image.open(ART/f'source/motion/{a}/master.png').convert('RGBA')
 raw=rawroot/a/(n+'.png'); im=Image.open(raw).convert('RGBA');b=bounds(im)
 if a=='pointer':
  landmark='fingertip';pm=fingertip(master);ps=fingertip(im)
  mb=bounds(master);s=(mb[2]-mb[0])/(b[2]-b[0])
 else:
  landmark='bodyCentre';pm=point(a,[627,580]);ps=[627,663];s=.95
 tx=pm[0]-s*ps[0];ty=pm[1]-s*ps[1];m=[s,0,0,s,tx,ty];size=tuple(pads[a]['canvas'])
 out=im.convert('RGBa').transform(size,Image.Transform.AFFINE,(1/s,0,-tx/s,0,1/s,-ty/s),Image.Resampling.BICUBIC).convert('RGBA')
 dest=ART/f'source/motion/{a}/{n}.png';out.save(dest)
 pose={'sourceBounds':list(b),'targetBounds':list(bounds(out)),'nativeToCanvas':m,landmark:pm,'nativeLandmark':ps,'landmarkRegistrationErrorPx':math.hypot(s*ps[0]+tx-pm[0],s*ps[1]+ty-pm[1])}
 reg['assets'][a]={'canvas':list(size),'parts':[],'poses':{n:pose},'masterLandmarks':{landmark:pm},'ownerApproved':True,'note':'Whole-pose replacement; do not stack master and pose.'}
 measurements.append(dict(id=f'motion-{a}-{n}',path=str(dest.relative_to(ART)),size=list(size),nativePath=str(raw.relative_to(ART)),nativeSize=list(im.size),sourceBounds=list(b),targetBounds=pose['targetBounds'],transform=m,landmarks=pose))
for r in measurements:
 p=ART/r['path'];raw=ART/r['nativePath'];im=Image.open(p);b=bounds(im)
 assert b and b[0]>0 and b[1]>0 and b[2]<im.width and b[3]<im.height,r['id']
 r.update(sha256=hashlib.sha256(p.read_bytes()).hexdigest(),bytes=p.stat().st_size,nativeSha256=hashlib.sha256(raw.read_bytes()).hexdigest(),hasAlpha=True,alphaExtrema=list(im.getchannel('A').getextrema()),boundsAlpha40=list(b),generator='built-in GPT Imagegen')
 prompts=sorted((ART/'prompts/polish-executed').glob(r['id']+'*.txt'))
 r['promptFiles']=[str(p.relative_to(ART)) for p in prompts];r['promptHashes']={str(p.relative_to(ART)):hashlib.sha256(p.read_bytes()).hexdigest() for p in prompts}
(HERE/'registration.json').write_text(json.dumps(reg,indent=2)+'\n')
(HERE/'polish-parts-measurements.json').write_text(json.dumps({'count':len(measurements),'assets':measurements},indent=2)+'\n')
print('Registered',len(measurements),'PNGs across',len(pads),'assets.')

