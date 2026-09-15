"""FastAPI — agente Marketing Livonius/Livo.

Entradas (equivalem às rotas do n8n 'Route by Workflow' + webhooks):
  POST /generate/rss          → varre feed(s) RSS (livo/livonius/both) e gera posts
  POST /generate/pauta        → gera post para uma pauta específica da agenda
  POST /generate/pautas/scan  → processa pautas pendentes da agenda editorial
  POST /generate/files        → gera post a partir de arquivo(s) enviado(s)
  POST /automation/scan       → roteia por workflow_name (compat. com o n8n)
  GET  /healthz

A pipeline (Curador → Redator → Revisor → Designer → imagem → handoff) roda em
background; a resposta volta imediata com generation_id(s) para acompanhamento via
mkt_post_generation_status.
"""
from __future__ import annotations

import asyncio
import logging
import uuid
from typing import Literal

from fastapi import BackgroundTasks, Depends, FastAPI, Header, HTTPException, Response
from pydantic import BaseModel, Field

from .clients.observability import boot_check, lf_status
from .config import (
    AGENT_SHARED_SECRET,
    AUTOMATION_MAX_ITEMS,
    LOG_LEVEL,
    RSS_CANDIDATE_POOL,
    RSS_FEED_LIVO,
    RSS_FEED_LIVONIUS,
    RSS_FEED_PAUTA,
)
from .lib import file_extractor
from .lib.brand import normalize_channels
from .lib.rss_feed import fetch_and_merge, fetch_entries, is_valid_entry
from .pipeline import image_only, pauta_ranker
from .pipeline.orchestrator import run_pipeline
from .repositories import blog_content, pautas, rss_feed_items
from .repositories import generation_status as gs

