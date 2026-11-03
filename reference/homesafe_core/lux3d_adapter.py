"""Injectable SDK seam; tested with fakes only, NOT live verified.

Production orchestration, durable submission recovery and download policy must
be implemented separately according to docs/06-lux3d-runbook.md.
"""
from dataclasses import dataclass
from typing import Any

STATUS = {0:"provider_pending", 1:"provider_running", 3:"provider_succeeded",
          4:"provider_failed", 6:"provider_cancelled"}

@dataclass(frozen=True)
class ProviderTask:
    task_id: str
    status: str
    raw_status: int | None
    outputs: tuple[dict[str, Any], ...]

class AholoSdkGateway:
    def __init__(self, client: Any, *, allow_paid_calls: bool=False):
        self.client = client
        self.allow_paid_calls = allow_paid_calls

    def create_image_task(self, *, image_url: str, version: str="G1-Turbo", face_count: int=20_000, ai_predict_size: bool=False) -> str:
        if not self.allow_paid_calls:
            raise PermissionError("Paid generation disabled; explicit budget approval required")
        if version not in {"G1","G1-Turbo"}:
            raise ValueError("unsupported version")
        if isinstance(face_count,bool) or not isinstance(face_count,int) or not 10_000 <= face_count <= 300_000:
            raise ValueError("face_count outside documented bounds")
        if type(ai_predict_size) is not bool:
            raise ValueError("ai_predict_size must be explicit boolean")
        if not image_url.startswith("https://"):
            raise ValueError("registered HTTPS input required")
        # Upload authorization, URL trust and budget enforcement belong upstream.
        task_id = self.client.img_to_3d.create(img=image_url, version=version,
            face_count=face_count, output_format=["glb"], ai_predict_size=ai_predict_size)
        if isinstance(task_id,bool) or not isinstance(task_id,(str,int)) or not str(task_id).isascii() or not str(task_id).isdigit() or int(task_id) <= 0:
            raise ValueError("unexpected task id; reconcile provider before resubmitting")
        return str(task_id)

    def retrieve_task(self, task_id: str) -> ProviderTask:
        if not isinstance(task_id, str) or not task_id.isascii() or not task_id.isdecimal() or int(task_id) <= 0:
            raise ValueError("task id must be decimal digits")
        raw = self.client.tasks.retrieve(int(task_id))
        if not isinstance(raw,dict):
            raise ValueError("unexpected provider response; manual review required")
        returned = raw.get("taskId")
        valid_id = type(returned) is int or (type(returned) is str and returned.isascii() and returned.isdecimal())
        if not valid_id or int(returned) != int(task_id):
            return ProviderTask(task_id,"manual_review",None,())
        status = raw.get("status")
        normalized = STATUS.get(status,"manual_review") if type(status) is int else "manual_review"
        outputs = raw.get("outputs") or []
        if not isinstance(outputs,list) or any(not isinstance(o,dict) for o in outputs):
            raise ValueError("unexpected provider outputs")
        if normalized == "provider_succeeded" and not any(isinstance(o.get("content"),str) and o["content"].startswith("https://") for o in outputs):
            normalized = "manual_review"
        return ProviderTask(task_id,normalized,status if type(status) is int else None,tuple(outputs))
