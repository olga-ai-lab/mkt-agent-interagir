"""Curador — avalia a entrada e decide APROVADO / NÃO APROVADO + marca + vertical.

Três modos (como no n8n):
- rss:     curadoria rigorosa de item de feed (score >= 6 aprova).
- arquivo: curadoria permissiva (conteúdo enviado pela equipe → default aprovar).
- pauta:   curadoria permissiva de artigo pré-selecionado pelo Ranker para uma pauta.

O system prompt é montado a partir das skills do Curador em mkt_agent_skills
(matriz de seleção, detector de fontes, pilares de conteúdo). O user message traz
a entrada + as instruções de decisão específicas do modo.
"""
from __future__ import annotations

import logging

from ..clients.openai_client import call_openai
from ..config import OPENAI_CURADOR_MODEL, OPENAI_CURADOR_PERMISSIVE_MODEL
from ..lib import curador_parser
from ..lib.curador_parser import CuradorRejected  # re-export
from ..repositories import skills

logger = logging.getLogger(__name__)

__all__ = ["curate", "CuradorRejected"]

_SYSTEM_HEADER = (
    "Você é um curador editorial especializado em insurtech, seguros e mercado "
    "segurador brasileiro, atuando para as marcas Livonius (RCO e Casco Ônibus) e "
    "Livo (Saúde, Vida/AP, Garantia, Máquinas Agrícolas, Construção Civil). "
    "Use as skills abaixo como base de regras. A SAÍDA DEVE SER APENAS O OUTPUT "
    "FORMATADO — sem mostrar raciocínio, sem logs de carregamento de skills."
)

_MARCA_TIERS = """DECISÃO DE MARCA (OBRIGATÓRIO — você decide a marca correta pelo CONTEÚDO):
LIVONIUS — quando o tema se encaixa em algum Tier:
  TIER 1 (bônus +1): RCO (Responsabilidade Civil do Operador de ônibus), Casco Ônibus.
  TIER 2: ecossistema de transporte de passageiros, frotas, segurança viária,
    logística/infraestrutura com ângulo de risco/seguro.
  TIER 3 (thought leadership): tendências do mercado segurador, regulação SUSEP/CNSP,
    dores do corretor, modelo MGA, dados do setor.
LIVO — quando o tema envolve as 7 verticais ativas: Seguro Saúde, Vida/AP, Seguro
  Garantia, Máquinas Agrícolas, Construção Civil/Riscos de Engenharia, Seguro Auto,
  Seguro Residencial/Patrimonial (e adjacentes: Open Insurance, ESG, Embedded
  Insurance, tecnologia em seguros, SUSEP/CNSP amplo)."""

_MARCA_TAIL_STRICT = """Se encaixa em ambas → priorize a conexão mais forte. Se em nenhuma → NÃO APROVADO.
Ignore o campo "Marca" do input se ele conflitar com sua análise."""

# Em pauta/arquivo a entrada foi escolhida pela equipe: o encaixe de marca é uma
# CLASSIFICAÇÃO, nunca um motivo de reprovação. Sem isso a regra categórica do modo
# RSS ("se em nenhuma → NÃO APROVADO") vazava para cá e derrubava pautas legítimas,
# contradizendo o "em dúvida, APROVE" logo acima no mesmo prompt.
_MARCA_TAIL_PERMISSIVE = """Se encaixa em ambas → priorize a conexão mais forte.
NUNCA reprove por encaixe de marca/vertical neste modo: a entrada foi definida
intencionalmente pela equipe. Se nenhuma vertical for óbvia, escolha a mais próxima
(default: livo) e siga para APROVADO.
Ignore o campo "Marca" do input se ele conflitar com sua análise."""

_MARCA_RULES = f"{_MARCA_TIERS}\n{_MARCA_TAIL_STRICT}"
_MARCA_RULES_PERMISSIVE = f"{_MARCA_TIERS}\n{_MARCA_TAIL_PERMISSIVE}"

_OUTPUT_APROVADO = """SAÍDA (SE APROVADO):
**STATUS: APROVADO | Score: [X/10] | Vertical: [VERTICAL] | Marca: [livo/livonius] | Tier: [1/2/3]**
**PILAR:** [Educar/Inspirar/Facilitar/Conectar/Reconhecer]
**CANAL RECOMENDADO:** [blog/linkedin/instagram/newsletter]
**URGÊNCIA:** [Imediata 24h / Normal 72h / Evergreen]
**RIQUEZA DE DADOS:** [Rica/Moderada/Pobre]
**RESUMO EXECUTIVO:** [2-3 frases]
**ÂNGULO EDITORIAL:** [perspectiva única da marca]
**INSIGHTS PARA CORRETORES:**
- [Insight 1]
- [Insight 2]
- [Insight 3]
**TIPO DE CONTEÚDO:** [Educacional/Análise Técnica/Alerta/Case Prático/Ferramenta/Storytelling]
**PÚBLICO-ALVO:** [Corretores generalistas/de nicho/Gestores de frota/Empresários]
**HASHTAGS:** #[segmento] #[tema] #[3 específicas]
**CTA SUGERIDO:** [call to action natural]
**IMAGEM RECOMENDADA:** [tipo de imagem + contexto visual]

SAÍDA (SE NÃO APROVADO):
**STATUS: NÃO APROVADO | Score: [X/10] | Vertical: [VERTICAL] | Marca: [que seria]**
**MOTIVO:** [explicação concisa — nunca "fonte não confiável"]
**SUGESTÃO:** [ângulo alternativo, se existir]"""


