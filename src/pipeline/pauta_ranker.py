"""AI Ranker de pauta — seleciona os N artigos de RSS mais relevantes para uma pauta.

Equivale ao nó AI Ranker Pauta1 do n8n. Recebe a pauta + os artigos agregados do
RSS e devolve os índices selecionados + ângulo editorial. Usa as skills de matriz
de seleção e pilares de conteúdo como base.
"""
from __future__ import annotations

import json
import logging
import re

from ..clients.openai_client import call_openai
from ..config import OPENAI_RANKER_MODEL, RANKER_SELECT_COUNT
from ..repositories import skills

logger = logging.getLogger(__name__)

_SYSTEM_HEADER = (
    "Você é um curador editorial de insurtech/seguros. Selecione os artigos de RSS "
    "mais relevantes para enriquecer uma pauta definida pela equipe, usando as skills "
    "de matriz de seleção e pilares de conteúdo como base."
)


def rank(
    *,
    pauta_titulo: str,
    pauta_briefing: str,
    pauta_link: str,
    artigos: list[dict[str, str]],
    select: int = RANKER_SELECT_COUNT,
) -> dict:
    """Retorna {indices_selecionados, angulo_editorial, justificativa}."""
    if not artigos:
        return {"indices_selecionados": [], "angulo_editorial": "", "justificativa": "sem artigos"}

    system = skills.build_prompt(
        ["curador_matriz_selecao", "curador_pilares_conteudo"], header=_SYSTEM_HEADER
    )
    lista = "\n\n".join(
        f"[{i}] TÍTULO: {a.get('title', '')}\nRESUMO: {a.get('content', '')}\nLINK: {a.get('link', '')}"
        for i, a in enumerate(artigos)
    )
    user = f"""PAUTA EDITORIAL:
Título: {pauta_titulo}
Briefing: {pauta_briefing}
Link de referência: {pauta_link}

ARTIGOS DISPONÍVEIS NO RSS:
{lista}

Selecione os {select} artigos com MAIOR potencial de enriquecer a pauta (fit com a
vertical correta, score alto, riqueza de dados, ângulo que conecta com a pauta).
Se nenhum for relevante, retorne os {select} mais próximos e sinalize na justificativa.

FORMATO DE RESPOSTA (JSON puro, sem markdown, sem texto antes/depois):
{{"indices_selecionados": [0, 3, 7], "angulo_editorial": "uma frase", "justificativa": "por quê"}}"""

    raw = call_openai(system, user, model=OPENAI_RANKER_MODEL, temperature=0.4, max_tokens=800, gen_name="ranker")
    return _parse(raw, select=select)


def _parse(raw: str, *, select: int) -> dict:
    clean = re.sub(r"```json|```", "", raw or "").strip()
    m = re.search(r"\{[\s\S]*\}", clean)
    try:
        parsed = json.loads(m.group(0) if m else clean)
    except (json.JSONDecodeError, AttributeError) as e:
        logger.warning("Ranker parse falhou (%s) — fallback aos primeiros %d", e, select)
        return {
            "indices_selecionados": list(range(select)),
            "angulo_editorial": "",
            "justificativa": f"fallback por erro de parse: {e}",
        }
    idx = parsed.get("indices_selecionados") or list(range(select))
    return {
        "indices_selecionados": [i for i in idx if isinstance(i, int)],
        "angulo_editorial": parsed.get("angulo_editorial", ""),
        "justificativa": parsed.get("justificativa", ""),
    }
