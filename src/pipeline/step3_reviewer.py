"""Revisor Final — gate de qualidade (brand compliance + anti-plágio).

Como no n8n, o Revisor NÃO reescreve: ele apenas aprova ou reprova. O conteúdo
que segue para o Designer/Publicação é sempre o output do Redator. Se reprovar,
levantamos ReviewRejected e a geração termina como 'failed' (não publica peça ruim).

Aprovação: output contém REVISADO_OK ou "APROVADO COM AJUSTES".
Reprovação: output contém PRECISA_CORRECAO (ou REPROVADO / NÃO APROVADO).
"""
from __future__ import annotations

import logging

from ..clients.openai_client import call_openai
from ..config import OPENAI_REVISOR_MODEL
from ..repositories import skills

logger = logging.getLogger(__name__)

_SYSTEM_HEADER = (
    "Você é o revisor final de conteúdo das marcas Livonius e Livo. Aplique os "
    "checklists das skills abaixo (brand compliance + anti-plágio) e emita um veredito. "
    "Você NÃO reescreve o texto — apenas aprova, aprova com ajustes ou reprova."
)


class ReviewRejected(Exception):
    """Revisor reprovou o conteúdo — não deve virar post."""

    def __init__(self, feedback: str):
        super().__init__(feedback)
        self.feedback = feedback


def review(*, marca: str, plataforma: str, redator_output: str) -> dict[str, str]:
    """Roda o Revisor. Retorna {veredito, raw}. Levanta ReviewRejected se reprovado."""
    system = skills.build_prompt(skills.REVISOR_SKILLS, header=_SYSTEM_HEADER)

    user = f"""Revise este conteúdo para publicação:

**Marca:** {marca}
**Plataforma:** {plataforma or 'blog'}

CONTEÚDO:
{redator_output}

CHECKLIST (aplique brand compliance nos blocos A/B/C/D + anti-plágio):
- Técnico: fonte primária verificável? dados com fonte? termos corretos? sem contradições?
- Linguagem: tom consultivo (não vendedor)? clara? sem jargão? sem promessas indevidas?
- Estrutura: headline claro? introdução contextualiza? corpo com insights? CTA sem pressão?
- Marca: nome grafado corretamente? sem comparação direta com concorrentes? sem superlativo vazio?
- Originalidade: sem parágrafos copiados de release? argumentação própria?

SAÍDA:
{{VEREDITO}}: APROVADO / APROVADO COM AJUSTES / REPROVADO
{{CHECKLIST}}: resultado resumido de cada bloco
{{CORREÇÕES}}: lista (se aplicável)
{{OBSERVAÇÕES}}: notas

Se APROVADO ou APROVADO COM AJUSTES, inclua REVISADO_OK no INÍCIO da resposta.
Se REPROVADO, inclua PRECISA_CORRECAO no INÍCIO da resposta."""

    raw = call_openai(
        system, user, model=OPENAI_REVISOR_MODEL, temperature=0.3, max_tokens=1500, gen_name="revisor"
    )
    up = raw.upper()
    aprovado = "REVISADO_OK" in up or "APROVADO COM AJUSTES" in up
    reprovado = "PRECISA_CORRECAO" in up or (not aprovado and ("REPROVADO" in up or "NÃO APROVADO" in up or "NAO APROVADO" in up))

    if reprovado or not aprovado:
        logger.info("Revisor → REPROVADO")
        raise ReviewRejected(raw.strip()[:800])

    logger.info("Revisor → APROVADO")
    return {"veredito": "aprovado", "raw": raw.strip()}
