"""Observabilidade LLM (Langfuse) — opcional e no-op quando desligado.

LIGA SOZINHO quando LANGFUSE_PUBLIC_KEY e LANGFUSE_SECRET_KEY existem no
ambiente (LANGFUSE_HOST escolhe a região: https://cloud.langfuse.com [EU] ou
https://us.cloud.langfuse.com [US]). Sem as chaves é no-op total — seguro
deployar antes de criar/colar as chaves.

Padrão (igual ao chat-olga/agentes Node): um trace por pipeline, uma generation
por chamada de LLM (tokens + custo) e um span por etapa. Como o orchestrator roda
cada etapa via asyncio.to_thread (que copia o contextvars), as generations criadas
dentro de call_claude/generate_image aninham sozinhas sob o span da etapa ativa.

LANGFUSE_AGENT_TAG separa este agente dos demais dentro do projeto Langfuse
compartilhado: toda trace recebe essa tag para filtrar custo/desempenho por agente.
"""
import contextlib
import logging
import os

from dotenv import load_dotenv

load_dotenv()  # idempotente; garante LANGFUSE_* carregadas independente da ordem de import

logger = logging.getLogger(__name__)

AGENT_TAG = os.getenv("LANGFUSE_AGENT_TAG", "mkt-agent-livo")
_enabled = bool(os.getenv("LANGFUSE_PUBLIC_KEY") and os.getenv("LANGFUSE_SECRET_KEY"))

_client = None
_propagate_attributes = None
if _enabled:
    try:
        from langfuse import Langfuse, propagate_attributes

        _client = Langfuse()  # lê LANGFUSE_PUBLIC_KEY / SECRET_KEY / HOST do ambiente
        _propagate_attributes = propagate_attributes
        logger.info("[langfuse] habilitado (tag: %s)", AGENT_TAG)
    except Exception as e:  # nunca derrubar o app por causa de telemetria
        logger.error("[langfuse] init falhou: %s", e)
        _client = None


def langfuse_enabled() -> bool:
    return _client is not None


def lf_status() -> dict:
    pk = os.getenv("LANGFUSE_PUBLIC_KEY")
    return {
        "enabled": _client is not None,
        "agent_tag": AGENT_TAG,
        "public_key_prefix": pk[:6] if pk else None,
        "host": os.getenv("LANGFUSE_HOST", "(default: https://cloud.langfuse.com)"),
    }


@contextlib.contextmanager
def pipeline_trace(name: str, *, input=None, session_id=None, user_id=None, metadata=None):
    """Span raiz de uma pipeline (= trace). Yields o span ou None (no-op).

    Usa propagate_attributes (API v4) para fixar tag/sessão/usuário no trace e
    propagá-las para todos os spans/generations filhos criados dentro do contexto.

    Telemetria nunca derruba o app: se a criação falhar (ex.: SDK incompatível),
    cai pra no-op (yield None) sem impedir o orchestrator de marcar status/falha.
    O corpo (`with`) roda sempre; exceções dele são propagadas normalmente.
    """
    if _client is None:
        yield None
        return
    try:
        stack = contextlib.ExitStack()
        span = stack.enter_context(
            _client.start_as_current_observation(name=name, as_type="span", input=input)
        )
        meta = {k: str(v) for k, v in (metadata or {}).items()} or None
        stack.enter_context(
            _propagate_attributes(
                tags=[AGENT_TAG],
                session_id=session_id,
                user_id=user_id,
                metadata=meta,
                trace_name=name,
            )
        )
    except Exception as e:
        logger.debug("[langfuse] pipeline_trace setup falhou: %s", e)
        yield None
        return
    with stack:  # ExitStack repassa exc info do corpo ao __exit__ das observações
        yield span


@contextlib.contextmanager
def step_span(name: str, *, input=None):
    """Span de uma etapa da pipeline. Yields o span ou None (no-op)."""
    if _client is None:
        yield None
        return
    try:
        stack = contextlib.ExitStack()
        span = stack.enter_context(
            _client.start_as_current_observation(name=name, as_type="span", input=input)
        )
    except Exception as e:
        logger.debug("[langfuse] step_span setup falhou: %s", e)
        yield None
        return
    with stack:
        yield span


@contextlib.contextmanager
def generation(name: str, *, model=None, input=None, model_parameters=None):
    """Generation (chamada de LLM). Yields a generation ou None (no-op)."""
    if _client is None:
        yield None
        return
    try:
        stack = contextlib.ExitStack()
        gen = stack.enter_context(
            _client.start_as_current_observation(
                name=name,
                as_type="generation",
                model=model,
                input=input,
                model_parameters=model_parameters or {},
            )
        )
    except Exception as e:
        logger.debug("[langfuse] generation setup falhou: %s", e)
        yield None
        return
    with stack:
        yield gen


def record_usage(gen, resp, *, output=None) -> None:
    """Anota tokens (custo) e saída numa generation a partir da resposta do SDK."""
    if gen is None:
        return
    try:
        details: dict = {}
        usage = getattr(resp, "usage", None)
        if usage is not None:
            if hasattr(usage, "input_tokens"):  # Anthropic / gpt-image-1
                details = {
                    "input": getattr(usage, "input_tokens", 0) or 0,
                    "output": getattr(usage, "output_tokens", 0) or 0,
                }
                cache_read = getattr(usage, "cache_read_input_tokens", 0) or 0
                cache_creation = getattr(usage, "cache_creation_input_tokens", 0) or 0
                if cache_read:
                    details["cache_read_input_tokens"] = cache_read
                if cache_creation:
                    details["cache_creation_input_tokens"] = cache_creation
            elif hasattr(usage, "total_tokens"):  # OpenAI chat-style
                details = {
                    "input": getattr(usage, "prompt_tokens", 0) or 0,
                    "output": getattr(usage, "completion_tokens", 0) or 0,
                    "total": usage.total_tokens,
                }
        gen.update(output=output, usage_details=details or None)
    except Exception as e:
        logger.debug("[langfuse] record_usage falhou: %s", e)


def flush() -> None:
    if _client is not None:
        try:
            _client.flush()
        except Exception as e:
            logger.debug("[langfuse] flush falhou: %s", e)


def boot_check() -> None:
    """Trace de fumaça no boot: aparece um 'boot-check' no Langfuse segundos após
    o deploy se chave/região estiverem certas."""
    if _client is None:
        return
    try:
        with _client.start_as_current_observation(
            name="boot-check", as_type="span", input="ping do deploy"
        ):
            with _propagate_attributes(tags=[AGENT_TAG]):
                pass
        _client.flush()
        logger.info("[langfuse] boot-check enviado")
    except Exception as e:
        logger.error("[langfuse] boot-check falhou: %s", e)
