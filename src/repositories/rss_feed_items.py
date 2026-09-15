"""Ledger de itens coletados do(s) feed(s) RSS (rss.app) em mkt_rss_feed_items.

Cada link novo passa pela curadoria (step1_curator.curate) antes de virar post.
Este ledger evita reprocessar o mesmo artigo em scans futuros (dedup por
rss_link — único entre os 3 feeds de marca: RSS_FEED_LIVO / RSS_FEED_LIVONIUS /
RSS_FEED_PAUTA) e dá rastro de quais itens foram promovidos/descartados e por quê.
"""
from typing import Any

from ..clients.supabase_client import get_supabase


def exists_for_link(rss_link: str) -> bool:
    if not rss_link:
        return False
    sb = get_supabase()
    res = (
        sb.table("mkt_rss_feed_items")
        .select("id")
        .eq("rss_link", rss_link)
        .limit(1)
        .execute()
    )
    return bool(res.data)


def insert_promoted(
    *,
    feed_url: str,
    rss_link: str,
    title: str,
    snippet: str,
    pauta_id: int | None = None,
    reason: str | None = None,
    pauta_fields: dict[str, Any] | None = None,
) -> None:
    """Curador aprovou o item."""
    sb = get_supabase()
    sb.table("mkt_rss_feed_items").insert(
        {
            "feed_url": feed_url,
            "rss_link": rss_link,
            "title": title,
            "snippet": snippet,
            "ai_status": "promoted",
            "ai_relevant": True,
            "ai_reason": reason,
            "suggested_pauta_fields": pauta_fields,
            "pauta_id": pauta_id,
        }
    ).execute()


def insert_discarded(
    *,
    feed_url: str,
    rss_link: str,
    title: str,
    snippet: str,
    reason: str | None,
) -> None:
    """Curador rejeitou o item — registrado só pra não reavaliar no próximo scan."""
    sb = get_supabase()
    sb.table("mkt_rss_feed_items").insert(
        {
            "feed_url": feed_url,
            "rss_link": rss_link,
            "title": title,
            "snippet": snippet,
            "ai_status": "discarded",
            "ai_relevant": False,
            "ai_reason": reason,
        }
    ).execute()
