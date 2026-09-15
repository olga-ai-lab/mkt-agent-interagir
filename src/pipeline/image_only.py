"""Geração de imagem avulsa — chamada pela Edge Function mkt-generate-image-n8n.

Fluxo síncrono usado pelo botão de (re)gerar imagem no front-end: o lead já tem
um post (post_id/title/content/company) e pede uma nova imagem, opcionalmente
com feedback de revisão. Diferente da pipeline principal (que delega a
composição de logo para a Edge Function interagir-composite-logo), este fluxo compõe
o logo LOCALMENTE com posição/tamanho fixos por marca — replicando 1:1 os nós
Ajustar_Tamanho2/3 + Carimbar_Logo2/3 + If3 do n8n.

Responde com os bytes do PNG final (Content-Type: image/png). A EF
mkt-generate-image-n8n já detecta uma resposta `image/*` e faz o upload dela
mesma para o bucket mkt-post-media — o agente NÃO precisa (e não deve)
persistir uma cópia própria, pra não duplicar armazenamento.
"""
from __future__ import annotations

import io
import logging

import httpx
from PIL import Image

from ..clients.openai_client import generate_image
from . import step4_designer

logger = logging.getLogger(__name__)

# URLs públicas do bucket logos-marcas (mesmas do n8n — Baixar_Logo_Supabase3).
_LOGO_URLS = {
    "livo": "https://vywalfkdlbmuoyxfgjhc.supabase.co/storage/v1/object/public/logos-marcas/LIVO_marca_color-2.png",
    "livonius": "https://vywalfkdlbmuoyxfgjhc.supabase.co/storage/v1/object/public/logos-marcas/Livonius_logo%20(1).png",
}

# Caixa máxima do logo e margens, como FRAÇÃO das dimensões da base — os mesmos
# ratios da Edge Function interagir-composite-logo (MARCA_CONFIG), para que o botão de
# regerar imagem produza o logo idêntico ao da pipeline principal.
#
# Antes isto era {"size": (250, 250)} + posição absoluta e o logo era redimensionado
# com Image.resize(size), que IGNORA a proporção natural: as duas marcas são
# wordmarks largas (a Livonius é 169.3x46.6mm, ~3.64:1) e eram espremidas num
# quadrado — daí o logo esticado. Agora a escala é uniforme dentro da caixa.
_LOGO_LAYOUT = {
    "livo": {
        "max_width_ratio": 180 / 1024,
        "max_height_ratio": 120 / 1024,
        "margin_right_ratio": 36 / 1024,
        "margin_top_ratio": 28 / 1024,
    },
    "livonius": {
        "max_width_ratio": 220 / 1024,
        "max_height_ratio": 110 / 1024,
        "margin_right_ratio": 36 / 1024,
        "margin_top_ratio": 28 / 1024,
    },
}

_LOGO_TIMEOUT = 30.0


def _content_theme(title: str, content: str) -> str:
    """Replica o nó Condensar_Tema: title + '. ' + content[:300]."""
    return f"{title.strip()}. {content.strip()[:300]}"


def _fit_logo_size(logo: Image.Image, base: Image.Image, layout: dict) -> tuple[int, int]:
    """Maior (largura, altura) que cabe na caixa da marca SEM distorcer o logo."""
    max_w = max(1, round(base.width * layout["max_width_ratio"]))
    max_h = max(1, round(base.height * layout["max_height_ratio"]))
    # min(..., 1.0) evita ampliar um logo já menor que a caixa (perderia nitidez).
    scale = min(max_w / logo.width, max_h / logo.height, 1.0)
    return max(1, round(logo.width * scale)), max(1, round(logo.height * scale))


def _composite_logo_local(base_png: bytes, marca: str) -> bytes:
    layout = _LOGO_LAYOUT.get(marca, _LOGO_LAYOUT["livonius"])
    logo_url = _LOGO_URLS.get(marca, _LOGO_URLS["livonius"])

    logo_bytes = httpx.get(logo_url, timeout=_LOGO_TIMEOUT, follow_redirects=True).content

    base = Image.open(io.BytesIO(base_png)).convert("RGBA")
    logo = Image.open(io.BytesIO(logo_bytes)).convert("RGBA")

    logo = logo.resize(_fit_logo_size(logo, base, layout), Image.LANCZOS)

    margin_right = max(8, round(base.width * layout["margin_right_ratio"]))
    margin_top = max(8, round(base.height * layout["margin_top_ratio"]))
    # max(0, ...) mantém o logo dentro da tela mesmo numa base menor que a caixa
    # — a posição absoluta antiga (800, 60) estourava a borda de uma base 1024.
    pos_x = max(0, base.width - logo.width - margin_right)
    pos_y = max(0, min(margin_top, base.height - logo.height))

    base.paste(logo, (pos_x, pos_y), mask=logo)

    out = io.BytesIO()
    base.convert("RGB").save(out, format="PNG")
    return out.getvalue()


def generate_post_image(
    *, title: str, content: str, marca: str, feedback: str = "", post_id: str | None = None
) -> bytes:
    """Gera uma imagem avulsa (com logo já carimbado) para um post existente.

    Retorna os bytes do PNG final. A persistência em Storage é feita pela EF
    chamadora (mkt-generate-image-n8n → bucket mkt-post-media), não aqui.
    `post_id` é opcional, usado só para correlacionar logs.
    """
    theme = _content_theme(title, content)
    design = step4_designer.design(marca=marca, redator_output=theme, feedback=feedback)

    raw_png = generate_image(design["image_prompt"])
    final_png = _composite_logo_local(raw_png, marca)

    logger.info(
        "Imagem avulsa gerada (post_id=%s, marca=%s, %d bytes)", post_id, marca, len(final_png)
    )
    return final_png