logging.basicConfig(
    level=getattr(logging, LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(title="MKT Agent Livo", version="1.0.0")


@app.on_event("startup")
async def _boot() -> None:
    boot_check()


# ----------------------------- request models -----------------------------
class RSSRequest(BaseModel):
    marca: Literal["livo", "livonius", "both"] = "both"
    max_items: int = Field(default=AUTOMATION_MAX_ITEMS, ge=1, le=20)


class PautaRequest(BaseModel):
    pauta_id: int = Field(gt=0)


class FileItem(BaseModel):
    signed_url: str = Field(min_length=8)
    file_type: Literal["pdf", "docx", "txt", "image"]


class FilesRequest(BaseModel):
    files: list[FileItem] = Field(min_length=1)
    titulo: str = ""
    observacoes: str = ""
    generation_id: str | None = None
    pauta_id: int | None = None
    channels: list[str] | str | None = None


class AutomationScanRequest(BaseModel):
    workflow_name: str | None = None
    pauta_id: int | None = None


class RegenerateImageRequest(BaseModel):
    """Payload exato da EF mkt-generate-image-n8n (repontada para este agente).

    `post_id` e `previous_attempt` vêm no payload real mas não são usados na
    geração — aceitos para compatibilidade e correlação em log.
    """

    title: str = Field(min_length=1)
    content: str = ""
    company: Literal["livo", "livonius"] = "livonius"
    feedback: str | None = None
    post_id: str | None = None
    previous_attempt: bool = False


def require_secret(x_agent_secret: str | None = Header(default=None)) -> None:
    if AGENT_SHARED_SECRET and x_agent_secret != AGENT_SHARED_SECRET:
        raise HTTPException(401, "invalid agent secret")


# ----------------------------- helpers -----------------------------
def _feeds_for(marca: str) -> list[str]:
    if marca == "livo":
        return [RSS_FEED_LIVO]
    if marca == "livonius":
        return [RSS_FEED_LIVONIUS]
    return [RSS_FEED_LIVO, RSS_FEED_LIVONIUS]


def _queue_rss(background: BackgroundTasks, *, marca: str, max_items: int) -> list[str]:
    """Varre feed(s), pula links já processados e enfileira até max_items.

    Dois ledgers de dedup: `blog_content` (histórico geral de curadoria, todas
    as fontes) e `mkt_rss_feed_items` (ledger específico de pré-seleção RSS,
    com rss_link único entre os 3 feeds de marca — evita reavaliar o mesmo
    artigo em scans futuros mesmo antes de a pipeline completa rodar).
    """
    entries = fetch_and_merge(_feeds_for(marca), limit_per_feed=RSS_CANDIDATE_POOL)
    marca_hint = "" if marca == "both" else marca
    queued: list[str] = []
    for entry in entries:
        if len(queued) >= max_items:
            break
        link = entry["link"]
        if blog_content.link_exists(link) or rss_feed_items.exists_for_link(link):
            continue
        generation_id = str(uuid.uuid4())
        background.add_task(
            _run_safely,
            generation_id=generation_id,
            source_type="rss",
            title=entry["title"],
            content=entry.get("content", ""),
            link=link,
            feed_url=entry.get("feed_url", ""),
            marca_hint=marca_hint,
            plataforma="instagram",
            channels=["instagram", "linkedin"],
        )
        queued.append(generation_id)
    return queued


def _queue_pauta(background: BackgroundTasks, pauta: dict) -> str:
    """Rankeia RSS para a pauta, escolhe o melhor artigo novo e enfileira 1 post."""
    channels = normalize_channels(pauta.get("plataforma"))
    entries = [e for e in fetch_entries(RSS_FEED_PAUTA, limit=RSS_CANDIDATE_POOL) if is_valid_entry(e)]
    ranked = pauta_ranker.rank(
        pauta_titulo=pauta.get("titulo", ""),
        pauta_briefing=pauta.get("briefing", ""),
        pauta_link=pauta.get("link_referencia", "") or "",
        artigos=entries,
    )
    angulo = ranked.get("angulo_editorial", "")

    chosen = None
    for i in ranked.get("indices_selecionados", []):
        if 0 <= i < len(entries) and not blog_content.link_exists(entries[i]["link"]):
            chosen = entries[i]
            break

    pautas.mark_processing(int(pauta["id"]))
    generation_id = str(uuid.uuid4())
    background.add_task(
        _run_safely,
        generation_id=generation_id,
        source_type="pauta",
        title=(chosen or {}).get("title") or pauta.get("titulo", ""),
        content=(chosen or {}).get("content") or pauta.get("briefing", ""),
        link=(chosen or {}).get("link", ""),
        marca_hint=pauta.get("marca") or "",
        pauta_marca=pauta.get("marca"),
        channels=channels,
        pauta_id=int(pauta["id"]),
        pauta_titulo=pauta.get("titulo", ""),
        pauta_briefing=pauta.get("briefing", ""),
        briefing=pauta.get("briefing", ""),
        observacoes=pauta.get("observacoes"),
        angulo=angulo,
    )
    return generation_id


async def _run_safely(**kwargs):
    try:
        await run_pipeline(**kwargs)
    except Exception:
        pass  # já logado + status marcado no orchestrator


# ----------------------------- endpoints -----------------------------
@app.get("/healthz")
def healthz():
    return {"ok": True, "langfuse": lf_status()}


@app.post("/generate/rss")
async def generate_rss(req: RSSRequest, background: BackgroundTasks, _: None = Depends(require_secret)):
    queued = _queue_rss(background, marca=req.marca, max_items=req.max_items)
    return {"ok": True, "queued": len(queued), "generation_ids": queued}


@app.post("/generate/pauta")
async def generate_pauta(req: PautaRequest, background: BackgroundTasks, _: None = Depends(require_secret)):
    pauta = pautas.get_by_id(req.pauta_id)
    if not pauta:
        raise HTTPException(404, f"pauta not found: {req.pauta_id}")
    if not (pauta.get("titulo") or "").strip():
        raise HTTPException(400, "pauta sem título")
    if not pautas.can_manually_trigger(pauta):
        raise HTTPException(409, "Apenas pautas pendentes ou com erro podem ser geradas manualmente")
    generation_id = _queue_pauta(background, pauta)
    return {"ok": True, "pauta_id": req.pauta_id, "generation_id": generation_id, "status": "queued"}


@app.post("/generate/pautas/scan")
async def generate_pautas_scan(background: BackgroundTasks, _: None = Depends(require_secret)):
    pending = pautas.list_pending(limit=AUTOMATION_MAX_ITEMS)
    results = [{"pauta_id": p["id"], "generation_id": _queue_pauta(background, p)} for p in pending]
    return {"ok": True, "processed": len(results), "results": results}


@app.post("/generate/files")
async def generate_files(req: FilesRequest, background: BackgroundTasks, _: None = Depends(require_secret)):
    generation_id = req.generation_id or str(uuid.uuid4())
    gs.create(generation_id, gs.STATUS_EXTRACTING)
    try:
        title, corpus = await _extract(req)
    except Exception as e:
        logger.exception("file extraction failed")
        gs.complete(generation_id, gs.STATUS_FAILED, error=f"file extraction failed: {e}")
        raise HTTPException(500, f"file extraction failed: {e}") from e

    channels = normalize_channels(req.channels) or ["blog"]
    background.add_task(
        _run_safely,
        generation_id=generation_id,
        source_type="arquivo",
        title=title,
        content=corpus,
        marca_hint="",
        channels=channels,
        pauta_id=req.pauta_id,
        observacoes=req.observacoes or None,
        items_count=len(req.files),
    )
    return {"ok": True, "generation_id": generation_id, "status": "queued"}


async def _extract(req: FilesRequest) -> tuple[str, str]:
    return await asyncio.to_thread(
        file_extractor.build_file_corpus,
        files=[f.model_dump() for f in req.files],
        title_hint=req.titulo,
        observations=req.observacoes,
    )


@app.post("/generate/image")
async def generate_image_endpoint(req: RegenerateImageRequest, _: None = Depends(require_secret)):
    """(Re)gera só a imagem de um post existente — chamado pela EF mkt-generate-image-n8n.

    SÍNCRONO: a EF espera a resposta com o PNG pronto (Content-Type: image/png,
    já com logo carimbado) e faz o upload dela mesma pro bucket mkt-post-media.
    Não passa pela pipeline de curadoria/redação.
    """
    try:
        png_bytes = await asyncio.to_thread(
            image_only.generate_post_image,
            title=req.title,
            content=req.content,
            marca=req.company,
            post_id=req.post_id,
            feedback=req.feedback or "",
        )
    except Exception as e:
        logger.exception("image generation failed")
        raise HTTPException(500, f"image generation failed: {e}") from e
    return Response(content=png_bytes, media_type="image/png")


@app.post("/automation/scan")
async def automation_scan(req: AutomationScanRequest, background: BackgroundTasks, _: None = Depends(require_secret)):
    """Roteia por workflow_name, compatível com o webhook de automação do n8n."""
    name = (req.workflow_name or "").strip().lower()
    if name in {"sheets_rss", "pautas", "agenda"}:
        pending = pautas.list_pending(limit=AUTOMATION_MAX_ITEMS)
        results = [{"pauta_id": p["id"], "generation_id": _queue_pauta(background, p)} for p in pending]
        return {"ok": True, "workflow": "pautas", "processed": len(results), "results": results}
    if name in {"agenda_pauta_manual", "pauta_manual"}:
        if not req.pauta_id:
            raise HTTPException(400, "pauta_id obrigatório para agenda_pauta_manual")
        pauta = pautas.get_by_id(req.pauta_id)
        if not pauta:
            raise HTTPException(404, f"pauta not found: {req.pauta_id}")
        if not pautas.can_manually_trigger(pauta):
            raise HTTPException(409, "Apenas pautas pendentes ou com erro podem ser geradas manualmente")
        return {"ok": True, "workflow": "pauta_manual", "generation_id": _queue_pauta(background, pauta)}
    if name in {"rss_puro_livo", "rss_livo"}:
        queued = _queue_rss(background, marca="livo", max_items=AUTOMATION_MAX_ITEMS)
        return {"ok": True, "workflow": "rss_livo", "queued": len(queued), "generation_ids": queued}
    if name in {"rss_puro_livonius", "rss_livonius"}:
        queued = _queue_rss(background, marca="livonius", max_items=AUTOMATION_MAX_ITEMS)
        return {"ok": True, "workflow": "rss_livonius", "queued": len(queued), "generation_ids": queued}
    raise HTTPException(400, f"workflow_name desconhecido: {req.workflow_name!r}")


if __name__ == "__main__":
    import uvicorn

    from .config import PORT

    uvicorn.run("src.main:app", host="0.0.0.0", port=PORT, log_level=LOG_LEVEL.lower())
