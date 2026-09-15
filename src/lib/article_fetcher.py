"""Fetcher de artigo a partir de URL via trafilatura (extração focada em main content)."""
import logging

import httpx
import trafilatura

logger = logging.getLogger(__name__)

DEFAULT_TIMEOUT = 20.0
USER_AGENT = "Mozilla/5.0 (compatible; MktAgentLivo/1.0; +https://livonius.com.br)"
MAX_CHARS = 8000  # corta texto longo pra não estourar context da Claude


class ArticleFetchError(RuntimeError):
    """Falha tecnica ao baixar ou extrair a materia fonte."""


def fetch_article(url: str, *, timeout: float = DEFAULT_TIMEOUT) -> str:
    """Baixa a página e retorna texto limpo.

    Se der erro de rede/status HTTP ou a extração vier vazia, levanta
    ArticleFetchError para impedir publicação baseada só em título/snippet.
    """
    try:
        with httpx.Client(
            follow_redirects=True,
            timeout=timeout,
            headers={"User-Agent": USER_AGENT},
        ) as client:
            r = client.get(url)
            r.raise_for_status()
            html = r.text
    except Exception as e:
        logger.warning("article_fetcher: download falhou em %s — %s", url, e)
        raise ArticleFetchError(f"download falhou para {url}: {e}") from e

    extracted = trafilatura.extract(
        html,
        include_comments=False,
        include_tables=False,
        favor_recall=False,
    ) or ""

    if not extracted.strip():
        raise ArticleFetchError(f"extracao vazia para {url}")

    return extracted[:MAX_CHARS]
