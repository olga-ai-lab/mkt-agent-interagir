"""Anthropic Claude client — usado pelo Designer para gerar o prompt visual.

O Designer recebe a skill visual da marca (designer_visual_livo/livonius) como
system prompt e devolve um JSON {image_prompt, logo_variant, logo_zone_contrast}.
"""
import logging
from functools import lru_cache

from anthropic import Anthropic

from ..config import ANTHROPIC_API_KEY, ANTHROPIC_DESIGNER_MODEL
from .observability import generation, record_usage

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def get_client() -> Anthropic:
    if not ANTHROPIC_API_KEY:
        raise RuntimeError("ANTHROPIC_API_KEY not configured")
    return Anthropic(api_key=ANTHROPIC_API_KEY)


def call_claude(
    system_prompt: str,
    user_message: str,
    *,
    model: str | None = None,
    max_tokens: int = 1500,
    temperature: float | None = None,
    gen_name: str = "claude",
) -> str:
    """Chama Claude e retorna o texto da primeira content-block do tipo text.

    `temperature` é aceito por compatibilidade com as chamadas existentes, mas NÃO
    é enviado à API: o SDK anthropic 1.x removeu `temperature`/`top_p`/`top_k` da
    assinatura de `messages.create()`, e passá-los levanta
    "Messages.create() got an unexpected keyword argument 'temperature'" antes
    mesmo da requisição HTTP. Continua registrado no Langfuse só como metadado do
    que o chamador pediu.
    """
    client = get_client()
    mdl = model or ANTHROPIC_DESIGNER_MODEL
    with generation(
        gen_name,
        model=mdl,
        input=user_message[:4000],
        model_parameters={"max_tokens": max_tokens, "temperature_requested": temperature},
    ) as gen:
        resp = client.messages.create(
            model=mdl,
            max_tokens=max_tokens,
            system=system_prompt,
            messages=[{"role": "user", "content": user_message}],
        )
        text = next(
            (b.text for b in resp.content if getattr(b, "type", None) == "text"), None
        )
        record_usage(gen, resp, output=(text or "")[:2000])
    if text is None:
        raise RuntimeError(f"No text block in Claude response: {resp}")
    return text
