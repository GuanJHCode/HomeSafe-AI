"""Fail-closed release checks. Validity checks cannot prove ownership or honesty.
Untrusted GLB needs additional full glTF validation/browser tests in the product.
"""
from __future__ import annotations
from pathlib import Path, PurePosixPath
import hashlib,json,struct,subprocess,shutil,re,ipaddress
from urllib.parse import urlsplit

def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()

def contained_file(root: Path, relative: str) -> Path:
    if not isinstance(relative,str) or not relative or '\\' in relative:
        raise ValueError('invalid relative file path')
    p=PurePosixPath(relative)
    if p.is_absolute() or any(x in ('..','.') for x in p.parts) or ':' in p.parts[0]:
        raise ValueError('unsafe relative path')
    base=root.resolve();current=base
    for part in p.parts:
        current=current/part
        if current.is_symlink():raise ValueError('symlink forbidden')
    resolved=current.resolve()
    if not resolved.is_relative_to(base) or not resolved.is_file():raise ValueError('file missing or outside root')
    return resolved

def validate_public_demo_url(url: str) -> None:
    """Reject non-public/credentialed URL syntax; no DNS or availability claim."""
    if (not isinstance(url, str) or not url or any(c.isspace() or ord(c) < 32 for c in url)
            or any(c in url for c in ('\\', '?', '#'))):
        raise ValueError('public demo requires a plain anonymous HTTPS URL')
    parsed = urlsplit(url)
    host = (parsed.hostname or '').rstrip('.').lower()
    if (parsed.scheme != 'https' or not host or parsed.username is not None
            or parsed.password is not None or parsed.query or parsed.fragment or '%' in host
            or (parsed.port is not None and not 1 <= parsed.port <= 65535)):
        raise ValueError('public demo requires an anonymous HTTPS host and valid port')
    try:
        address = ipaddress.ip_address(host)
    except ValueError:
        # Reject browser-normalized numeric IP forms and obvious local DNS names.
        # DNS names can still resolve privately: the deployment/browser receipts
        # remain mandatory, and this syntax guard is not a network verification.
        labels = host.split('.')
        if (len(labels) < 2 or len(host) > 253 or
                any(not re.fullmatch(r'[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?', label) for label in labels) or
                re.fullmatch(r'(?:0x[0-9a-f]+|[0-9]+)', labels[-1]) or
                labels[-1] in {'localhost', 'local', 'localdomain', 'internal', 'test', 'invalid', 'example'} or
                host == 'home.arpa' or host.endswith('.home.arpa')):
            raise ValueError('public demo host is local, ambiguous, or malformed')
    else:
        if not address.is_global or address.is_multicast or address.is_reserved:
            raise ValueError('public demo IP address is not public unicast')


def validate_glb(path: Path, max_bytes=50_000_000) -> dict:
    """Structural subset only; rejects external resources and malformed chunks."""
    size=path.stat().st_size
    if size<20 or size>max_bytes:raise ValueError('GLB size outside project limit')
    return validate_glb_bytes(path.read_bytes(), max_bytes)

def validate_glb_bytes(raw: bytes, max_bytes=50_000_000) -> dict:
    """Validate the exact bytes selected for publication without reopening a file."""
    if not 20 <= len(raw) <= max_bytes:raise ValueError('GLB size outside project limit')
    magic,version,total=struct.unpack_from('<4sII',raw,0)
    if (magic,version,total)!=(b'glTF',2,len(raw)):raise ValueError('invalid GLB header')
    pos=12;chunks=[]
    while pos<len(raw):
        if pos+8>len(raw):raise ValueError('truncated GLB chunk')
        length,kind=struct.unpack_from('<II',raw,pos);pos+=8
        if length%4 or pos+length>len(raw):raise ValueError('invalid GLB chunk length')
        chunks.append((kind,raw[pos:pos+length]));pos+=length
    if not chunks or chunks[0][0]!=0x4e4f534a:raise ValueError('first chunk must be JSON')
    if len(chunks)>2 or (len(chunks)==2 and chunks[1][0]!=0x004e4942):raise ValueError('unsupported GLB chunk layout')
    doc=json.loads(chunks[0][1].rstrip(b' \0'))
    if doc.get('asset',{}).get('version')!='2.0' or not doc.get('meshes'):raise ValueError('not a mesh asset')
    def no_uri(v):
        if isinstance(v,dict):
            if 'uri' in v:raise ValueError('P0 self-contained GLB required; no external/data URIs')
            for x in v.values():no_uri(x)
        elif isinstance(v,list):
            for x in v:no_uri(x)
    no_uri(doc)
    buffers=doc.get('buffers',[])
    if len(buffers)!=1 or len(chunks)!=2:raise ValueError('expected one embedded buffer')
    length=buffers[0].get('byteLength')
    if type(length) is not int or not 0<length<=len(chunks[1][1]) or len(chunks[1][1])-length>3:raise ValueError('buffer byteLength mismatch')
    for view in doc.get('bufferViews',[]):
        start=view.get('byteOffset',0);count=view.get('byteLength')
        if view.get('buffer',0)!=0 or type(start) is not int or type(count) is not int or start<0 or count<=0 or start+count>length:
            raise ValueError('bufferView out of bounds')
    # This does NOT claim complete mesh/accessor/extension/image decoding validation.
    return doc

