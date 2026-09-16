"""Supabase client singleton — sempre com service_role (agente é backend trusted)."""
from functools import lru_cache
from typing import Any

from supabase import Client, create_client

from ..config import SUPABASE_SCHEMA, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL


class _SchemaScopedClient:
    """Proxy que aplica sempre `SUPABASE_SCHEMA` em `.table()`, preservando
    storage/auth/functions do client base.

    `create_client(..., options=ClientOptions(schema=...))` quebra nesta
    versão do supabase-py (AttributeError: 'ClientOptions' object has no
    attribute 'storage', dentro de `_init_supabase_auth_client`). `.table()`
    é escopado via `client.schema(name)` — que devolve só um postgrest
    client, sem `.storage` — daí o proxy repassar os demais atributos.
    """

    def __init__(self, client: Client, schema: str) -> None:
        self._client = client
        self._schema = schema

    def table(self, name: str):
        return self._client.schema(self._schema).table(name)

    def __getattr__(self, item: str) -> Any:
        return getattr(self._client, item)


@lru_cache(maxsize=1)
def get_supabase() -> _SchemaScopedClient:
    if not SUPABASE_SERVICE_ROLE_KEY:
        raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY not configured")
    # schema="interagir" por padrão — este agente nunca deve ler/escrever no
    # schema "public" (dados de produção do Livonius).
    client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    return _SchemaScopedClient(client, SUPABASE_SCHEMA)
