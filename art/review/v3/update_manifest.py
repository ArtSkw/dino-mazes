"""Inventory finished V3 sources; run after build_previews.py and visual review."""
from pathlib import Path
from datetime import date
from PIL import Image
import hashlib, json, sys

HERE=Path(__file__).resolve().parent
ART=HERE.parents[1]
report=json.loads((HERE/'animation-measurements.json').read_text())
complete = report['sourceFrameCount']==180 and not report['missing'] and report['previewCount']==25
assert complete or '--partial' in sys.argv, 'Use --partial for an honest checkpoint inventory.'
manifest=json.loads((ART/'manifest.json').read_text())
for entry in manifest['assets']:
    if not entry['id'].startswith('character-') or not entry['id'].endswith('-v3'):
        continue
    character=entry['id'].removeprefix('character-').removesuffix('-v3')
    folder=ART/'source'/entry['id']
    selected=[r for r in report['frames'] if r['character']==character]
    required = sum(r['reaction']!='talk' for r in selected)
    talks = sum(r['reaction']=='talk' for r in selected)
    entry.update({'stage':'source-set-complete' if len(selected)==36 else 'generation-blocked-usage-limit','frameCount':len(selected),'reactionFrameCount':required,'talkFrameCount':talks,'canvasSize':[1254,1254],'width':1254,'height':1254,'mode':'RGBA','hasAlpha':True,'status':'source-candidate-runtime-qa-pending','runtimePath':None,'promptFile':'prompts/jobs-v3-executed-animation.json'})
    entry['sequences']=[{'name':name,'frames':[Path(r['path']).name for r in selected if r['reaction']==name],'preview':f'review/v3/{character}-{name}.gif' if (HERE/f'{character}-{name}.gif').exists() else None,'previewFps':10} for name in ['idle','drawing','encouragement','celebration','talk']]
    files=[]
    for path in sorted(folder.glob('*.png')):
        record=next((r for r in selected if Path(r['path']).name==path.name),None)
        with Image.open(path) as im:
            item={'path':path.name,'width':im.width,'height':im.height,'mode':im.mode,'hasAlpha':'A' in im.getbands(),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'bytes':path.stat().st_size,'role':'animation-frame' if record else ('selected-master' if path.name=='master.png' else 'reference-candidate')}
        if record:
            item.update({k:record[k] for k in ['promptFiles','subjectBoundsAlpha40','edgePixelsAlpha40']})
        else:
            label='master-framing' if path.stem in ['master','master-framed'] else path.stem
            item['promptFiles']=[str(p.relative_to(ART)) for p in sorted((ART/'prompts/v3-executed').glob(f'{character}-{label}*.txt'))]
        files.append(item)
    entry['files']=files
    entry['promptFiles']=[str(p.relative_to(ART)) for p in sorted((ART/'prompts/v3-executed').glob(f'{character}-*.txt'))]
    entry['qa'].update({'inventory':f'{len(selected)}/36 selected frames; all available frames are 1254 square RGBA with alpha range 0–255; SHA256 recorded.', 'measurementsFile':'review/v3/animation-measurements.json','registration':'Not certified to ±2% head/eye tolerance. Generated motion includes pose-dependent size/position changes; Claude must register and review packed animations.', 'animation':'Complete reactions have 10fps GIFs; see CLAUDE_HANDOFF_V3.md for review findings and integration requirements.'})
intro_complete = manifest.get('intro', {}).get('stage') == 'source-set-complete'
manifest['scope']='Source artwork inventory. V3 character source generation '+('complete' if complete else 'blocked by daily Imagegen usage limit')+('; intro source generation complete' if intro_complete else '')+'; final runtime QA remains pending.'
manifest['updatedAt']=date.today().isoformat()
manifest['runtimeReady']=False
manifest['v3'].update({'stage':'source-set-complete' if complete else 'generation-blocked-usage-limit','animationFramesGenerated':report['sourceFrameCount']-5,'neutralFramesCopied':5,'reactionFramesAvailable':sum(r['reaction']!='talk' for r in report['frames']),'talkFramesAvailable':sum(r['reaction']=='talk' for r in report['frames']),'totalSelectedFrames':report['sourceFrameCount'],'completedReactions':[name for name,size in [('idle',40),('drawing',40),('encouragement',40),('celebration',40),('talk',20)] if sum(r['reaction']==name for r in report['frames'])==size],'previewGifCount':report['previewCount'],'handoff':'CLAUDE_HANDOFF_V3.md','measurements':'review/v3/animation-measurements.json','registrationStatus':'pending Claude integration','review':'review/v3/index.html','missingFrames':report['missing']})
(ART/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(f"Manifest updated: {report['sourceFrameCount']} selected frames, {report['previewCount']} GIFs; complete={complete}.")
