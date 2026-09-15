"""Testes das funções puras de parsing (sem I/O externo)."""
import pytest

from src.lib import brand, curador_parser, designer_parser, markdown_parser


# ----------------------------- brand -----------------------------
def test_normalize_channels_dedup_and_alias():
    assert brand.normalize_channels("Instagram, insta, IG, linkedin") == ["instagram", "linkedin"]
    assert brand.normalize_channels(["blog", "site", "newsletter"]) == ["blog", "newsletter"]
    assert brand.normalize_channels("") == []


def test_infer_marca_rco_casco():
    assert brand.infer_marca("Novidades sobre RCO no transporte") == "livonius"
    assert brand.infer_marca("Seguro Casco Ônibus da frota") == "livonius"
    assert brand.infer_marca("Seguro saúde empresarial", default="livo") == "livo"


# ----------------------------- curador -----------------------------
def test_curador_rejection_raises():
    with pytest.raises(curador_parser.CuradorRejected):
        curador_parser.parse_decision("STATUS: NÃO APROVADO | Score: 3/10\nMOTIVO: fora de escopo")


def test_curador_marca_from_output():
    out = "STATUS: APROVADO | Score: 8/10 | Vertical: rco | Marca: livonius | Tier: 1"
    d = curador_parser.parse_decision(out)
    assert d["marca"] == "livonius"
    assert d["vertical"] == "rco"


def test_curador_pauta_marca_overrides():
    out = "STATUS: APROVADO | Score: 7/10 | Vertical: saude | Marca: livo"
    d = curador_parser.parse_decision(out, pauta_marca="livonius")
    assert d["marca"] == "livonius"  # marca da pauta tem precedência


def test_curador_fallback_heuristic():
    out = "STATUS: APROVADO | Score: 7/10 | Vertical: casco ônibus"
    d = curador_parser.parse_decision(out)
    assert d["marca"] == "livonius"


# ----------------------------- markdown (Redator) -----------------------------
def test_markdown_extracts_title_resumo_conteudo():
    md = "# Título do Post\n\nSubtítulo curto\n\nPrimeiro parágrafo do corpo.\n\nSegundo parágrafo."
    parsed = markdown_parser.parse_redator_output(md)
    assert parsed["titulo"] == "Título do Post"
    assert parsed["resumo"] == "Subtítulo curto"
    assert "Primeiro parágrafo" in parsed["conteudo"]


def test_markdown_bold_title():
    md = "**Manchete forte**\n\nCorpo direto sem subtítulo bem longo que passa de duzentos caracteres " + "x" * 200
    parsed = markdown_parser.parse_redator_output(md)
    assert parsed["titulo"] == "Manchete forte"


# ----------------------------- designer -----------------------------
_CLOSING = "No text, no numbers, no logos, no brand marks, no charts, no labels anywhere in the image."


def test_designer_valid_json():
    raw = (
        '{"image_prompt": "Premium editorial photography of a modern bus on a Brazilian highway '
        "at golden hour, wide composition with 45% sky reserved top-right for the logo, deep teal "
        f'accents, sophisticated atmosphere. {_CLOSING}", "logo_variant": "white", "logo_zone_contrast": "dark"}}'
    )
    out = designer_parser.parse_designer_output(raw)
    assert out["logo_variant"] == "white"
    assert out["logo_zone_contrast"] == "dark"
    assert out["image_prompt"].endswith(_CLOSING)


def test_designer_rejects_analysis_text():
    raw = "Article analysis: this piece is about buses. Subject: a bus. " + _CLOSING
    with pytest.raises(designer_parser.DesignerOutputInvalid):
        designer_parser.parse_designer_output(raw)


def test_designer_rejects_missing_closing():
    raw = '{"image_prompt": "A very long and detailed editorial photograph of a Brazilian highway scene ' + "x" * 150 + '"}'
    with pytest.raises(designer_parser.DesignerOutputInvalid):
        designer_parser.parse_designer_output(raw)
