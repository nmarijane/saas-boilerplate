#!/usr/bin/env python3
"""Create a reproducible handoff ZIP, excluding installed dependencies and demo build output."""
from pathlib import Path
import hashlib,json,zipfile
root=Path(__file__).resolve().parents[1]
excluded={'node_modules','preview-dist','.git','__pycache__'}
files=sorted(p for p in root.rglob('*') if p.is_file() and not any(x in excluded for x in p.relative_to(root).parts) and p.name not in {'failure.png','MANIFEST.sha256.json'} and not p.name.endswith('.zip'))
manifest={p.relative_to(root).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in files}
(root/'MANIFEST.sha256.json').write_text(json.dumps(manifest,indent=2)+'\n')
files.append(root/'MANIFEST.sha256.json')
output=root.parent/'AI-Chambers-Design-System-v1.0.0.zip'
with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
 for p in files:
  info=zipfile.ZipInfo('ai-chambers-design-system/'+p.relative_to(root).as_posix(),date_time=(2026,10,25,0,0,0))
  info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o644<<16
  z.writestr(info,p.read_bytes())
with zipfile.ZipFile(output) as z:
 assert z.testzip() is None
 names=z.namelist();assert len(names)==len(set(names))
 assert all(not n.startswith('/') and '..' not in Path(n).parts and 'node_modules' not in Path(n).parts for n in names)
 saved=json.loads(z.read('ai-chambers-design-system/MANIFEST.sha256.json'))
 for path,digest in saved.items():assert hashlib.sha256(z.read('ai-chambers-design-system/'+path)).hexdigest()==digest,path
 print(json.dumps({'zip':str(output),'files':len(names),'bytes':output.stat().st_size,'sha256':hashlib.sha256(output.read_bytes()).hexdigest(),'zipCRC':'passed','manifestHashes':'passed','safePaths':'passed'},indent=2))
