#!/usr/bin/env python3
"""Optional local asset job. Default is a plan; no frontend, background service or auto-retry.
Own/authored demo material only. API keys and result URLs must never enter public output.
SDK call signatures still require checking against the installed version before paid execution.
"""
import argparse, hashlib, json, os
from pathlib import Path

def save_job(path: Path, data):
    path.parent.mkdir(parents=True,exist_ok=True)
    temp=path.with_suffix(path.suffix+".tmp")
    temp.write_text(json.dumps(data,ensure_ascii=False,indent=2)+"\n")
    try:temp.chmod(0o600)
    except OSError:pass
    temp.replace(path)

def make_plan(image: Path, version, face_count, predict_size):
    if not image.is_file() or image.suffix.lower() not in {".png",".jpg",".jpeg",".webp"}:
        raise ValueError("Use a local approved object-only PNG/JPEG/WebP")
    if not 0<image.stat().st_size<=20_000_000:
        raise ValueError("Input exceeds project 20MB limit")
    return {"status":"planned","input_sha256":hashlib.sha256(image.read_bytes()).hexdigest(),
            "version":version,"face_count":face_count,"ai_predict_size":predict_size,
            "output_format":["glb"],"provider_task_id":None,"result":None}

def finish_wait(client, job, path):
    task_id=job["provider_task_id"]
    try:
        result=client.tasks.wait_for(int(task_id))
        if str(result.get("taskId"))!=task_id:
            raise ValueError("provider task identity mismatch")
        if result.get("status")!=3 or not result.get("outputs"):
            raise ValueError("provider did not return completed outputs")
        job.update(status="provider_succeeded",result=result)
        # Private job record may contain short-lived signed URLs; never git add it.
        save_job(path,job)
    except Exception as exc:
        job.update(status="query_requires_review",last_error_type=type(exc).__name__)
        save_job(path,job)
        raise
    return job

def generate(client, image: Path, job_path: Path, plan):
    if job_path.exists():
        raise ValueError("Job file exists; resume known task, never silently recreate")
    job=dict(plan,status="submitting_unknown")
    save_job(job_path,job)  # Crash or ambiguous network error must not trigger a second create.
    try:
        task=client.img_to_3d.create_from_file(str(image),version=plan["version"],
            face_count=plan["face_count"],output_format=["glb"],
            ai_predict_size=plan["ai_predict_size"])
        if isinstance(task,bool) or not str(task).isascii() or not str(task).isdigit() or int(task)<=0:
            raise ValueError("unexpected task id; manual reconciliation required")
        job.update(status="polling",provider_task_id=str(task));save_job(job_path,job)
    except Exception as exc:
        job["last_error_type"]=type(exc).__name__;save_job(job_path,job)
        raise
    return finish_wait(client,job,job_path)

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("action",choices=["plan","generate","resume"])
    parser.add_argument("--image",type=Path)
    parser.add_argument("--job",type=Path,default=Path("data/private-lux3d-job.json"))
    parser.add_argument("--version",choices=["G1","G1-Turbo"],default="G1-Turbo")
    parser.add_argument("--face-count",type=int,default=20000)
    parser.add_argument("--predict-size",action="store_true")
    parser.add_argument("--execute",action="store_true")
    parser.add_argument("--allow-paid",action="store_true")
    parser.add_argument("--approved-demo-material",action="store_true")
    args=parser.parse_args()
    if not 10000<=args.face_count<=300000:parser.error("face-count outside documented bounds")
    if args.action!="resume":
        if args.image is None:parser.error("--image required")
        plan=make_plan(args.image,args.version,args.face_count,args.predict_size)
    else:plan=json.loads(args.job.read_text())
    if args.action=="plan" or not args.execute:
        print(json.dumps({"mode":"PLAN_ONLY_NO_NETWORK",
            "input_sha256":plan.get("input_sha256"),
            "version":plan.get("version"),"ai_predict_size":plan.get("ai_predict_size"),
            "provider_task_id":plan.get("provider_task_id"),
            "note":"No spend estimate inferred. Confirm actual charge/rights; crop/remove private data."},indent=2))
        return
    if args.action=="generate" and not(args.allow_paid and args.approved_demo_material):
        parser.error("generation requires --allow-paid and --approved-demo-material")
    if not os.getenv("AHOLO_API_KEY"):parser.error("AHOLO_API_KEY required in local environment")
    from manycore.aholo_sdk_lux3d import create_lux3d_client
    client=create_lux3d_client(region="cn")
    if args.action=="resume":
        if not plan.get("provider_task_id"):parser.error("Unknown submission: verify provider history manually")
        result=finish_wait(client,plan,args.job)
    else:result=generate(client,args.image,args.job,plan)
    print(json.dumps({"status":result["status"],"provider_task_id":result["provider_task_id"],
                      "note":"Private result is in the job file; download promptly, validate and calibrate."}))
if __name__=="__main__":
    try:main()
    except Exception as exc:
        # Do not print provider messages/stack traces that may contain signed URLs or keys.
        raise SystemExit("STOP "+type(exc).__name__+": inspect the private job record; do not recreate blindly")
