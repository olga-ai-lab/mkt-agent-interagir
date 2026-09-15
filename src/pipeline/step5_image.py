"""Geração de imagem: gpt-image-1 → upload raw → Edge Function interagir-composite-logo.

Retorna as URLs finais: file_url/file_urls (com logo) e base_file_url/base_file_urls
(sem logo, usada pelo editor de Composição de Marca). A composição do logo continua
na Edge Function (interagir-composite-logo), como pedido.
"""
from __future__ import annotations

import logging
import uuid

import httpx

from ..clients.openai_client import generate_image
from ..config import COMPOSITE_LOGO_EF, MKT_IMAGE_BUCKET, SUPABASE_URL
from ..repositories import storage

logger = logging.getLogger(__name__)

COMPOSITE_TIMEOUT = 120.0
_STORAGE_PUBLIC = f"{SUPABASE_URL}/storage/v1/object/public/{MKT_IMAGE_BUCKET}"


def generate(
    *,
    image_prompt: str,
    marca: str,
    logo_variant: str,
    logo_zone_contrast: str,
    size: str = "1024x1024",
) -> dict:
    """Gera a imagem, sobe a crua e compõe o logo. Retorna dict de URLs."""
    png = generate_image(image_prompt, size=size)
    image_id = uuid.uuid4().hex
    raw_path = storage.upload_raw_image(png, image_id)  # "interagir-article-images/{id}_raw.png"
    logger.info("Imagem crua enviada: %s", raw_path)

    composite = _composite_logo(
        image_id=raw_path, marca=marca, logo_variant=logo_variant, logo_zone_contrast=logo_zone_contrast
    )

    file_url = composite.get("public_url") or f"{_STORAGE_PUBLIC}/{image_id}.png"
    base_url = composite.get("base_public_url") or f"{_STORAGE_PUBLIC}/{image_id}_raw.png"

    return {
        "file_url": file_url,
        "file_urls": [file_url] if file_url else [],
        "base_file_url": base_url,
        "base_file_urls": [base_url] if base_url else [],
        "image_id": image_id,
    }


def _composite_logo(*, image_id: str, marca: str, logo_variant: str, logo_zone_contrast: str) -> dict:
    payload = {
        "image_id": image_id,
        "marca": marca,
        "logo_variant": logo_variant or "auto",
        "logo_zone_contrast": logo_zone_contrast or "mixed",
    }
    try:
        with httpx.Client(timeout=COMPOSITE_TIMEOUT) as client:
            resp = client.post(COMPOSITE_LOGO_EF, json=payload, headers={"Content-Type": "application/json"})
            if resp.status_code >= 400:
                logger.error("interagir-composite-logo HTTP %d: %s", resp.status_code, resp.text[:400])
                resp.raise_for_status()
            return resp.json()
    except Exception as e:
        # Fallback: sem composição, o handoff usa as URLs derivadas do image_id.
        logger.warning("Composição de logo falhou (%s) — seguindo com imagem crua", e)
        return {}
