#!/usr/bin/env python3
"""Add one explicitly labelled 2-second freeze to the existing public V3.

All 2223 original frames remain in order. No UI/result/model regeneration.
Requires FFmpeg/ffprobe and the installed Noto CJK font, not a personal browser.
"""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess

ROOT=Path(__file__).resolve().parents[1]
SOURCE='review-assets/2026-11-09/HomeSafe-AI_V3_20261109.mp4'
SOURCE_SHA='184ec7f936eb08c306c4d4ba1c6ec40125600a77f2744a93447bf5dbdd8ccef2'
FONT=Path('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc')

def sha(raw):return hashlib.sha256(raw).hexdigest()

def probe(path):
    return json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(path)]))

def create(output):
    output=Path(output).absolute()
    if any(p.is_symlink() for p in [output,*output.parents]):raise ValueError('Output symlink forbidden')
    if not output.resolve().is_relative_to(ROOT/'evidence/private') or output==ROOT/'evidence/private':
        raise ValueError('Use a new output directory under evidence/private')
    if output.exists():raise ValueError('Output exists; preserve it and choose a new run directory')
    original=ROOT/SOURCE;raw=original.read_bytes()
    if sha(raw)!=SOURCE_SHA:raise ValueError('Original public V3 hash mismatch')
    source=probe(original);streams=source['streams']
    if len(streams)!=1 or streams[0].get('codec_type')!='video':raise ValueError('Expected the original silent single-stream V3')
    video=streams[0]
    if (video['nb_frames'],video['r_frame_rate'],video['width'],video['height'])!=('2223','25/1',1920,1080):
        raise ValueError('Original frame/time mapping changed')
    if not FONT.is_file():raise ValueError('Install the documented Noto CJK font before creating the candidate')
    output.mkdir(parents=True,exist_ok=False)
    (output/'hold-caption.txt').write_text('V4 定格展示2秒｜已恢复合法位置｜源实录63.12秒（不是持续实操）',encoding='utf-8')
    # Keep original 0..1578, insert 50 labelled copies of frame1578, resume1579.
    filters=(
        '[0:v]split=3[first][frame][last];'
        '[first]trim=end_frame=1579,setpts=PTS-STARTPTS[a];'
        '[frame]trim=start_frame=1578:end_frame=1579,loop=loop=49:size=1:start=0,setpts=N/(25*TB),'
        'drawbox=x=0:y=ih-80:w=iw:h=80:color=0x173e38:t=fill,'
        f'drawtext=fontfile={FONT}:textfile=hold-caption.txt:fontcolor=white:fontsize=28:x=(w-text_w)/2:y=h-56[b];'
        '[last]trim=start_frame=1579,setpts=PTS-STARTPTS[c];'
        '[a][b][c]concat=n=3:v=1:a=0[out]')
    target=output/'HomeSafe-AI_demo_candidate_V4_20261109.mp4'
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-i',str(original),'-filter_complex',filters,
        '-map','[out]','-an','-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p',
        '-r','25','-fps_mode','cfr','-movflags','+faststart','-metadata',
        'comment=V4 edit of retained V3: 2 seconds explicitly labelled freeze of source frame1578; original frames retained in order.',str(target)],cwd=output,check=True)
    actual=probe(target);stream=actual['streams'][0]
    if len(actual['streams'])!=1 or stream['nb_frames']!='2273' or abs(float(actual['format']['duration'])-90.92)>0.001:
        raise ValueError('Output frame count/duration mismatch')
    subprocess.run(['ffmpeg','-v','error','-i',str(target),'-f','null','-'],check=True)
    if original.read_bytes()!=raw:raise ValueError('Source changed during generation')
    record={'status':'PASS_DECODED_FRAME_TIMELINE','candidate':'V4','source_path':SOURCE,'source_sha256':SOURCE_SHA,
        'source_capture_commit':'5826dab4bf8385412756e8de1f1d2491afc199d6','source_frames':2223,'source_seconds':88.92,
        'output_filename':target.name,'output_bytes':target.stat().st_size,'output_sha256':sha(target.read_bytes()),
        'output_frames':2273,'output_seconds':90.92,'fps':25,'size':[1920,1080],'audio_streams':0,
        'hold':{'source_frame':1578,'source_seconds':63.12,'output_start_seconds':63.16,'output_end_seconds':65.16,
                'inserted_frames':50,'seconds':2.0,'clearly_labelled_freeze':True},
        'frame_map':[{'output':[0,1578],'source':[0,1578]},
                     {'output':[1579,1628],'source':[1578,1578],'kind':'labelled_still'},
                     {'output':[1629,2272],'source':[1579,2222]}],
        'font_file_sha256':sha(FONT.read_bytes()),'source_bytes_unchanged':True,
        'visual_review':'NOT_RUN_BY_ENCODER','continuous_browser_playback':'NOT_RUN_BY_ENCODER',
        'meaning':'Presentation edit only; the hold is not two seconds of additional live operation'}
    (output/'edit-manifest.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(record,ensure_ascii=False))

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args()
    try:create(args.output)
    except (ValueError,OSError,subprocess.CalledProcessError) as error:raise SystemExit('BLOCKED: '+str(error)) from error
