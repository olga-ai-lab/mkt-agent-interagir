"""Parsing do output (markdown) do Curador.

O Curador devolve um bloco de texto formatado começando com
`STATUS: APROVADO | Score: X | Vertical: ... | Marca: ...`. Extraímos a decisão
de aprovação, marca e vertical, replicando os nós Extrair_Decisao_Curador do n8n.
"""
from __future__ import annotations

import re

from . import brand


class CuradorRejected(Exception):
    """Curador decidiu NÃO APROVADO — decisão editorial, não erro técnico."""

    def __init__(self, razao: str, raw: str = ""):
        super().__init__(razao)
        self.razao = razao
        self.raw = raw


def is_rejected(output: str) -> bool:
    up = (output or "").upper()
    return "NÃO APROVADO" in up or "NAO APROVADO" in up


def _extract_motivo(output: str) -> str:
    m = re.search(r"MOTIVO:\s*(.+)", output, re.IGNORECASE)
    return m.group(1).strip() if m else "(sem motivo informado)"


def parse_decision(
    output: str,
    *,
    fallback_marca: str = "livo",
    pauta_marca: str | None = None,
) -> dict[str, str]:
    """Retorna {aprovado, marca, vertical, curador_output, razao?}.

    Ordem de decisão de marca (igual ao n8n):
    1. marca válida vinda da pauta (quando existir);
    2. marca explícita no output do Curador ("Marca: livonius|livo");
    3. heurística RCO/Casco Ônibus → livonius, senão fallback.
    """
    output = output or ""
    if is_rejected(output):
        raise CuradorRejected(_extract_motivo(output), raw=output)

    marca_pauta = brand.normalize_marca(pauta_marca)

    marca_curador = None
    m = re.search(r"Marca:\s*(livonius|livo)", output, re.IGNORECASE)
    if m:
        marca_curador = m.group(1).lower()

    vertical = "geral"
    mv = re.search(r"Vertical:\s*([^|*\n]+)", output, re.IGNORECASE)
    if mv:
        vertical = mv.group(1).strip().lower()

    marca = marca_pauta or marca_curador
    if not marca:
        marca = brand.infer_marca(f"{vertical} {output}", default=fallback_marca)

    return {
        "aprovado": "true",
        "marca": marca,
        "vertical": vertical,
        "curador_output": output.strip(),
    }
