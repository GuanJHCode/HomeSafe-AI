#!/usr/bin/env python3
"""Exact-file export. Dry-run by default; no git commands, credentials or network."""
import argparse,hashlib,json,shutil,sys
from pathlib import Path, PurePosixPath
R=Path(__file__).resolve().parents[1];sys.path.insert(0,str(R/'reference'))
from homesafe_core.release import contained_file,sha256

def verify_plan(root,manifest):
    entries=manifest.get('files')
    if not isinstance(entries,list) or not entries:raise ValueError('explicit file allowlist required')
    seen=set();out=[]
    for e in entries:
        rel=e['path']
        parts=PurePosixPath(rel).parts
        forbidden={'.git','.venv','node_modules','private','data','__pycache__','.pytest_cache'}
        if any(part in forbidden for part in parts) or (Path(rel).name.startswith('.env') and Path(rel).name!='.env.example') or Path(rel).suffix.lower() in {'.pem','.key','.p12','.pfx'}:
            raise ValueError('sensitive or runtime file is never exported: '+rel)
        if rel in seen:raise ValueError('duplicate path')
        seen.add(rel)
        if e.get('classification')!='generated_project_source':raise ValueError('private/unknown file not exportable')
        p=contained_file(root,rel)
        if sha256(p)!=e['sha256']:raise ValueError('file changed since package review: '+rel)
        out.append((rel,p))
    return out

def export(root,dest,manifest,confirmed=False):
    files=verify_plan(root,manifest)
    if not confirmed:return [rel for rel,p in files]
    dest=dest.absolute()
    if dest.is_symlink():raise ValueError('destination symlink forbidden')
    if dest.resolve().is_relative_to(root.resolve()) or root.resolve().is_relative_to(dest.resolve()):raise ValueError('destination must be separate from source')
    for ancestor in [dest,*dest.parents]:
        if ancestor.is_symlink():raise ValueError('destination ancestor symlink forbidden')
    # Check all destinations before writing anything. Never overwrite differing files.
    for rel,p in files:
        current=dest
        for part in PurePosixPath(rel).parts:
            current=current/part
            if current.is_symlink():raise ValueError('destination symlink: '+rel)
        if current.exists() and (not current.is_file() or current.read_bytes()!=p.read_bytes()):raise ValueError('existing different file; manual merge required: '+rel)
    for rel,p in files:
        target=dest/rel;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,target)
    return [rel for rel,p in files]

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--dest',type=Path);parser.add_argument('--ack-reviewed-files',action='store_true')
    args=parser.parse_args();manifest=json.loads((R/'package-manifest.json').read_text())
    if args.ack_reviewed_files and args.dest is None:parser.error('--dest required when exporting')
    files=export(R,args.dest or R.parent/'export-preview',manifest,args.ack_reviewed_files)
    print('EXPORTED' if args.ack_reviewed_files else 'DRY RUN — nothing copied; review the exact files:')
    for p in files:print(p)
    print(f'{len(files)} explicit files. No git operations. New evidence is never auto-included.')
if __name__=='__main__':
    try:main()
    except (ValueError,OSError,KeyError) as e:raise SystemExit('STOP: '+str(e))
