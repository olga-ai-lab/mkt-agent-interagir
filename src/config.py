"""Carrega variáveis de ambiente do agente Marketing Livonius/Livo.

Diferente do olga-mkt-agent, este agente usa OpenAI (gpt-4o/gpt-5) para os
agentes de texto (Curador/Redator/Revisor) — preservando o comportamento
aprovado no n8n — e Claude apenas para o Designer (geração do prompt visual).
Todos os modelos são configuráveis por env para permitir troca de provider.
"""
import os

from dotenv import load_dotenv

load_dotenv()

# --- Supabase (projeto compartilhado vywalfkdlbmuoyxfgjhc) ---
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://vywalfkdlbmuoyxfgjhc.supabase.co")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
# Este agente é o do módulo Livo Interagir: lê/escreve no schema "interagir",
# nunca em "public" (dados de produção do Livonius). Configurável só para
# permitir rodar contra um branch de teste do Supabase.
SUPABASE_SCHEMA = os.getenv("SUPABASE_SCHEMA", "interagir")

# --- OpenAI (Curador / Redator / Revisor + extração de arquivo + gpt-image-1) ---
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_CURADOR_MODEL = os.getenv("OPENAI_CURADOR_MODEL", "gpt-4o")
OPENAI_CURADOR_PERMISSIVE_MODEL = os.getenv("OPENAI_CURADOR_PERMISSIVE_MODEL", "gpt-5")
OPENAI_REDATOR_MODEL = os.getenv("OPENAI_REDATOR_MODEL", "gpt-5")
OPENAI_REVISOR_MODEL = os.getenv("OPENAI_REVISOR_MODEL", "gpt-4o")
OPENAI_RANKER_MODEL = os.getenv("OPENAI_RANKER_MODEL", "gpt-4o")
OPENAI_TEXT_MODEL = os.getenv("OPENAI_TEXT_MODEL", "gpt-4.1")  # extração de arquivo/imagem
OPENAI_IMAGE_MODEL = os.getenv("OPENAI_IMAGE_MODEL", "gpt-image-1")

# --- Anthropic (Designer — geração do prompt visual) ---
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
ANTHROPIC_DESIGNER_MODEL = os.getenv("ANTHROPIC_DESIGNER_MODEL", "claude-sonnet-4-5")

# --- Storage / Edge Functions ---
# Bucket onde as imagens cruas do gpt-image-1 são gravadas antes da composição do logo.
MKT_IMAGE_BUCKET = os.getenv("MKT_IMAGE_BUCKET", "interagir-article-images")
# Edge Function que carimba o logo da marca na imagem crua.
COMPOSITE_LOGO_EF = os.getenv(
    "COMPOSITE_LOGO_EF",
    f"{SUPABASE_URL}/functions/v1/interagir-composite-logo",
)
# Edge Function que cria o post em mkt_social_posts (status IN_REVIEW_INTERNAL).
RECEIVE_UPLOAD_EF = os.getenv(
    "RECEIVE_UPLOAD_EF",
    f"{SUPABASE_URL}/functions/v1/interagir-receive-n8n-upload",
)

# --- RSS feeds (um por marca, como no n8n) ---
RSS_FEED_LIVO = os.getenv("RSS_FEED_LIVO", "https://rss.app/feeds/_KEXK5NbJ9zcBgT8r.xml")
RSS_FEED_LIVONIUS = os.getenv("RSS_FEED_LIVONIUS", "https://rss.app/feeds/_rKuKzclkfkdj7dUs.xml")
# Feed usado no enriquecimento de pauta editorial (RSS direcionado).
RSS_FEED_PAUTA = os.getenv("RSS_FEED_PAUTA", "https://rss.app/feeds/_R1o40aZsXDfzML7D.xml")

# --- Comportamento ---
AGENT_SHARED_SECRET = os.getenv("AGENT_SHARED_SECRET", "")
AUTOMATION_MAX_ITEMS = int(os.getenv("AUTOMATION_MAX_ITEMS", "5"))
RSS_CANDIDATE_POOL = int(os.getenv("RSS_CANDIDATE_POOL", "40"))
RANKER_SELECT_COUNT = int(os.getenv("RANKER_SELECT_COUNT", "5"))
DEFAULT_MARCA = os.getenv("DEFAULT_MARCA", "livonius")

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
PORT = int(os.getenv("PORT", "8000"))

# --- Observabilidade (Langfuse) — opcional; no-op sem as chaves ---
LANGFUSE_PUBLIC_KEY = os.getenv("LANGFUSE_PUBLIC_KEY", "")
LANGFUSE_SECRET_KEY = os.getenv("LANGFUSE_SECRET_KEY", "")
LANGFUSE_HOST = os.getenv("LANGFUSE_HOST", "https://cloud.langfuse.com")
LANGFUSE_AGENT_TAG = os.getenv("LANGFUSE_AGENT_TAG", "mkt-agent-livo")
