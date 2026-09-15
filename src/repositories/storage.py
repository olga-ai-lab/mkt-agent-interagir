"""Upload da imagem crua (gpt-image-1) para o bucket interagir-article-images.

A Edge Function interagir-composite-logo lê `{id}_raw.png` desse bucket, carimba o logo
da marca e devolve as URLs pública (com logo) e base (sem logo).
"""
from ..clients.supabase_client import get_supabase
from ..config import MKT_IMAGE_BUCKET


def upload_raw_image(data: bytes, image_id: str) -> str:
    """Sobe a PNG crua como `{image_id}_raw.png` e retorna o storage path relativo.

    Usa upsert: re-runs no mesmo image_id são idempotentes.
    """
    sb = get_supabase()
    path = f"{image_id}_raw.png"
    sb.storage.from_(MKT_IMAGE_BUCKET).upload(
        path=path,
        file=data,
        file_options={"content-type": "image/png", "upsert": "true"},
    )
    return f"{MKT_IMAGE_BUCKET}/{path}"


def public_url(path_in_bucket: str) -> str:
    """URL pública de um objeto `{bucket}/{path}`."""
    bucket, _, obj = path_in_bucket.partition("/")
    sb = get_supabase()
    return sb.storage.from_(bucket).get_public_url(obj)
