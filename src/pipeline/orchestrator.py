"""Orchestrator — roda a pipeline completa para um item de trabalho.

Sequência (equivale ao caminho comum do n8n após Merge Fontes):
  1. curating         → Curador (decisão + marca + vertical)
  2. writing          → Redator (conteúdo markdown)
  3. reviewing        → Revisor (gate de qualidade)
  4. generating_image → Designer (prompt) + gpt-image-1 + composição de logo
  5. creating_post    → Handoff para a Edge Function interagir-receive-n8n-upload
  6. completed        → grava post_id

Curador reprovado (CuradorRejected) e Revisor reprovado (ReviewRejected) são
fluxos limpos: a geração termina como 'failed' com a razão, sem publicar peça.

Para source_type="rss", o veredito do Curador também é registrado em
mkt_rss_feed_items (promoted/discarded) — ledger de pré-seleção dedicado a
RSS que evita reavaliar o mesmo link em scans futuros (ver
src/repositories/rss_feed_items.py e main.py:_queue_rss).
"""
from __future__ import annotations

import asyncio
import logging
import time
from typing import Any

from ..clients.observability import flush as lf_flush
from ..clients.observability import pipeline_trace, step_span
from ..lib import markdown_parser
from ..lib.brand import normalize_channels
from ..repositories import blog_content, pautas, rss_feed_items
from ..repositories import generation_status as gs
from . import (
    step1_curator,
    step2_writer,
    step3_reviewer,
    step4_designer,
    step5_image,
    step6_handoff,
)

logger = logging.getLogger(__name__)


def _plataforma_from_channels(channels: list[str], fallback: str = "blog") -> str:
    return channels[0] if channels else fallback


def _log_rss_ledger(
    *,
    source_type: str,
    feed_url: str,
    link: str,
    title: str,
    content: str,
    promoted: bool,
    reason: str | None,
    pauta_id: int | None = None,
) -> None:
    """Registra a decisão do Curador em mkt_rss_feed_items (só para source_type='rss')."""
    if source_type != "rss" or not link:
        return
    try:
        if rss_feed_items.exists_for_link(link):
            return
        if promoted:
            rss_feed_items.insert_promoted(
                feed_url=feed_url,
                rss_link=link,
                title=title,
                snippet=content[:1500],
                pauta_id=pauta_id,
                reason=reason,
            )
        else:
            rss_feed_items.insert_discarded(
                feed_url=feed_url,
                rss_link=link,
                title=title,
                snippet=content[:1500],
                reason=reason,
            )
    except Exception:
        # ledger é best-effort — nunca deve derrubar a pipeline principal.
        logger.warning("rss_feed_items ledger write falhou para %s", link, exc_info=True)