class ReleaseVerifier:
    def verify(self, root: Path, manifest: dict) -> list[str]:
        root=root.resolve();errors=[]
        def fail(msg):errors.append(msg)
        def get_file(entry,label):
            try:
                if not isinstance(entry,dict):raise ValueError('expected file descriptor')
                p=contained_file(root,entry.get('path',''))
                if not p.stat().st_size:raise ValueError('empty file')
                if not re.fullmatch('[a-f0-9]{64}',entry.get('sha256','')) or sha256(p)!=entry['sha256']:raise ValueError('sha256 mismatch')
                return p
            except (ValueError,OSError,TypeError) as e:fail(f'{label}: {e}');return None
        if manifest.get('manifest_version')!='2.0':fail('manifest_version must be 2.0')
        if manifest.get('status') not in {'DRAFT','READY_FOR_SUBMISSION','SUBMITTED'}:fail('invalid status')
        commit=manifest.get('source_commit','')
        if not isinstance(commit,str) or not re.fullmatch('[a-f0-9]{40,64}',commit):fail('valid source commit required')
        else:
            try:
                out=subprocess.run(['git','cat-file','-t',commit],cwd=root,capture_output=True,text=True,timeout=5)
                if out.returncode or out.stdout.strip()!='commit':fail('source commit does not exist in this checkout')
            except (OSError,subprocess.TimeoutExpired):fail('cannot verify source commit')
        owner=get_file(manifest.get('owner_review'),'owner_review')
        if owner:
            try:
                review=json.loads(owner.read_text())
                for k in ('terms_reviewed','limits_confirmed','rule_content_reviewed','privacy_reviewed','rights_reviewed'):
                    if review.get(k) is not True:fail('owner review missing: '+k)
                if review.get('source_commit')!=commit or not review.get('reviewed_by') or not review.get('reviewed_at'):fail('owner review not bound to version/reviewer/time')
            except Exception as e:fail('owner_review malformed: '+type(e).__name__)
        test=get_file(manifest.get('product_acceptance'),'product_acceptance')
        if test:
            try:
                evidence=json.loads(test.read_text())
                if evidence.get('source_commit')!=commit or evidence.get('scope')!='full_browser_product' or evidence.get('result')!='passed':fail('not product acceptance for final version')
                for k in ('browser_environment','real_lux3d_assets','tested_cases'):
                    if not evidence.get(k):fail('product acceptance lacks '+k)
                get_file(evidence.get('log'),'acceptance_log')
            except Exception as e:fail('acceptance malformed: '+type(e).__name__)
        report=get_file(manifest.get('report'),'report')
        if report:
            if report.suffix.lower()!='.pdf':fail('this verifier supports PDF reports only; extend explicitly for other official formats')
            elif not shutil.which('pdfinfo'):fail('pdfinfo not installed; report parse UNVERIFIED')
            else:
                try:
                    rr=subprocess.run(['pdfinfo',str(report)],capture_output=True,text=True,timeout=15)
                    if rr.returncode or not re.search(r'Pages:\s+[1-9]\d*',rr.stdout):fail('report cannot be parsed')
                except (OSError,subprocess.TimeoutExpired):fail('report parser failed')
        # This local release profile uses a video. Official rules also permit a demo link.
        video=get_file(manifest.get('video'),'video')
        if video:
            if not shutil.which('ffprobe'):fail('ffprobe not installed; video UNVERIFIED')
            else:
                try:
                    vv=subprocess.run(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(video)],capture_output=True,text=True,timeout=15)
                    value=json.loads(vv.stdout)
                    if vv.returncode or not any(s.get('codec_type')=='video' for s in value.get('streams',[])) or float(value.get('format',{}).get('duration',0))<=0:fail('video cannot be parsed')
                except (ValueError,OSError,subprocess.TimeoutExpired):fail('video parser failed')
        assets=manifest.get('assets',[]);ids=set();hashes=set();valid_ids=set()
        if not isinstance(assets,list):fail('assets must be list');assets=[]
        for a in assets:
            if not isinstance(a,dict):fail('malformed asset');continue
            aid=a.get('asset_id');h=a.get('sha256')
            if not aid or aid in ids:fail('duplicate or missing asset ID')
            ids.add(aid)
            if h in hashes:fail('duplicate asset content; reuse one asset ID for instances')
            hashes.add(h)
            p=get_file(a,'asset:'+str(aid))
            if p:
                try:validate_glb(p);valid_ids.add(aid)
                except Exception as e:fail('invalid GLB: '+str(e))
            if a.get('source_kind') not in {'lux3d_web','lux3d_api'}:fail('core mapped asset not proven Lux3D')
            get_file(a.get('generation_evidence'),'asset_generation_evidence')
            if a.get('rights_scope') not in {'public','official_review_only'}:fail('unconfirmed distribution rights')
            if manifest.get('channel')=='public' and a.get('rights_scope')!='public':fail('asset not allowed for public distribution')
        scene_path=get_file(manifest.get('scene'),'final_scene')
        used=set()
        if scene_path:
            try:
                from .validation import validate_scene
                scene=validate_scene(json.loads(scene_path.read_text()))
                used={o.asset_id for o in scene.objects if o.asset_id}
            except Exception as e:fail('scene invalid: '+str(e))
        maps=manifest.get('feature_asset_map',[])
        if not isinstance(maps,list) or not maps:fail('core feature→Lux3D evidence mapping missing');maps=[]
        for entry in maps:
            if not isinstance(entry,dict) or not entry.get('feature_id') or not entry.get('video_segment') or entry.get('asset_id') not in valid_ids & used:
                fail('feature map not linked to used, validated asset')
        if manifest.get('status')=='SUBMITTED':get_file(manifest.get('official_receipt'),'official_receipt')
        # READY never needs a future official receipt; SUBMITTED does.
        return errors
