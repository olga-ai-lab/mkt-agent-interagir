"""Handoff — POST para a Edge Function interagir-receive-n8n-upload.

Esta é a ÚNICA porta de entrada de mkt_social_posts (grava status IN_REVIEW_INTERNAL).
Payload idêntico ao nó Publish_Edge_Function1 do n8n. Mantido em Edge Function, como pedido.
"""
from __future__ import annotations

import logging
from typing import Any

import httpx

from ..config import RECEIVE_UPLOAD_EF, SUPABASE_ANON_KEY

logger = logging.getLogger(__name__)

HANDOFF_TIMEOUT = 60.0


def handoff(
    *,
    title: str,
    content: str,
    excerpt: str,
    marca: str,
    media: dict,
    image_prompt: str,
    channels: list[str],
    origem: str,
    pauta_id: int | None = None,
    observacoes: str | None = None,
    link_referencia: str | None = None,
) -> str:
    """POSTa o post pronto e retorna o post_id criado pela Edge Function."""
    if not SUPABASE_ANON_KEY:
        raise RuntimeError("SUPABASE_ANON_KEY não configurada — Edge Function exige auth")
    if not media.get("file_url"):
        raise ValueError("handoff: file_url ausente (imagem não gerada)")

    payload: dict[str, Any] = {
        "file_url": media.get("file_url"),
        "file_urls": media.get("file_urls") or [],
        "base_file_url": media.get("base_file_url"),
        "base_file_urls": media.get("base_file_urls") or [],
        "content": content,
        "title": title,
        "company": marca or "livonius",
        "excerpt": excerpt,
        "origem": origem or "rss",
        "pauta_id": pauta_id,
        "channels": channels or [],
        "observacoes": observacoes,
        "link_referencia": link_referencia,
        "image_prompt": image_prompt,
    }

    headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
        "Content-Type": "application/json",
    }

    logger.info("Handoff → POST %s (marca=%s, pauta=%s, channels=%s)", RECEIVE_UPLOAD_EF, marca, pauta_id, channels)
    with httpx.Client(timeout=HANDOFF_TIMEOUT) as client:
        resp = client.post(RECEIVE_UPLOAD_EF, json=payload, headers=headers)
        if resp.status_code >= 400:
            logger.error("interagir-receive-n8n-upload HTTP %d: %s", resp.status_code, resp.text[:500])
            resp.raise_for_status()
        body = resp.json()

    post_id = body.get("post_id") or body.get("id")
    if not post_id:
        raise RuntimeError(f"Edge Function não devolveu post_id: {body}")
    logger.info("Handoff ← post_id=%s status=%s", post_id, body.get("status", "?"))
    return str(post_id)
