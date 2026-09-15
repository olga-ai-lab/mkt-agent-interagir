"""Parsing + validação do output do Designer.

Replica o nó Extrair_Prompt_Designer2 do n8n: aceita JSON
{image_prompt, logo_variant, logo_zone_contrast} ou um prompt marcado, e recusa
saídas que sejam análise/raciocínio em vez do prompt final. O prompt precisa
terminar com a frase obrigatória de "No text, no numbers, no logos...".
"""
from __future__ import annotations

import json
import re

_CLOSING_RE = re.compile(
    r"No text, no numbers, no logos, no brand marks, no charts, no labels anywhere in the image\.?$",
    re.IGNORECASE,
)
_UNSAFE_RE = re.compile(
    r"(article analysis|brand application|visual signals|now i.?ll analyze|i.?ll process|"
    r"i will analyze|subject:|atmosphere:|action:|coverage:|internal process|do not output|"
    r"according to the .* specifications)",
    re.IGNORECASE,
)

_VALID_VARIANTS = {"normal", "white", "auto"}
_VALID_CONTRAST = {"light", "dark", "mixed"}


class DesignerOutputInvalid(Exception):
    """Designer não produziu um prompt visual seguro/utilizável."""


def _strip_fence(text: str) -> str:
    text = (text or "").strip()
    text = re.sub(r"^```(?:json|text)?\s*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s*```$", "", text)
    return text.strip()


def _clean_prompt(value: str) -> str:
    return re.sub(r"^image_prompt\s*[:=-]\s*", "", str(value or ""), flags=re.IGNORECASE).strip()


def _is_usable(text: str) -> bool:
    prompt = _clean_prompt(text)
    if len(prompt) < 120:
        return False
    if _UNSAFE_RE.search(prompt):
        return False
    if not _CLOSING_RE.search(prompt):
        return False
    return True


def _extract_json(text: str) -> dict | None:
    clean = _strip_fence(text)
    try:
        obj = json.loads(clean)
        return obj if isinstance(obj, dict) else None
    except json.JSONDecodeError:
        pass
    start = clean.find("{")
    if start < 0:
        return None
    depth = 0
    in_str = False
    esc = False
    for i in range(start, len(clean)):
        c = clean[i]
        if esc:
            esc = False
            continue
        if c == "\\":
            esc = True
            continue
        if c == '"':
            in_str = not in_str
            continue
        if in_str:
            continue
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                try:
                    obj = json.loads(clean[start:i + 1])
                    return obj if isinstance(obj, dict) else None
                except json.JSONDecodeError:
                    return None
    return None


def _norm_variant(v: str | None) -> str:
    v = str(v or "").strip().lower()
    return v if v in _VALID_VARIANTS else "auto"


def _norm_contrast(v: str | None) -> str:
    v = str(v or "").strip().lower()
    return v if v in _VALID_CONTRAST else "mixed"


def parse_designer_output(raw: str) -> dict[str, str]:
    """Retorna {image_prompt, logo_variant, logo_zone_contrast}. Levanta se inseguro."""
    raw = raw or ""
    parsed = _extract_json(raw)

    image_prompt = ""
    logo_variant = "auto"
    logo_zone_contrast = "mixed"

    if parsed:
        image_prompt = _clean_prompt(parsed.get("image_prompt") or parsed.get("output") or "")
        logo_variant = _norm_variant(parsed.get("logo_variant"))
        logo_zone_contrast = _norm_contrast(parsed.get("logo_zone_contrast"))
    else:
        candidate = _strip_fence(raw)
        marker = re.search(
            r"(?:final image prompt|final prompt|image prompt|prompt)\s*[:\-]\s*",
            candidate,
            re.IGNORECASE,
        )
        if marker:
            tail = candidate[marker.end():].strip().rstrip("`").strip()
            if _is_usable(tail):
                image_prompt = _clean_prompt(tail)
        if not image_prompt and _is_usable(candidate):
            image_prompt = _clean_prompt(candidate)

    if not _is_usable(image_prompt):
        preview = raw[:400] or "empty response"
        raise DesignerOutputInvalid(
            "Designer não devolveu um prompt final válido (JSON ou prompt seguro). "
            f"Preview: {preview}"
        )

    return {
        "image_prompt": image_prompt,
        "logo_variant": logo_variant,
        "logo_zone_contrast": logo_zone_contrast,
    }
