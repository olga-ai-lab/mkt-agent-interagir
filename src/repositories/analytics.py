"""Leitura de mkt_post_analytics + mkt_social_posts para o Redator/Designer.

- performance_historica: top posts por saves (skill redator_performance_historica).
- recent_image_prompts: prompts visuais recentes por marca, para o Designer não
  repetir composições (equivale ao Buscar_Prompts_Recentes do n8n).
"""
import logging
from typing import Any

from ..clients.supabase_client import get_supabase

logger = logging.getLogger(__name__)


def top_performance(*, channel: str = "instagram", limit: int = 5) -> list[dict[str, Any]]:
    """Top posts por saves (proxy de conteúdo útil). Falha silenciosa → []."""
    try:
        sb = get_supabase()
        res = (
            sb.table("mkt_post_analytics")
            .select("post_id,reach,likes,saves,shares,comments")
            .eq("channel", channel)
            .order("saves", desc=True, nullsfirst=False)
            .limit(limit)
            .execute()
        )
        return res.data or []
    except Exception as e:
        logger.debug("top_performance falhou: %s", e)
        return []


def recent_image_prompts(*, marca: str, limit: int = 5) -> list[str]:
    """Prompts visuais recentes da marca (para evitar repetição no Designer)."""
    try:
        sb = get_supabase()
        res = (
            sb.table("mkt_social_posts")
            .select("image_prompt")
            .eq("company", marca)
            .not_.is_("image_prompt", "null")
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        rows = res.data or []
        return [r["image_prompt"] for r in rows if r.get("image_prompt")]
    except Exception as e:
        logger.debug("recent_image_prompts falhou: %s", e)
        return []
