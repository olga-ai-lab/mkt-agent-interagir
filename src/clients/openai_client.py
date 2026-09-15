"""OpenAI client — chat (Curador/Redator/Revisor/Ranker) + gpt-image-1 (imagens).

O n8n original usa OpenAI para todos os agentes de texto (gpt-4o / gpt-5) e
gpt-image-1 para a imagem. Mantemos o mesmo provider aqui para preservar o
comportamento aprovado, com os modelos configuráveis por env.
"""
import base64
import logging
from functools import lru_cache

from openai import OpenAI

from ..config import OPENAI_API_KEY, OPENAI_IMAGE_MODEL
from .observability import generation, record_usage

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def get_client() -> OpenAI:
    if not OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY not configured")
    return OpenAI(api_key=OPENAI_API_KEY)


_REASONING_MODEL_PREFIXES = ("gpt-5", "o1", "o3", "o4")


def _is_reasoning_model(model: str) -> bool:
    """gpt-5 / o-series são modelos de raciocínio: gastam 'reasoning tokens' do
    mesmo teto de saída e não aceitam `temperature` custom."""
    return model.lower().startswith(_REASONING_MODEL_PREFIXES)


def call_openai(
    system_prompt: str,
    user_message: str,
    *,
    model: str,
    temperature: float | None = 0.5,
    max_tokens: int = 4096,
    gen_name: str = "openai",
) -> str:
    """Chama o Chat Completions e retorna o texto da resposta.

    Modelos de raciocínio (gpt-5/o-series) consomem reasoning tokens do mesmo
    orçamento de `max_completion_tokens`: com teto baixo o raciocínio esgota a
    cota e o texto visível volta vazio. Por isso recebem folga de tokens e
    `reasoning_effort` baixo, e não enviam `temperature` (não suportada). Modelos
    clássicos (gpt-4o) seguem no caminho legado com `max_tokens` + `temperature`.
    Registra tokens no Langfuse quando ligado.
    """
    client = get_client()
    reasoning = _is_reasoning_model(model)
    with generation(
        gen_name,
        model=model,
        input=user_message[:4000],
        model_parameters={"temperature": temperature, "max_tokens": max_tokens},
    ) as gen:
        kwargs: dict = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
        }
        if reasoning:
            # Folga essencial: sem ela o reasoning consome tudo e o texto vem vazio.
            # Esforço baixo basta para as etapas estruturadas (curador/redator/etc).
            create_kwargs = {
                **kwargs,
                "max_completion_tokens": max(max_tokens, 8000),
                "reasoning_effort": "low",
            }
            try:
                resp = client.chat.completions.create(**create_kwargs)
            except TypeError:
                # SDK antigo sem suporte a reasoning_effort — segue sem o parâmetro.
                create_kwargs.pop("reasoning_effort", None)
                resp = client.chat.completions.create(**create_kwargs)
        else:
            # gpt-4o e afins (comportamento aprovado): max_tokens + temperature.
            try:
                resp = client.chat.completions.create(
                    **kwargs,
                    max_tokens=max_tokens,
                    **({"temperature": temperature} if temperature is not None else {}),
                )
            except Exception as e:
                if "temperature" in str(e).lower():
                    resp = client.chat.completions.create(**kwargs, max_tokens=max_tokens)
                else:
                    raise
        choice = resp.choices[0] if resp.choices else None
        text = choice.message.content if choice else None
        finish = choice.finish_reason if choice else None
        record_usage(gen, resp, output=(text or "")[:2000])
    if not text:
        raise RuntimeError(
            f"OpenAI retornou resposta vazia (model={model}, finish_reason={finish})"
        )
    return text


def generate_image(
    prompt: str,
    *,
    size: str = "1024x1024",
    quality: str = "high",
) -> bytes:
    """Gera imagem com gpt-image-1 e retorna bytes do PNG (decodificado de base64)."""
    client = get_client()
    with generation(
        "image",
        model=OPENAI_IMAGE_MODEL,
        input=prompt[:2000],
        model_parameters={"size": size, "quality": quality},
    ) as gen:
        resp = client.images.generate(
            model=OPENAI_IMAGE_MODEL,
            prompt=prompt,
            size=size,
            quality=quality,
            n=1,
        )
        record_usage(gen, resp, output="<image bytes>")
    if not resp.data or not resp.data[0].b64_json:
        raise RuntimeError(f"No b64 image in OpenAI response: {resp}")
    return base64.b64decode(resp.data[0].b64_json)


def extract_from_image(signed_url: str, *, model: str, instruction: str) -> str:
    """Extrai texto/descrição de uma imagem via visão (Responses API)."""
    client = get_client()
    response = client.responses.create(
        model=model,
        input=[
            {
                "role": "user",
                "content": [
                    {"type": "input_text", "text": instruction},
                    {"type": "input_image", "image_url": signed_url},
                ],
            }
        ],
    )
    output_text = getattr(response, "output_text", None)
    if output_text:
        return str(output_text).strip()
    raise RuntimeError("OpenAI não retornou texto para a imagem enviada")
