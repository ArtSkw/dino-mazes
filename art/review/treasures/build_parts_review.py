"""Register generated parts to the approved master canvas; no painted content is created.

Raw generated PNGs stay in parts-native/. Scaling/translation are recorded in
registration.json. Regenerate previews after changing registration; masters are never edited.
"""
from pathlib import Path
from PIL import Image, ImageDraw
import json, hashlib
import math

HERE = Path(__file__).resolve().parent
ART = HERE.parents[1]
rig = json.loads((HERE/'registration.json').read_text())
measurements = []
sheet = Image.new('RGB', (1600, 4*440), '#203f35')
draw = ImageDraw.Draw(sheet)
for row, (name, asset) in enumerate((k, v) for k, v in rig['assets'].items() if k != 'strawberry'):
    size = tuple(asset['canvas'])
    layers = []
    for part in asset['parts']:
        path = HERE/'parts-native'/name/(part['name']+'.png')
        im = Image.open(path).convert('RGBA')
        b, t = part['sourceBounds'], part['targetBounds']
        sx, sy = (t[2]-t[0])/(b[2]-b[0]), (t[3]-t[1])/(b[3]-b[1])
        tx, ty = t[0]-b[0]*sx, t[1]-b[1]*sy
        part['nativeToCanvas'] = [sx, 0, 0, sy, tx, ty]
        # Premultiplied alpha avoids coloured fringes during the technical resample.
        aligned = im.convert('RGBa').transform(size, Image.Transform.AFFINE,
            (1/sx, 0, -tx/sx, 0, 1/sy, -ty/sy), Image.Resampling.BICUBIC).convert('RGBA')
        dest = ART/'source/motion'/name/(part['name']+'.png')
        aligned.save(dest)
        alpha = aligned.getchannel('A')
        bbox = alpha.point(lambda v:255 if v>40 else 0).getbbox()
        assert alpha.getextrema()[0] == 0
        assert bbox and min(bbox[:2]) > 0 and bbox[2] < size[0] and bbox[3] < size[1]
        prompts = sorted((ART/'prompts/treasures-executed').glob('treasure-'+name+'-'+part['name']+'*.txt'))
        measurements.append({'id':'treasure-'+name+'-'+part['name'],
            'path':str(dest.relative_to(ART)), 'size':size, 'mode':'RGBA',
            'alphaRange':alpha.getextrema(), 'boundsAlpha40':bbox,
            'sha256':hashlib.sha256(dest.read_bytes()).hexdigest(),
            'bytes':dest.stat().st_size, 'nativePath':str(path.relative_to(ART)),
            'nativeSize':im.size, 'nativeSha256':hashlib.sha256(path.read_bytes()).hexdigest(),
            'transform':part['nativeToCanvas'], 'pivot':part['pivot'],
            'generator':'built-in GPT Imagegen',
            'promptFiles':[str(p.relative_to(ART)) for p in prompts],
            'promptHashes':{str(p.relative_to(ART)):hashlib.sha256(p.read_bytes()).hexdigest() for p in prompts}})
        if part['opacity'] != 1:
            aligned.putalpha(alpha.point(lambda v:round(v*part['opacity'])))
        layers.append((part, aligned))
    for col, (label, angle) in enumerate([('approved master / cream',None), ('parts / cream',0), ('approved master / green',None), ('parts / green',0)]):
        result = Image.new('RGBA',size)
        if angle is None:
            result = Image.open(ART/'source/motion'/name/'master.png').convert('RGBA')
        else:
            for part, im in layers:
                moving = part['name'].startswith(('petal-', 'vane-'))
                if name=='amber': moving=part['name']=='leaf'
                if moving and angle:
                    im = im.rotate(angle, Image.Resampling.BICUBIC, center=part['pivot'])
                result.alpha_composite(im)
            result.save(HERE/(name+'-assembled'+('' if angle==0 else '-'+str(angle))+'.png'))
        result.thumbnail((400,400))
        x,y=col*400,row*440
        if col<2: draw.rectangle((x,y,x+400,y+400),fill='#fff3d4')
        sheet.paste(result,(x,y),result)
        draw.text((x+10,y+410),name+' / '+label,fill='white')
    # Review-only loop. Not a runtime rig, and not new generated source frames.
    frames=[]
    for frame in range(36):
        phase=frame/36*2*math.pi
        result=Image.new('RGBA',(400,400),'#23473b')
        scale=400/size[0]
        for i,(part,im) in enumerate(layers):
            im=im.resize((400,400),Image.Resampling.LANCZOS)
            angle=0
            if name=='feather' and part['name']=='vane-left': angle=2*math.sin(phase)
            if name=='gigaflower' and part['name'].startswith('petal-'): angle=3*math.sin(phase+i*.35)
            if name=='amber' and part['name']=='leaf': angle=3*math.sin(phase)
            if angle: im=im.rotate(angle,Image.Resampling.BICUBIC,center=tuple(v*scale for v in part['pivot']))
            if part['name']=='glint': im.putalpha(im.getchannel('A').point(lambda v:round(v*(.7+.3*math.sin(phase)))))
            result.alpha_composite(im)
        frames.append(result.convert('RGB'))
    frames[0].save(HERE/(name+'-motion.gif'),save_all=True,append_images=frames[1:],duration=85,loop=0,disposal=2)
sheet.save(HERE/'parts-comparison.png')
(HERE/'registration.json').write_text(json.dumps(rig,indent=2)+'\n')
(HERE/'parts-measurements.json').write_text(json.dumps({'count':len(measurements),'assets':measurements},indent=2)+'\n')
print('Registered and measured',len(measurements),'parts')