async def run_pipeline(
    *,
    generation_id: str,
    source_type: str,
    title: str,
    content: str,
    link: str = "",
    feed_url: str = "",
    marca_hint: str = "",
    channels: list[str] | None = None,
    plataforma: str = "",
    pauta_id: int | None = None,
    pauta_marca: str | None = None,
    pauta_titulo: str = "",
    pauta_briefing: str = "",
    briefing: str = "",
    observacoes: str | None = None,
    angulo: str = "",
    items_count: int = 1,
) -> dict[str, Any]:
    """Roda a pipeline. Retorna {generation_id, post_id, marca, ...}."""
    t0 = time.time()
    channels = channels or normalize_channels(plataforma)
    plataforma_efetiva = plataforma or _plataforma_from_channels(channels)

    await asyncio.to_thread(gs.create, generation_id, gs.STATUS_CURATING)
    logger.info("[%s] start (source=%s, pauta=%s) — %s", generation_id, source_type, pauta_id, title[:60])

    with pipeline_trace(
        "mkt-livo-pipeline",
        input=title,
        session_id=generation_id,
        metadata={"source_type": source_type, "pauta_id": pauta_id},
    ) as root:
        try:
            # 1. Curador
            try:
                with step_span("curador", input=title):
                    decision = await asyncio.to_thread(
                        step1_curator.curate,
                        source_type=source_type,
                        title=title,
                        content=content,
                        link=link,
                        marca_hint=marca_hint,
                        plataforma=plataforma_efetiva,
                        pauta_marca=pauta_marca,
                        pauta_titulo=pauta_titulo,
                        pauta_briefing=pauta_briefing,
                        angulo=angulo,
                        items_count=items_count,
                    )
            except step1_curator.CuradorRejected as e:
                logger.info("[%s] curador reprovou: %s", generation_id, e.razao)
                if link:
                    await asyncio.to_thread(
                        blog_content.save_result, link=link, message=e.raw or e.razao, status="nao_aprovado"
                    )
                await asyncio.to_thread(
                    _log_rss_ledger,
                    source_type=source_type,
                    feed_url=feed_url,
                    link=link,
                    title=title,
                    content=content,
                    promoted=False,
                    reason=e.razao,
                )
                await asyncio.to_thread(
                    gs.complete, generation_id, gs.STATUS_FAILED, error=f"curador reprovou: {e.razao}"
                )
                if pauta_id:
                    await asyncio.to_thread(pautas.mark_failed, pauta_id, f"curador reprovou: {e.razao}")
                if root is not None:
                    root.update(output={"rejected": "curador", "razao": e.razao})
                return {"generation_id": generation_id, "post_id": None, "rejected": "curador", "razao": e.razao}

            marca = decision["marca"]
            vertical = decision["vertical"]
            if link:
                await asyncio.to_thread(
                    blog_content.save_result, link=link, message=decision["curador_output"], status="aprovado"
                )
            await asyncio.to_thread(
                _log_rss_ledger,
                source_type=source_type,
                feed_url=feed_url,
                link=link,
                title=title,
                content=content,
                promoted=True,
                reason=decision.get("curador_output"),
                pauta_id=pauta_id,
            )

            # 2. Redator
            await asyncio.to_thread(gs.update, generation_id, gs.STATUS_WRITING)
            with step_span("redator"):
                redator_output = await asyncio.to_thread(
                    step2_writer.write,
                    marca=marca,
                    vertical=vertical,
                    plataforma=plataforma_efetiva,
                    curador_output=decision["curador_output"],
                    article_text=content,
                    briefing=briefing or pauta_briefing,
                )

            # 3. Revisor (gate)
            await asyncio.to_thread(gs.update, generation_id, gs.STATUS_REVIEWING)
            try:
                with step_span("revisor"):
                    await asyncio.to_thread(
                        step3_reviewer.review,
                        marca=marca, plataforma=plataforma_efetiva, redator_output=redator_output,
                    )
            except step3_reviewer.ReviewRejected as e:
                logger.info("[%s] revisor reprovou", generation_id)
                await asyncio.to_thread(
                    gs.complete, generation_id, gs.STATUS_FAILED, error="revisor reprovou o conteúdo"
                )
                if pauta_id:
                    await asyncio.to_thread(pautas.mark_failed, pauta_id, "revisor reprovou")
                if root is not None:
                    root.update(output={"rejected": "revisor", "feedback": e.feedback[:300]})
                return {"generation_id": generation_id, "post_id": None, "rejected": "revisor"}

            # 4. Designer + imagem + composição de logo
            await asyncio.to_thread(gs.update, generation_id, gs.STATUS_GENERATING_IMAGE)
            with step_span("designer"):
                design = await asyncio.to_thread(step4_designer.design, marca=marca, redator_output=redator_output)
            with step_span("image"):
                media = await asyncio.to_thread(
                    step5_image.generate,
                    image_prompt=design["image_prompt"],
                    marca=marca,
                    logo_variant=design["logo_variant"],
                    logo_zone_contrast=design["logo_zone_contrast"],
                )

            # 5. Extrai título/resumo/conteúdo do markdown do Redator
            parsed = markdown_parser.parse_redator_output(redator_output)

            # 6. Handoff → Edge Function
            await asyncio.to_thread(gs.update, generation_id, gs.STATUS_CREATING_POST)
            with step_span("handoff"):
                post_id = await asyncio.to_thread(
                    step6_handoff.handoff,
                    title=parsed["titulo"] or title,
                    content=parsed["conteudo"] or redator_output,
                    excerpt=parsed["resumo"],
                    marca=marca,
                    media=media,
                    image_prompt=design["image_prompt"],
                    channels=channels,
                    # origem precisa bater com a check constraint mkt_social_posts_origem_check
                    # (agenda_editorial | rss | manual | arquivo | n8n). source_type="pauta"
                    # mapeia para "agenda_editorial" — enviar "pauta" cru viola a constraint.
                    origem={"pauta": "agenda_editorial", "arquivo": "arquivo", "rss": "rss"}.get(source_type, "n8n"),
                    pauta_id=pauta_id,
                    observacoes=observacoes,
                    link_referencia=link or None,
                )

            # 7. Terminal
            await asyncio.to_thread(gs.complete, generation_id, gs.STATUS_COMPLETED, post_id=post_id)
            if pauta_id:
                await asyncio.to_thread(pautas.mark_done, pauta_id)
            logger.info("[%s] done — post_id=%s em %.1fs (marca=%s)", generation_id, post_id, time.time() - t0, marca)
            if root is not None:
                root.update(output={"post_id": post_id, "marca": marca})
            return {"generation_id": generation_id, "post_id": post_id, "marca": marca, "media": media}

        except Exception as e:
            logger.exception("[%s] FAILED: %s", generation_id, e)
            await asyncio.to_thread(gs.complete, generation_id, gs.STATUS_FAILED, error=str(e)[:500])
            if pauta_id:
                await asyncio.to_thread(pautas.mark_failed, pauta_id, str(e))
            raise
        finally:
            lf_flush()
