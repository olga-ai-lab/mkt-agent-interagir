"""Acesso a mkt_pautas (agenda editorial do Marketing Livonius/Livo).

Colunas relevantes (schema real do projeto vywalfkdlbmuoyxfgjhc):
  id, titulo, briefing, link_referencia, status, observacoes, marca,
  plataforma, vertical, data_prevista, created_at, updated_at

Status observados: pendente | processando | gerado. Preservamos exatamente os
mesmos rótulos do n8n para não quebrar a UI da agenda editorial.
"""
import logging
from typing import Any

from ..clients.supabase_client import get_supabase

logger = logging.getLogger(__name__)

STATUS_PENDENTE = "pendente"
STATUS_PROCESSANDO = "processando"
STATUS_GERADO = "gerado"
STATUS_FALHOU = "falhou"
STATUS_ERRO = "erro"  # aba "Erros" da agenda editorial; segue liberado para disparo manual

# Mesma trava de negócio da Edge Function mkt-trigger-agenda-pauta: só pautas
# nesses status podem ser disparadas manualmente (evita reprocessar uma pauta
# já 'gerado' por engano, ou uma que está em processamento por outro trigger).
MANUAL_TRIGGER_ALLOWED_STATUSES = {STATUS_PENDENTE, STATUS_ERRO, STATUS_PROCESSANDO}


def can_manually_trigger(pauta: dict[str, Any]) -> bool:
    return str(pauta.get("status") or "").strip().lower() in MANUAL_TRIGGER_ALLOWED_STATUSES


def get_by_id(pauta_id: int) -> dict[str, Any] | None:
    sb = get_supabase()
    res = sb.table("mkt_pautas").select("*").eq("id", pauta_id).limit(1).execute()
    rows = res.data or []
    return rows[0] if rows else None


def list_pending(limit: int = 5) -> list[dict[str, Any]]:
    """Pautas pendentes da agenda editorial (workflow sheets_rss)."""
    sb = get_supabase()
    res = (
        sb.table("mkt_pautas")
        .select("*")
        .eq("status", STATUS_PENDENTE)
        .order("data_prevista")
        .order("created_at")
        .limit(limit)
        .execute()
    )
    return res.data or []


def mark_processing(pauta_id: int) -> None:
    sb = get_supabase()
    sb.table("mkt_pautas").update(
        {"status": STATUS_PROCESSANDO, "updated_at": "now()"}
    ).eq("id", pauta_id).execute()


def mark_done(pauta_id: int) -> None:
    sb = get_supabase()
    sb.table("mkt_pautas").update(
        {"status": STATUS_GERADO, "updated_at": "now()"}
    ).eq("id", pauta_id).execute()


def mark_failed(pauta_id: int, error: str) -> None:
    """Falha na pipeline — marca a pauta como 'erro' com a observação do motivo.

    'erro' e não 'pendente': a agenda editorial tem uma aba Erros própria, e devolver
    para 'pendente' fazia a falha sumir da UI — a pauta voltava para a fila como se
    nada tivesse acontecido e o motivo só existia em observacoes. 'erro' segue liberado
    para disparo manual (MANUAL_TRIGGER_ALLOWED_STATUSES), então a equipe reprocessa
    pelo mesmo botão depois de ajustar a pauta.
    """
    sb = get_supabase()
    obs = f"[agente] falha: {error[:400]}"
    sb.table("mkt_pautas").update(
        {"status": STATUS_ERRO, "observacoes": obs, "updated_at": "now()"}
    ).eq("id", pauta_id).execute()
