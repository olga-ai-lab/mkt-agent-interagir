"""Extração de texto para uploads de arquivo (fluxo 'arquivo' do n8n).

Suporta pdf/docx/txt/image. PDF/DOCX são extraídos localmente (pypdf/python-docx);
imagens via OpenAI Vision. Múltiplos arquivos são consolidados num único corpus
com separadores, como no nó Code in JavaScript2 do n8n.
"""
from __future__ import annotations

import io
from typing import Literal

import httpx

from ..clients.openai_client import extract_from_image
from ..config import OPENAI_TEXT_MODEL

FileKind = Literal["pdf", "docx", "txt", "image"]

_IMAGE_INSTRUCTION = (
    "Extraia TODO o texto visível desta imagem. Retorne apenas o texto extraído, "
    "sem comentários. Se não houver texto, descreva detalhadamente o conteúdo visual "
    "que poderia servir de inspiração para um post sobre seguros, gestão de risco ou "
    "o mercado do corretor. Não invente nada e nunca esconda um dado."
)


def _download_bytes(url: str, *, timeout: float = 30.0) -> bytes:
    resp = httpx.get(url, timeout=timeout, follow_redirects=True)
    resp.raise_for_status()
    return resp.content


def _extract_txt(data: bytes) -> str:
    for encoding in ("utf-8", "utf-8-sig", "latin-1"):
        try:
            return data.decode(encoding).replace("﻿", "")
        except UnicodeDecodeError:
            continue
    return data.decode("utf-8", errors="ignore")


def _extract_pdf(data: bytes) -> str:
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(data))
    pages = [page.extract_text() or "" for page in reader.pages]
    return "\n\n".join(p.strip() for p in pages if p.strip())


def _extract_docx(data: bytes) -> str:
    from docx import Document

    doc = Document(io.BytesIO(data))
    return "\n\n".join(p.text.strip() for p in doc.paragraphs if p.text.strip())


def extract_single_file(*, signed_url: str, file_type: FileKind) -> str:
    if file_type == "image":
        return extract_from_image(signed_url, model=OPENAI_TEXT_MODEL, instruction=_IMAGE_INSTRUCTION)
    data = _download_bytes(signed_url)
    if file_type == "txt":
        return _extract_txt(data)
    if file_type == "pdf":
        return _extract_pdf(data)
    if file_type == "docx":
        return _extract_docx(data)
    raise ValueError(f"file_type não suportado: {file_type!r}")


def build_file_corpus(
    *,
    files: list[dict[str, str]],
    title_hint: str = "",
    observations: str = "",
) -> tuple[str, str]:
    """Extrai + consolida os arquivos. Retorna (title, content_corpus).

    content_corpus mescla todas as fontes com separadores, como no n8n.
    """
    blocks: list[str] = []
    for idx, file in enumerate(files, start=1):
        extracted = extract_single_file(
            signed_url=file["signed_url"],
            file_type=file["file_type"],  # type: ignore[arg-type]
        ).strip()
        if not extracted:
            raise RuntimeError(f"Arquivo {idx} ({file['file_type']}) sem conteúdo extraível")
        origem = file["file_type"].upper()
        sep = "═" * 60
        blocks.append(f"{sep}\n📄 FONTE {idx}: {origem}\n{'─' * 60}\n{extracted}")

    corpus = "\n\n\n".join(blocks)
    if observations.strip():
        corpus = f"# OBSERVAÇÕES\n\n{observations.strip()}\n\n\n{corpus}"

    title = title_hint.strip() or f"Conteúdo via Arquivo ({files[0]['file_type'].upper()})"
    return title, corpus[:25000]
