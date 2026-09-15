"""Supabase client singleton — sempre com service_role (agente é backend trusted)."""
from functools import lru_cache

from supabase import Client, create_client
from supabase.lib.client_options import ClientOptions

from ..config import SUPABASE_SCHEMA, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL


@lru_cache(maxsize=1)
def get_supabase() -> Client:
    if not SUPABASE_SERVICE_ROLE_KEY:
        raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY not configured")
    # schema="interagir" por padrão — este agente nunca deve ler/escrever no
    # schema "public" (dados de produção do Livonius).
    return create_client(
        SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY,
        options=ClientOptions(schema=SUPABASE_SCHEMA),
    )
