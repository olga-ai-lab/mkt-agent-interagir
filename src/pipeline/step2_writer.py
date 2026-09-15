"""Redator Sênior — produz o conteúdo (markdown) a partir da decisão do Curador.

System prompt = skill de tom da marca (redator_tom_livo|livonius) + persona do
corretor + contexto de mercado MGA + enriquecimento de dados + performance
histórica. User message = decisão do Curador + artigo + regras de formato por
plataforma + dados de performance. Saída: texto pronto para publicação (markdown).
"""
from __future__ import annotations

import logging

from ..clients.openai_client import call_openai
from ..config import OPENAI_REDATOR_MODEL
from ..repositories import analytics, skills

logger = logging.getLogger(__name__)

_SYSTEM_HEADER = (
    "Você é um redator sênior de conteúdo para o mercado de seguros brasileiro. "
    "A decisão de marca JÁ FOI TOMADA pelo Curador — use exatamente a marca informada, "
    "com o tom da skill correspondente. Escreva para o corretor de seguros como público "
    "central. Use as skills abaixo como base de tom, persona, mercado e dados."
)

_FORMAT_RULES_BLOG = """FORMATO OBRIGATÓRIO — BLOG:
- 500 a 850 palavras. Estrutura: HEADLINE (máx 70 chars) + SUBTÍTULO (máx 120) +
  INTRODUÇÃO (2-3 parágrafos) + CORPO (4-6 seções com subtítulos, 1 dado com fonte e 1
  exemplo prático fluido por seção) + CTA. Markdown: ## para subtítulos, ** só em
  dados-chave (máx 3-4 por seção). Nunca use * itálico, --- ou tabelas."""

_FORMAT_RULES_LINKEDIN = """FORMATO OBRIGATÓRIO — LINKEDIN:
- 500 a 700 caracteres. Gancho magnético nas 2 primeiras linhas (dor/oportunidade,
  nunca contexto histórico). Parágrafos curtos. CTA com UMA pergunta aberta. ZERO Markdown."""

_FORMAT_RULES_INSTAGRAM = """FORMATO OBRIGATÓRIO — INSTAGRAM:
- 400 a 700 caracteres. ZERO Markdown (exceto as hashtags finais). ZERO estrutura de blog
  (sem ##, sem múltiplas seções com subtítulo).
- Primeira linha (gancho) em CAIXA ALTA, até ~125 caracteres.
- Emoji — limite rígido: NO MÁXIMO 2 em todo o texto. Um junto ao gancho na primeira
  linha, e opcionalmente mais um no CTA final. Os parágrafos do meio (desenvolvimento)
  NÃO levam emoji nenhum.
- Estrutura: gancho em caixa alta → fato+gap → quebra de linha → conteúdo direto →
  CTA com pergunta sugestiva ou chamada direta.
- CTA: use algo direto como "Saiba mais", "Fale com a gente" ou "Fale com um corretor".
  NUNCA peça para comentar uma palavra-código (ex.: "Comenta 'FROTA'").
- 8-15 hashtags ao final."""

_FORMAT_RULES_FACEBOOK = """FORMATO OBRIGATÓRIO — FACEBOOK:
- 400 a 700 caracteres. ZERO Markdown. ZERO estrutura de blog (sem ##, sem múltiplas
  seções com subtítulo).
- Primeira linha (gancho) em CAIXA ALTA, até ~125 caracteres.
- Emoji — limite rígido: NO MÁXIMO 2 em todo o texto. Um junto ao gancho na primeira
  linha, e opcionalmente mais um no CTA final. Os parágrafos do meio (desenvolvimento)
  NÃO levam emoji nenhum.
- Tom conversacional e próximo da comunidade, incentivando interação.
- CTA: use algo direto como "Saiba mais", "Fale com a gente" ou "Fale com um corretor".
  NUNCA peça para comentar uma palavra-código (ex.: "Comenta 'FROTA'")."""

_FORMAT_RULES_BY_PLATAFORMA: dict[str, str] = {
    "blog": _FORMAT_RULES_BLOG,
    "linkedin": _FORMAT_RULES_LINKEDIN,
    "instagram": _FORMAT_RULES_INSTAGRAM,
    "facebook": _FORMAT_RULES_FACEBOOK,
}

