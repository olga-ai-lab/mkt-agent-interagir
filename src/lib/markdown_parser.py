"""Extrai título, resumo e conteúdo do output (markdown) do Redator.

Replica o nó Extrair_Titulo_Resumo do n8n:
- 1ª linha significativa (H1/H2 ou **negrito**) → título;
- 2ª linha curta (< 200 chars) → resumo;
- restante → conteúdo (removendo rótulo "Introdução" residual).
"""
from __future__ import annotations

import re


def _clean_heading(line: str) -> str:
    line = line.strip()
    line = re.sub(r"^#{1,3}\s+", "", line)
    m = re.match(r"^\*\*(.+)\*\*$", line)
    if m:
        return m.group(1).strip()
    return line


def parse_redator_output(md: str) -> dict[str, str]:
    md = (md or "").replace("\r\n", "\n")
    lines = [ln for ln in md.split("\n") if ln.strip()]
    if not lines:
        return {"titulo": "", "resumo": "", "conteudo": ""}

    titulo = ""
    resumo = ""
    idx = 0

    first = lines[0].strip()
    if re.match(r"^#{1,3}\s+", first) or re.match(r"^\*\*(.+)\*\*$", first):
        titulo = _clean_heading(first)
        idx = 1
    else:
        titulo = first
        idx = 1

    if idx < len(lines):
        second = lines[idx].strip()
        if re.match(r"^#{1,3}\s+", second) or re.match(r"^\*\*(.+)\*\*$", second):
            resumo = _clean_heading(second)
            idx += 1
        elif second and len(second) < 200:
            resumo = second
            idx += 1

    conteudo = "\n".join(lines[idx:]).strip()
    conteudo = re.sub(r"^###?\s*Introdução\s*\n+", "", conteudo, flags=re.IGNORECASE)
    conteudo = conteudo.lstrip("\n")

    if not titulo and conteudo:
        titulo = conteudo[:80].split("\n")[0].strip()

    return {"titulo": titulo, "resumo": resumo, "conteudo": conteudo}
