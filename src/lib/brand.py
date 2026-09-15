"""Roteamento de marca (livo/livonius) e normalização de canais.

Replica a lógica dos nós Code do n8n:
- normalizeChannels: mapeia strings livres para o conjunto canônico.
- marca: decidida pelo Curador; heurística de fallback por RCO/Casco Ônibus.
"""
from __future__ import annotations

VALID_CHANNELS = ["instagram", "facebook", "linkedin", "blog", "newsletter"]

_CHANNEL_ALIASES = {
    "instagram": "instagram",
    "insta": "instagram",
    "ig": "instagram",
    "facebook": "facebook",
    "fb": "facebook",
    "linkedin": "linkedin",
    "blog": "blog",
    "site": "blog",
    "artigo": "blog",
    "newsletter": "newsletter",
    "news": "newsletter",
}


def normalize_channels(value: str | list[str] | None) -> list[str]:
    """Normaliza canais para o conjunto canônico, deduplicando e preservando ordem."""
    if isinstance(value, list):
        raw = value
    else:
        raw = [p.strip() for p in str(value or "").split(",") if p.strip()]

    out: list[str] = []
    seen: set[str] = set()
    for v in raw:
        mapped = _CHANNEL_ALIASES.get(str(v).strip().lower())
        if mapped and mapped not in seen:
            seen.add(mapped)
            out.append(mapped)
    return out


def infer_marca(text: str, *, default: str = "livo") -> str:
    """Heurística de fallback: RCO / Casco Ônibus → livonius; senão o default."""
    low = (text or "").lower()
    eh_rco = "rco" in low or "responsabilidade civil" in low
    eh_casco = "casco" in low and ("onibus" in low or "ônibus" in low)
    if eh_rco or eh_casco:
        return "livonius"
    return default


def normalize_marca(value: str | None) -> str | None:
    v = (value or "").strip().lower()
    return v if v in {"livo", "livonius"} else None
