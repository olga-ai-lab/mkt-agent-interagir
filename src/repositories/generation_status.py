"""Pipeline status em mkt_post_generation_status.

O frontend (Supabase Realtime) acompanha o campo `status`. Preservamos os
rótulos que o n8n já emitia (reading → extracting → ...) e adicionamos os passos
do agente. 'completed'/'failed' são terminais.
"""
from typing import Any

from ..clients.supabase_client import get_supabase

STATUS_READING = "reading"
STATUS_EXTRACTING = "extracting"
STATUS_CURATING = "curating"
STATUS_WRITING = "writing"
STATUS_REVIEWING = "reviewing"
STATUS_GENERATING_IMAGE = "generating_image"
STATUS_RENDERING = "rendering"
STATUS_CREATING_POST = "creating_post"
STATUS_COMPLETED = "completed"  # terminal
STATUS_FAILED = "failed"  # terminal


def create(generation_id: str, status: str = STATUS_READING) -> None:
    sb = get_supabase()
    try:
        sb.table("mkt_post_generation_status").insert(
            {"generation_id": generation_id, "status": status}
        ).execute()
    except Exception:
        # Se a row já existe (ex.: criada pelo frontend/webhook), apenas atualiza.
        update(generation_id, status)


def update(generation_id: str, status: str, error: str | None = None) -> None:
    payload: dict[str, Any] = {"status": status, "updated_at": "now()"}
    if error:
        payload["error_message"] = error
    sb = get_supabase()
    sb.table("mkt_post_generation_status").update(payload).eq(
        "generation_id", generation_id
    ).execute()


def complete(
    generation_id: str,
    status: str,
    post_id: str | None = None,
    error: str | None = None,
) -> None:
    if status not in {STATUS_COMPLETED, STATUS_FAILED}:
        raise ValueError(f"complete() requires terminal status, got {status!r}")
    payload: dict[str, Any] = {"status": status, "updated_at": "now()"}
    if post_id:
        payload["post_id"] = post_id
    if error:
        payload["error_message"] = error
    sb = get_supabase()
    sb.table("mkt_post_generation_status").update(payload).eq(
        "generation_id", generation_id
    ).execute()
