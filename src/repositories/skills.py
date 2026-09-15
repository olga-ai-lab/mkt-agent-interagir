"""Carrega skills ativas de mkt_agent_skills.

Cada skill é um bloco de system_prompt versionado, escopado por agent_type
(curador | redator | revisor | designer) e por marca (livo | livonius | ambas).
No n8n essas skills eram carregadas como "tools" via HTTP; aqui são injetadas
diretamente no system prompt de cada agente (padrão do olga-mkt-agent).
"""
import logging
from typing import Any

from ..clients.supabase_client import get_supabase

logger = logging.getLogger(__name__)

VALID_AGENTS = {"curador", "redator", "revisor", "designer"}

# Skills que cada agente consome, na ordem em que devem aparecer no prompt.
# Skills marca-específicas (tom/visual) são resolvidas em runtime por get_for_agent.
CURADOR_SKILLS = [
    "curador_matriz_selecao",
    "curador_detector_fontes",
    "curador_pilares_conteudo",
]
REDATOR_SKILLS = [
    "redator_persona_corretor",
    "redator_contexto_mercado_mga",
    "redator_enriquecimento_dados",
    "redator_performance_historica",
]
REVISOR_SKILLS = [
    "revisor_brand_compliance",
    "revisor_anti_plagio",
]


def _marca_filter(marca: str) -> list[str]:
    """Marcas relevantes: sempre inclui 'ambas' + a marca específica."""
    marca = (marca or "").strip().lower()
    if marca in {"livo", "livonius"}:
        return ["ambas", marca]
    return ["ambas", "livo", "livonius"]


def get_by_id(skill_id: str) -> dict[str, Any] | None:
    """Retorna a skill ativa pelo skill_id, ou None."""
    sb = get_supabase()
    res = (
        sb.table("mkt_agent_skills")
        .select("skill_id,agent_type,marca,skill_version,system_prompt")
        .eq("skill_id", skill_id)
        .eq("is_active", True)
        .limit(1)
        .execute()
    )
    rows = res.data or []
    return rows[0] if rows else None


def get_many(skill_ids: list[str]) -> dict[str, dict[str, Any]]:
    """Carrega várias skills de uma vez. Retorna map skill_id -> row."""
    if not skill_ids:
        return {}
    sb = get_supabase()
    res = (
        sb.table("mkt_agent_skills")
        .select("skill_id,agent_type,marca,skill_version,system_prompt")
        .in_("skill_id", skill_ids)
        .eq("is_active", True)
        .execute()
    )
    return {r["skill_id"]: r for r in (res.data or [])}


def build_prompt(skill_ids: list[str], *, header: str | None = None) -> str:
    """Concatena os system_prompts das skills na ordem pedida, com separadores."""
    loaded = get_many(skill_ids)
    blocks: list[str] = []
    if header:
        blocks.append(header.strip())
    for sid in skill_ids:
        row = loaded.get(sid)
        if not row:
            logger.warning("skill ausente/inativa: %s", sid)
            continue
        blocks.append(f"<skill id=\"{sid}\" v=\"{row.get('skill_version')}\">\n{row['system_prompt']}\n</skill>")
    return "\n\n".join(blocks).strip()


def tom_skill_id(marca: str) -> str:
    """Skill de tom/voz do Redator conforme a marca decidida pelo Curador."""
    return "redator_tom_livonius" if (marca or "").lower() == "livonius" else "redator_tom_livo"


def designer_skill_id(marca: str) -> str:
    """Skill visual do Designer conforme a marca."""
    return "designer_visual_livonius" if (marca or "").lower() == "livonius" else "designer_visual_livo"
