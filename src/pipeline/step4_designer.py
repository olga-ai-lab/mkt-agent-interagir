"""Designer — gera o prompt visual (para gpt-image-1) via Claude.

System prompt = skill visual da marca (designer_visual_livo|livonius). O Designer
recebe o artigo + prompts recentes (para não repetir composições) e devolve um
JSON {image_prompt, logo_variant, logo_zone_contrast}. O image_prompt deve reservar
área superior-direita para o logo e terminar com a frase obrigatória de proibição
de texto/logos, validada por designer_parser.
"""
from __future__ import annotations

import logging

from ..clients.anthropic_client import call_claude
from ..config import ANTHROPIC_DESIGNER_MODEL
from ..lib import designer_parser
from ..lib.designer_parser import DesignerOutputInvalid  # re-export
from ..repositories import analytics, skills

logger = logging.getLogger(__name__)

__all__ = ["design", "DesignerOutputInvalid"]

_OUTPUT_CONTRACT = """
---
REQUISITOS DE SAÍDA (obrigatório):
Retorne APENAS um objeto JSON válido, sem markdown, sem preâmbulo, sem análise, sem
rótulos de etapa. O JSON deve ter exatamente estas chaves: image_prompt, logo_variant,
logo_zone_contrast.
- image_prompt: string em INGLÊS, o único texto que vai para o gpt-image-1. Deve seguir a
  skill visual da marca, reservar a área SUPERIOR-DIREITA (safe area) para aplicação do
  logo, e TERMINAR OBRIGATORIAMENTE com a frase:
  "No text, no numbers, no logos, no brand marks, no charts, no labels anywhere in the image."
- logo_variant: "normal" | "white" | "auto" (use "auto" na dúvida).
- logo_zone_contrast: "light" | "dark" | "mixed" (contraste esperado na zona do logo; "mixed" na dúvida).
"""


def _recent_block(marca: str) -> str:
    prompts = analytics.recent_image_prompts(marca=marca, limit=5)
    if not prompts:
        return "None yet — this is the first generation."
    return "\n".join(f"{i + 1}. {p}" for i, p in enumerate(prompts) if (p or "").strip())


def design(*, marca: str, redator_output: str, feedback: str = "") -> dict[str, str]:
    """Roda o Designer e retorna {image_prompt, logo_variant, logo_zone_contrast}.

    `feedback` é opcional — usado no fluxo de regeneração de imagem (botão do
    front), quando o lead pede um ajuste específico na composição visual.
    """
    skill = skills.get_by_id(skills.designer_skill_id(marca))
    system = (skill["system_prompt"] if skill else "") + _OUTPUT_CONTRACT

    feedback_block = f"\n\nUSER FEEDBACK FOR THIS REVISION (address it directly):\n{feedback.strip()}" if feedback.strip() else ""

    user = f"""Brand: {marca}

Article:
{redator_output}
{feedback_block}

---
RECENT SCENES ALREADY USED — DO NOT REPEAT these compositions, subjects, or atmospheres:
{_recent_block(marca)}

Generate the JSON now."""

    raw = call_claude(
        system, user, model=ANTHROPIC_DESIGNER_MODEL, max_tokens=1200, temperature=0.7, gen_name="designer"
    )
    parsed = designer_parser.parse_designer_output(raw)
    logger.info("Designer → prompt %d chars (variant=%s)", len(parsed["image_prompt"]), parsed["logo_variant"])
    return parsed
