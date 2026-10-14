"""Measured placement of generated artwork; no source painting. Run after generations finish."""
from pathlib import Path
from PIL import Image
import json, shutil
HERE=Path(__file__).resolve().parent; ART=HERE.parents[1]
# Bounds in approved, padded master pixel coordinates. Each tuple: name,bounds,pivot,opacity.
D={
'butterfly':(1680,[
('wing-left-hind',[385,820,850,1246],[832,840],1),('wing-right-hind',[830,820,1295,1246],[848,840],1),
('wing-left-fore',[257,433,853,898],[831,836],1),('wing-right-fore',[827,433,1423,898],[849,836],1),
('body',[681,432,1001,1105],[840,820],1)]),
'coconut':(1616,[('body',[244,382,1373,1348],[808,850],1),('tuft',[422,268,1170,526],[803,425],1),('highlight',[430,425,840,735],[635,580],.32)]),
'nut':(1648,[('nut',[485,345,1210,1150],[840,1080],1),('cup',[250,425,1398,1303],[840,1080],1)]),
'flower':(1632,[('stem',[680,770,846,1358],[813,1330],1),('leaf-left',[249,870,766,1175],[744,1150],1),('leaf-right',[771,1068,1355,1383],[780,1200],1),
('petal-1',[496,250,1026,845],[832,815],1),('petal-2',[816,435,1383,845],[832,815],1),
('petal-3',[816,738,1360,1055],[832,815],1),('petal-4',[715,778,1115,1128],[832,815],1),
('petal-5',[284,489,865,898],[832,815],1),('center',[816,486,991,840],[834,813],1)]),
'berries':(1392,[('stem',[610,380,853,946],[705,700],1),('leaves',[273,239,1171,772],[710,690],1),
('berry-1',[350,540,730,946],[600,720],1),('berry-2',[690,580,1060,970],[793,734],1),
('berry-4',[211,778,590,1115],[518,866],1),('berry-5',[826,800,1181,1134],[861,886],1),('berry-3',[493,755,891,1153],[696,912],1)]),
'chest':(1632,[('base',[245,525,1387,1293],[815,1190],1),('lid',[245,339,1387,890],[1295,655],1)]),
'strawberry':(1536,[('body',[301,466,1152,1301],[680,1280],1),('cap',[554,234,1234,789],[853,544],1),('glint',[412,556,575,688],[495,620],.55)])}
rig={'schemaVersion':1,'notes':'Draw order is array order, back to front. Pivots in padded master pixels. Affine registration already baked into PNGs; never apply nativeToCanvas twice. Source bounds measured at alpha >40. Generated layers approximate approved artwork, not pixel-identical segmentation.','assets':{}}
for a,(n,parts) in D.items():
 raw=ART/'review'/('treasures' if a=='strawberry' else 'motion')/'parts-native'/a
 raw.mkdir(parents=True,exist_ok=True)
 records=[]
 for name,target,pivot,opacity in parts:
  if a=='strawberry':shutil.copyfile(ART/'review/treasures/finish-native'/f'treasure-strawberry-{name}.png',raw/f'{name}.png')
  p=raw/f'{name}.png'
  if not p.exists():continue
  b=Image.open(p).convert('RGBA').getchannel('A').point(lambda v:255 if v>40 else 0).getbbox()
  records.append(dict(name=name,sourceBounds=b,targetBounds=target,pivot=pivot,opacity=opacity))
 rig['assets'][a]={'canvas':[n,n],'parts':records}
tr=ART/'review/treasures/registration.json';t=json.loads(tr.read_text());t['assets']['strawberry']=rig['assets'].pop('strawberry');tr.write_text(json.dumps(t,indent=2)+'\n')
(HERE/'registration.json').write_text(json.dumps(rig,indent=2)+'\n')
print({k:len(v['parts']) for k,v in rig['assets'].items()})
