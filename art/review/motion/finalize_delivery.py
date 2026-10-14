from pathlib import Path
from PIL import Image
import json,hashlib
ART=Path(__file__).resolve().parents[2]
def read(p):return json.loads((ART/p).read_text())
def write(p,d):(ART/p).write_text(json.dumps(d,indent=2,ensure_ascii=False)+'\n')
def measure(path):
 p=ART/path;i=Image.open(p).convert('RGBA');a=i.getchannel('A');return dict(width=i.width,height=i.height,size=list(i.size),mode='RGBA',hasAlpha=True,alphaRange=list(a.getextrema()),boundsAlpha40=a.point(lambda v:255 if v>40 else 0).getbbox(),bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest())
records=read('review/motion/parts-measurements.json')['assets'];byid={r['id']:r for r in records};assert len(records)==33
for filename in ['jobs-motion.json','jobs-treasures.json']:
 d=read('prompts/'+filename)
 for j in d['jobs']:
  if j['id'] in byid:
   r=byid[j['id']];assert (ART/j['output']).exists();j['status']='done';j['deliveredDate']='2026-10-15';j['actualCanvas']=r['size'];j['registration']='review/treasures/registration.json' if j['id'].startswith('treasure-') else 'review/motion/registration.json';j['qa']='Delivered source; see handoff for fidelity and motion limits';j['promptFiles']=r['promptFiles']
 write('prompts/'+filename,d)
cp=read('review/treasures/finish-checkpoint.json');cp['stage']='complete-approved-source-delivery';cp['completedDate']='2026-10-15';cp['partsMeasurements']='review/motion/parts-measurements.json'
for r in cp['assets']:
 if r['id']=='treasure-strawberry-master':r.update(status='master-approved',ownerApproved=True,approvalStatus='approved',approvedCopy='source/treasures-v2/strawberry.png')
write('review/treasures/finish-checkpoint.json',cp)
assert (ART/'source/motion/strawberry/master.png').read_bytes()==(ART/'source/treasures-v2/strawberry.png').read_bytes()
padded=read('review/motion/padded-master-measurements.json');mm=read('review/motion/master-measurements.json');mm.update(stage='priority-1-source-complete',partsGenerated=28,extraPosesGenerated=2)
for r,p in zip(mm['assets'],padded):
 assert r['id']=='motion-'+p['asset']+'-master'
 native=Image.open(ART/p['nativePath']).convert('RGBA');final=Image.open(ART/p['path']).convert('RGBA');x,y=p['paddingOffset'];assert native.tobytes()==final.crop((x,y,x+native.width,y+native.height)).tobytes()
 r.update(measure(p['path']));r.update(nativePath=p['nativePath'],nativeSize=p['nativeSize'],nativeSha256=p['nativeSha256'],paddingOffset=p['paddingOffset'],status='master-approved-padded',transform=p['transform']);b=r['boundsAlpha40'];r['actualSubjectExtentFraction']=round(max(b[2]-b[0],b[3]-b[1])/final.width,4)
write('review/motion/master-measurements.json',mm)
m=read('manifest.json');m['updatedAt']='2026-10-15';m['scope']='Source artwork inventory. V3 character and intro sets delivered. Six motion masters and all priority-1 parts/poses delivered. Five treasure masters approved with all 24 parts; Giganto badge delivered. Runtime integration remains with Claude.'
entries={r['id']:r for r in m['assets']}
for r in records:
 e=entries.setdefault(r['id'],{'id':r['id'],'owner':'Codex'});e.update(r);e.update(source=r['path'],width=r['size'][0],height=r['size'][1],hasAlpha=True,status='source-delivered-registered',runtimePath=None,qa='Reviewed within recorded motion ranges; see handoff. Not pixel-identical master segmentation.')
for r in mm['assets']:
 e=entries[r['id']];e.update(r);e.update(source=r['path'],ownerApproved=True,stage='master-approved-padded')
for r in cp['assets']:
 e=entries[r['id']];e.update(r);e['source']=r['path']
m['assets']=list(entries.values());m['motion'].update(stage='priority-1-source-complete',partsGenerated=28,extraPosesGenerated=2,review='review/motion/parts.html',measurements='review/motion/parts-measurements.json',framingStatus='Six masters padded to about 70%; approved pixels preserved; offsets/hashes recorded',registration='review/motion/registration.json',completedDate='2026-10-15')
m['finish'].update(stage='complete',deliveredJobs=['treasure-strawberry-master','ui-giganto-emblem']+list(byid),partsGenerated=31,extraPosesGenerated=2,remainingAfterApproval={'strawberryParts':0,'motionPriority1Jobs':0},review='review/motion/parts.html',measurements='review/motion/parts-measurements.json',completedDate='2026-10-15')
m['treasuresV2']['strawberry']={'ownerApproved':True,'approvedCopy':'source/treasures-v2/strawberry.png','partsGenerated':3,'registration':'review/treasures/registration.json'}
m['currentDeliveryCounts'].update(treasureApprovedMasters=5,treasurePartPngs=24,treasureReviewGifs=5,motionApprovedMasters=6,motionPartPngs=28,motionExtraPoses=2,motionReviewGifs=7,finishReviewGifs=8)
m['currentDeliveryCounts'].pop('strawberryMasterCandidates',None)
m['treasuresV2'].update(masterCount=5,partsGenerated=24,approvedCopiesMade=5,registeredParts=24,previewGifs=5,strawberryPartsMeasurements='review/motion/parts-measurements.json')
sp=ART/'review/motion/strawberry-stress.gif';si=Image.open(sp)
m['treasuresV2']['reviewLoops']=[r for r in m['treasuresV2']['reviewLoops'] if 'strawberry' not in r['path']]+[dict(path=str(sp.relative_to(ART)),frames=si.n_frames,sha256=hashlib.sha256(sp.read_bytes()).hexdigest())]
write('manifest.json',m)
qa={'date':'2026-10-15','newGeneratedOutputs':33,'registeredParts':31,'extraPoses':2,'allFinalPngsTrueAlpha':True,'masterPixelsPreserved':True,'strawberryApprovedCopyByteIdentical':True,'sampledPhasesPerGif':32,'reviewBackgrounds':['cream #fff3d4','dark green #203f35'],'browserLoadedRigs':7,'browserConsoleErrorsWarnings':[],'qaScope':'Visual art review and measured source invariants, not runtime integration or arbitrary simultaneous pose guarantee. See handoffs for fidelity and motion limits.','gifs':[]}
for p in sorted((ART/'review/motion').glob('*-stress.gif'))+list((ART/'review/motion').glob('*-bloom.gif')):
 i=Image.open(p);qa['gifs'].append({'path':str(p.relative_to(ART)),'size':i.size,'actualFrames':i.n_frames,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
assert len(qa['gifs'])==8
write('review/motion/delivery-qa.json',qa)
print('Finalized 33 new outputs, 35 finish jobs total. Eight review GIFs. Master preservation and approved-copy checks pass.')
for f in ['jobs-motion.json','jobs-treasures.json']:
 jobs=read('prompts/'+f)['jobs'];print(f,'done',sum(j.get('status')=='done' for j in jobs),'todo priority1',sum(j.get('status')=='todo' and j.get('priority')==1 for j in jobs),'other todo',sum(j.get('status')=='todo' and j.get('priority')!=1 for j in jobs))
