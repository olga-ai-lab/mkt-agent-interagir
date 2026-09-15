"""Dedup + registro de curadoria em mkt_marketing_blog_content.

No n8n esta tabela é o índice de links já processados (por RSS/pauta). Antes de
curar um link, checa-se se ele já existe; ao final da curadoria, grava-se o
resultado (aprovado / nao_aprovado) para evitar reprocessamento futuro.

Colunas usadas: link, message, created_at, status.
"""
import logging
from typing import Any

from ..clients.supabase_client import get_supabase

logger = logging.getLogger(__name__)


def link_exists(link: str) -> bool:
    """True se o link já foi curado antes (dedup)."""
    if not link:
        return False
    sb = get_supabase()
    res = (
        sb.table("mkt_marketing_blog_content")
        .select("id")
        .eq("link", link)
        .limit(1)
        .execute()
    )
    return bool(res.data)


def save_result(
    *,
    link: str,
    message: str,
    status: str,
    created_at: str | None = None,
) -> None:
    """Grava o output do Curador para o link. status ∈ {aprovado, nao_aprovado}."""
    if not link:
        return
    payload: dict[str, Any] = {"link": link, "message": message, "status": status}
    if created_at:
        payload["created_at"] = created_at
    sb = get_supabase()
    try:
        sb.table("mkt_marketing_blog_content").insert(payload).execute()
    except Exception as e:
        logger.warning("blog_content.save_result falhou para %s: %s", link, e)
