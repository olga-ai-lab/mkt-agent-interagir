"""Leitura de feeds RSS + normalização/filtragem (replica os nós RSS do n8n).

Fluxo do n8n: 2 feeds (livo + livonius) → merge → shuffle → filtra inválidos →
normaliza. Aqui expomos helpers equivalentes.
"""
from __future__ import annotations

import html
import random
import re
import xml.etree.ElementTree as ET

import httpx

TAG_RE = re.compile(r"<[^>]+>")

# Títulos/links de lixo a descartar (Filtrar RSS Invalido do n8n).
_JUNK_TERMS = ["share this", "email-protection", "cdn-cgi", "mailto:", "javascript:"]


def _strip_html(text: str | None) -> str:
    if not text:
        return ""
    return html.unescape(TAG_RE.sub(" ", text)).strip()


def fetch_entries(feed_url: str, *, limit: int = 40, timeout: float = 15.0) -> list[dict[str, str]]:
    """Baixa um feed RSS/Atom e normaliza itens mínimos."""
    resp = httpx.get(feed_url, timeout=timeout, follow_redirects=True)
    resp.raise_for_status()

    root = ET.fromstring(resp.text)
    entries: list[dict[str, str]] = []

    channel = root.find("channel")
    if channel is not None:
        for item in channel.findall("item")[:limit]:
            link = (item.findtext("link") or item.findtext("guid") or "").strip()
            title = (item.findtext("title") or "").strip()
            snippet = _strip_html(item.findtext("description") or item.findtext("summary"))
            pub = (item.findtext("pubDate") or "").strip()
            if link and title:
                entries.append(
                    {"link": link, "title": title, "content": snippet[:1500], "pubDate": pub, "feed_url": feed_url}
                )
        return entries

    ns = {"atom": "http://www.w3.org/2005/Atom"}
    for item in root.findall("atom:entry", ns)[:limit]:
        link_node = item.find("atom:link", ns)
        link = (link_node.get("href") if link_node is not None else "") or ""
        title = (item.findtext("atom:title", "", ns) or "").strip()
        snippet = _strip_html(item.findtext("atom:summary", "", ns))
        pub = (item.findtext("atom:updated", "", ns) or "").strip()
        if link and title:
            entries.append(
                {"link": link.strip(), "title": title, "content": snippet[:1500], "pubDate": pub, "feed_url": feed_url}
            )
    return entries


def is_valid_entry(entry: dict[str, str]) -> bool:
    """Descarta itens sem título/link/conteúdo ou com termos de lixo."""
    title = (entry.get("title") or "").lower()
    link = (entry.get("link") or "").lower()
    if len(title) < 5:
        return False
    if any(t in title for t in _JUNK_TERMS):
        return False
    if not link or "email-protection" in link or "cdn-cgi" in link:
        return False
    if not (entry.get("content") or "").strip():
        return False
    return True


def fetch_and_merge(feed_urls: list[str], *, limit_per_feed: int = 40, shuffle: bool = True) -> list[dict[str, str]]:
    """Baixa vários feeds, mescla, filtra inválidos e (opcional) embaralha."""
    merged: list[dict[str, str]] = []
    for url in feed_urls:
        try:
            merged.extend(fetch_entries(url, limit=limit_per_feed))
        except Exception:
            continue
    valid = [e for e in merged if is_valid_entry(e)]
    if shuffle:
        random.shuffle(valid)
    return valid
