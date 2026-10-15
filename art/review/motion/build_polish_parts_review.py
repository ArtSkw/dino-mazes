"""Art-only motion QA; reads registered PNGs and never edits their artwork."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageChops
import json,math,hashlib
HERE=Path(__file__).resolve().parent;ART=HERE.parents[1]
NAMES=['stone','shell','confetti','banana-plant','fern','monstera','pointer','ladybug','snail','frog']
reg=json.loads((HERE/'registration.json').read_text())['assets']; S=320
def bounds(im):return im.getchannel('A').point(lambda v:255 if v>40 else 0).getbbox()
def affine(im,sx=1,sy=1,p=(0,0),dx=0,dy=0):
 x,y=p
 return im.convert('RGBa').transform(im.size,Image.Transform.AFFINE,(1/sx,0,x-(x+dx)/sx,0,1/sy,y-(y+dy)/sy),Image.Resampling.BICUBIC).convert('RGBA')
def alpha(im,v=40):return im.getchannel('A').point(lambda x:255 if x>v else 0)
def count(mask):return mask.histogram()[255]
def load(a,n,resize=True):
 im=Image.open(ART/f'source/motion/{a}/{n}.png').convert('RGBA')
 return im.resize((S,S),Image.Resampling.LANCZOS) if resize else im
def render(a,t=0,mode='stress'):
 A=reg[a];factor=S/A['canvas'][0];phase=math.tau*t;v=math.sin(phase);q=(1-math.cos(phase))/2
 if a in ['pointer','frog']:
  return load(a,('press' if a=='pointer' else 'jump') if q>.5 and mode!='rest' else 'master'),[]
 out=Image.new('RGBA',(S,S));layers=[]
 for i,part in enumerate(A['parts']):
  n=part['name'];im=load(a,n);p=[x*factor for x in part['pivot']];angle=0;sx=sy=1;dx=dy=0;op=part['opacity']
  if a=='ladybug' and n=='wings':
   if mode=='rest':continue
   op*=q
  if mode!='rest':
   if a in ['stone','shell'] and n=='glint':
    width=(A['parts'][0]['targetBounds'][2]-A['parts'][0]['targetBounds'][0])*factor
    dx=.06*width*v;dy=.06*width*math.cos(phase);sx=sy=1.3
   if a=='confetti':sx=.1+.9*abs(math.cos(phase+i*.35))
   if a in ['banana-plant','fern','monstera'] and n.startswith('leaves'):
    angle=6*math.sin(phase+(0 if n.endswith('back') else math.pi))
   if a=='ladybug' and n.startswith('shell'):angle=(-60 if n.endswith('left') else 60)*q
   if a=='snail' and n=='body':sx=sy=1-.75*q
  if sx!=1 or sy!=1 or dx or dy:im=affine(im,sx,sy,p,dx,dy)
  if angle:im=im.rotate(angle,Image.Resampling.BICUBIC,center=p)
  if op!=1:im.putalpha(im.getchannel('A').point(lambda x:round(x*op)))
  out.alpha_composite(im);layers.append((part,im))
 return out,layers
qa={'samplesPerLoop':40,'backgrounds':['#fff3d8','#163d32'],'assets':{}}
comparison=Image.new('RGB',(S*4,(S+25)*10),'#163d32');d=ImageDraw.Draw(comparison)
for row,a in enumerate(NAMES):
 master=load(a,'master');rest,_=render(a,mode='rest')
 for col,im in enumerate([master,rest,master,rest]):
  bg=Image.new('RGBA',(S,S),'#fff3d8' if col<2 else '#163d32');bg.alpha_composite(im);comparison.paste(bg,(col*S,row*(S+25)))
  d.text((col*S+8,row*(S+25)+S+5),a+(' MASTER' if col%2==0 else ' ASSEMBLED'),fill='white')
 frames=[];snapshot=Image.new('RGB',(S*4,S*2));rootOverlap=[];clipped=[]
 for f in range(40):
  im,layers=render(a,f/40);bg=Image.new('RGBA',(S*2,S),'#fff3d8');green=Image.new('RGBA',(S,S),'#163d32');bg.alpha_composite(im);green.alpha_composite(im);bg.paste(green,(S,0));frames.append(bg.convert('RGB'))
  b=bounds(im)
  if b and (b[0]==0 or b[1]==0 or b[2]==S or b[3]==S):clipped.append(f)
  if a in ['banana-plant','fern','monstera']:
   p=reg[a]['parts'][0]['pivot'];factor=S/reg[a]['canvas'][0];x,y=[round(z*factor) for z in p];box=(x-15,y-15,x+15,y+15)
   base=alpha(layers[0][1])
   rootOverlap.append([count(ImageChops.multiply(base,alpha(im2)).crop(box)) for _,im2 in layers[1:]])
  if f in [0,10,20,30]:
   for k,color in enumerate(['#fff3d8','#163d32']):
    frame=Image.new('RGBA',(S,S),color);frame.alpha_composite(im);snapshot.paste(frame,(f//10*S,k*S))
 gif=HERE/f'polish-{a}-stress.gif'
 frames[0].save(gif,save_all=True,append_images=frames[1:],duration=90,loop=0,disposal=2)
 snapshot.save(HERE/f'polish-{a}-stress.png')
 qa['assets'][a]={'gif':str(gif.relative_to(ART)),'frames':Image.open(gif).n_frames,'sha256':hashlib.sha256(gif.read_bytes()).hexdigest(),'clippedSampleIndices':clipped}
 if rootOverlap:qa['assets'][a]['minimumRootOverlapPixelsAt320']=[min(x[i] for x in rootOverlap) for i in range(2)]
comparison.save(HERE/'polish-parts-comparison.png')
# Native-resolution glint containment, including diagonal extremes at 130% scale.
for a in ['stone','shell']:
 A=reg[a];body=load(a,'body',False);glint=load(a,'glint',False);p=A['parts'][1]['pivot'];w=A['parts'][0]['targetBounds'][2]-A['parts'][0]['targetBounds'][0];ratios=[]
 for dx in [-.06*w,0,.06*w]:
  for dy in [-.06*w,0,.06*w]:
   g=alpha(affine(glint,1.3,1.3,p,dx,dy),10)
   outside=ImageChops.subtract(g,alpha(body,128));ratios.append(count(outside)/max(1,count(g)))
 qa['assets'][a]['glintMaxOutsideFractionAlpha10']=max(ratios)
 qa['assets'][a]['glintTest']='9 extreme positions at +/-6% object width on both axes, scale130%; alpha>10 against body alpha>128'
# Fixed landmarks are mathematically pinned before rasterization; verify rounded fingertip too.
for a,n,key in [('pointer','press','fingertip'),('frog','jump','bodyCentre')]:
 pose=reg[a]['poses'][n];qa['assets'][a]['landmarkRegistrationErrorPx']=pose['landmarkRegistrationErrorPx'];qa['assets'][a]['landmark']=pose[key]
# Review-only overlay; whole poses are not intended to be stacked in-game.
overlay=Image.new('RGBA',(S*4,S),'#fff3d8');od=ImageDraw.Draw(overlay)
for row,a in enumerate(['pointer','frog']):
 m=load(a,'master');p=load(a,'press' if a=='pointer' else 'jump');p.putalpha(p.getchannel('A').point(lambda v:round(v*.5)));m.putalpha(m.getchannel('A').point(lambda v:round(v*.5)))
 for k,color in enumerate(['#fff3d8','#163d32']):
  cell=Image.new('RGBA',(S,S),color);cell.alpha_composite(m);cell.alpha_composite(p);point=next(iter(reg[a]['masterLandmarks'].values()));x,y=[v*S/reg[a]['canvas'][0] for v in point];draw=ImageDraw.Draw(cell);draw.line((x-8,y,x+8,y),fill='magenta',width=1);draw.line((x,y-8,x,y+8),fill='magenta',width=1);overlay.alpha_composite(cell,((row*2+k)*S,0))
overlay.convert('RGB').save(HERE/'polish-pose-overlays.png')
# Small-scale actual delivered particles, including a flip at 10% horizontal scale.
small=Image.new('RGBA',(1000,400),'#fff3d8');draw=ImageDraw.Draw(small)
for row,color in enumerate(['#fff3d8','#163d32']):
 y=row*200;draw.rectangle((0,y,1000,y+200),fill=color)
 for i,part in enumerate(reg['confetti']['parts']):
  im=load('confetti',part['name'],False);im=im.crop(bounds(im));im.thumbnail((24,24),Image.Resampling.LANCZOS);small.alpha_composite(im,(100+i*145,y+50));thin=im.resize((max(1,round(im.width*.1)),im.height),Image.Resampling.LANCZOS);small.alpha_composite(thin,(100+i*145,y+110))
small.convert('RGB').save(HERE/'polish-confetti-24px.png')
(HERE/'polish-delivery-qa.json').write_text(json.dumps(qa,indent=2)+'\n')
cards=''.join(f'<article><h2>{a}</h2><img src="polish-{a}-stress.gif"><a href="polish-{a}-stress.png">Four phases</a></article>' for a in NAMES)
(HERE/'polish-parts.html').write_text('<!doctype html><meta charset="utf-8"><title>Dino Mazes motion polish</title><style>body{background:#fff3d8;color:#234437;font:17px system-ui;margin:24px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(480px,1fr));gap:24px}img{max-width:100%}article{border:1px solid #abc;padding:12px;border-radius:16px}a{color:#35654a}</style><h1>Motion polish — registered layers and stress tests</h1><p>40 sampled phases, cream and dark green. These are stress ranges; see handoff for gentle runtime settings and limitations.</p><main>'+cards+'</main><h2>Master / assembled comparison</h2><img src="polish-parts-comparison.png"><h2>Fixed pose landmarks (magenta)</h2><img src="polish-pose-overlays.png"><h2>Delivered confetti at 24px / 10% width</h2><img src="polish-confetti-24px.png">')
print(json.dumps(qa,indent=2))