_QUALITY_RULES = """REGRAS DE QUALIDADE:
1. 1-2 dados/estatísticas com fonte por seção. 2. Conecte com as DORES do corretor.
3. Tom consultivo e educativo, NUNCA vendedor. 4. NUNCA escreva rótulos estruturais
   ("HEADLINE:", "GANCHO:", etc.) — entregue o texto como se já estivesse publicado.
5. Sem clichês ("neste cenário", "é fundamental", "nos dias de hoje"). 6. Nunca invente
   dado. 7. Mencione a marca no máximo 1-2 vezes, de forma natural. 8. Insira exemplos
   de forma fluida (nunca "Exemplo prático:"). 9. Priorize insights ACIONÁVEIS.
10. Inclua hashtags/tags relevantes ao final conforme a vertical.

SAÍDA:
Entregue o texto limpo do conteúdo. Primeira linha = título; segunda linha = subtítulo/
resumo curto; em seguida o corpo, separado por quebras de linha duplas."""


def _format_rules_for(plataforma: str) -> str:
    """Regra de UMA plataforma só — nunca um menu 'SE X/SE Y' para o modelo escolher.

    O código já sabe a plataforma efetiva; pedir para o modelo selecionar entre um menu
    de opções (buried no fim de uma mensagem longa) enfraquece a aderência ao formato.
    """
    rules = _FORMAT_RULES_BY_PLATAFORMA.get(plataforma, _FORMAT_RULES_BLOG)
    return f"{rules}\n\n{_QUALITY_RULES}"


def _performance_block(marca: str) -> str:
    rows = analytics.top_performance(channel="instagram", limit=5)
    if not rows:
        return "(sem dados de performance suficientes — use a estrutura padrão da skill de tom)"
    linhas = [
        f"- post {r.get('post_id')}: reach={r.get('reach')} saves={r.get('saves')} shares={r.get('shares')}"
        for r in rows
    ]
    return "\n".join(linhas)


def write(
    *,
    marca: str,
    vertical: str,
    plataforma: str,
    curador_output: str,
    article_text: str,
    briefing: str = "",
) -> str:
    """Roda o Redator e retorna o texto (markdown) pronto para revisão."""
    plataforma_efetiva = (plataforma or "blog").strip().lower()
    format_rules = _format_rules_for(plataforma_efetiva)

    skill_ids = [skills.tom_skill_id(marca), *skills.REDATOR_SKILLS]
    # A regra de formato entra também no SYSTEM (não só no fim do user, que pode ficar
    # longo com o artigo inteiro) — reforça que o formato da plataforma tem prioridade
    # sobre qualquer estrutura "padrão" que as skills de tom sugiram.
    system = skills.build_prompt(skill_ids, header=_SYSTEM_HEADER) + f"\n\n{format_rules}"

    user = f"""Fonte (decisão do Curador):
{curador_output}

**Marca:** {marca}
**Vertical:** {vertical}
**Plataforma:** {plataforma_efetiva}
{f'**Briefing da pauta:** {briefing}' if briefing else ''}

⚠️ ATENÇÃO: esta peça é EXCLUSIVAMENTE para {plataforma_efetiva.upper()}. Siga à risca o
FORMATO OBRIGATÓRIO — {plataforma_efetiva.upper()} definido no system prompt. Se a
plataforma não for "blog", o texto NÃO PODE ter estrutura de blog (nada de ## ou
múltiplas seções com subtítulo).

# ARTIGO / MATERIAL BASE
{article_text or '(sem artigo — use a decisão do Curador)'}

# PERFORMANCE HISTÓRICA (Instagram — top por saves)
{_performance_block(marca)}

Lembrete final — FORMATO OBRIGATÓRIO — {plataforma_efetiva.upper()}:
{format_rules}"""

    text = call_openai(
        system, user, model=OPENAI_REDATOR_MODEL, temperature=None, max_tokens=6000, gen_name="redator"
    )
    logger.info("Redator → %d chars (marca=%s, plataforma=%s)", len(text), marca, plataforma)
    return text.strip()