def _build_system() -> str:
    return skills.build_prompt(skills.CURADOR_SKILLS, header=_SYSTEM_HEADER)


def _user_rss(title: str, content: str, link: str, marca_hint: str, plataforma: str) -> str:
    return f"""Avalie esta notícia para curadoria (MODO: RSS):

ENTRADA:
- Título: {title}
- Conteúdo: {content}
- Fonte: {link}
- Marca sugerida (pode sobrescrever): {marca_hint or '(nenhuma)'}
- Plataforma: {plataforma or 'blog'}

PROCESSO:
1. A fonte vem de RSS curado — NÃO rejeite por causa da fonte. Cheque apenas dados citáveis.
2. Calcule o score pela matriz de seleção (com multiplicador de nicho).
3. TESTE DE RELEVÂNCIA DIRETA: o tema PRINCIPAL tem conexão genuína com seguros/risco/
   mercado do corretor? Se não, aplique -2 no score antes de qualquer multiplicador.
4. Aplique bônus/penalidade de riqueza de dados (+1 Rica, 0 Moderada, -1 Pobre).
5. Veredito: APROVADO (score >= 6) ou NÃO APROVADO (score < 6).

{_MARCA_RULES}

{_OUTPUT_APROVADO}"""


def _user_arquivo(title: str, content: str, items_count: int) -> str:
    return f"""Avalie este conteúdo para curadoria (MODO: ARQUIVO):

ENTRADA:
- Título: {title}
- Conteúdo: {content}
- Fontes: {items_count} arquivo(s)
- Plataforma: blog

REGRA FUNDAMENTAL: este conteúdo foi enviado INTENCIONALMENTE pela equipe. Encontre o
MELHOR ÂNGULO possível. Só retorne NÃO APROVADO se for completamente inútil para QUALQUER
post sobre seguros/risco/corretor. Em caso de dúvida, APROVE.

PROCESSO:
1. Score pela matriz de seleção (com multiplicador de nicho).
2. Bônus automático de +2 por ser arquivo enviado manualmente.
3. Bônus/penalidade de riqueza de dados.
4. TESTE DE RELEVÂNCIA MÍNIMA: há ALGUMA conexão (mesmo tangencial) com seguros, risco,
   mercado financeiro, agro, saúde corporativa, construção ou transporte? Se sim, APROVE.

{_MARCA_RULES_PERMISSIVE}
DEFAULT sem vertical clara mas com ângulo para o corretor: LIVO.

{_OUTPUT_APROVADO}"""


def _user_pauta(
    pauta_titulo: str,
    pauta_briefing: str,
    angulo: str,
    title: str,
    content: str,
    link: str,
) -> str:
    return f"""Avalie este artigo para curadoria (MODO: PAUTA EDITORIAL INTENCIONAL):

ENTRADA:
- Título da pauta: {pauta_titulo}
- Briefing da pauta: {pauta_briefing}
- Ângulo sugerido pelo Ranker: {angulo}
- Artigo título: {title}
- Artigo conteúdo: {content}
- Link: {link}

REGRA FUNDAMENTAL: a pauta foi definida INTENCIONALMENTE pela equipe e o artigo já foi
pré-selecionado pelo Ranker. Encontre o MELHOR ÂNGULO conectando artigo e pauta. Só
retorne NÃO APROVADO se for impossível estabelecer qualquer conexão útil. Em dúvida, APROVE.

PROCESSO:
1. Score pela matriz de seleção. 2. Bônus +2 por pauta intencional pré-selecionada.
3. Bônus/penalidade de riqueza de dados. 4. Teste de relevância para a pauta.

{_MARCA_RULES_PERMISSIVE}
DEFAULT sem vertical clara mas com ângulo para o corretor: LIVO.

{_OUTPUT_APROVADO}"""


def curate(
    *,
    source_type: str,
    title: str,
    content: str,
    link: str = "",
    marca_hint: str = "",
    plataforma: str = "blog",
    pauta_marca: str | None = None,
    pauta_titulo: str = "",
    pauta_briefing: str = "",
    angulo: str = "",
    items_count: int = 1,
) -> dict[str, str]:
    """Roda o Curador no modo apropriado. Levanta CuradorRejected se reprovar."""
    system = _build_system()

    if source_type == "arquivo":
        user = _user_arquivo(title, content, items_count)
        model = OPENAI_CURADOR_PERMISSIVE_MODEL
    elif source_type == "pauta":
        user = _user_pauta(pauta_titulo, pauta_briefing, angulo, title, content, link)
        model = OPENAI_CURADOR_PERMISSIVE_MODEL
    else:  # rss
        user = _user_rss(title, content, link, marca_hint, plataforma)
        model = OPENAI_CURADOR_MODEL

    raw = call_openai(system, user, model=model, temperature=0.5, max_tokens=1600, gen_name="curador")
    decision = curador_parser.parse_decision(
        raw, fallback_marca=(marca_hint or "livo"), pauta_marca=pauta_marca
    )
    logger.info(
        "Curador(%s) → APROVADO · marca=%s · vertical=%s",
        source_type, decision["marca"], decision["vertical"],
    )
    return decision
