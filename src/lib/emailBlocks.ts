import { buildBlockEmailShell, wrapEmail, type EmailGenerationSettings } from "./emailTemplates";

export type EmailBlockType =
  | "heading"
  | "text"
  | "button"
  | "image"
  | "file"
  | "html"
  | "divider"
  | "spacer"
  | "table";

export type BlockAlign = "left" | "center" | "right";

export interface EmailBlock {
  id: string;
  type: EmailBlockType;
  html?: string;
  align?: BlockAlign;
  /** heading/text font color override */
  textColor?: string;
  /** button */
  label?: string;
  url?: string;
  color?: string;
  radius?: number;
  full?: boolean;
  /** image */
  src?: string;
  alt?: string;
  /** file (src reused for the file URL, label for the display name) */
  fileName?: string;
  /** spacer (px) */
  height?: number;
  /** table */
  rows?: string[][];
  headerRow?: boolean;
  zebra?: boolean;
}

export const LIVO_TEAL = "#1a6b5a";

let _seq = 0;
export function newBlockId(): string {
  _seq += 1;
  return `blk_${Date.now().toString(36)}_${_seq}`;
}

export function createBlock(type: EmailBlockType): EmailBlock {
  const base: EmailBlock = { id: newBlockId(), type };
  switch (type) {
    case "heading":
      return { ...base, html: "Novo título", align: "left" };
    case "text":
      return { ...base, html: "Escreva o conteúdo da mensagem aqui…", align: "left" };
    case "button":
      return { ...base, label: "Saiba mais", url: "https://", color: LIVO_TEAL, radius: 6, align: "left", full: false };
    case "image":
      return { ...base, src: "", alt: "" };
    case "file":
      return { ...base, src: "", label: "Baixar arquivo", fileName: "", align: "left", color: LIVO_TEAL, radius: 8, full: false };
    case "html":
      return { ...base, html: "" };
    case "divider":
      return base;
    case "spacer":
      return { ...base, height: 22 };
    case "table":
      return {
        ...base,
        headerRow: true,
        zebra: true,
        rows: [
          ["Produto", "Valor"],
          ["—", "—"],
        ],
      };
    default:
      return base;
  }
}

// ------------------------------------------------------------------ sanitize
const ALLOWED_TAGS = new Set(["B", "STRONG", "I", "EM", "U", "A", "BR", "UL", "OL", "LI", "P", "SPAN", "DIV"]);

export function sanitizeInlineHtml(raw: string): string {
  if (!raw) return "";
  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    return raw
      .replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] as string))
      .replace(/\n/g, "<br>");
  }
  const doc = new DOMParser().parseFromString(`<div>${raw}</div>`, "text/html");
  const root = doc.body.firstChild as HTMLElement | null;
  if (!root) return "";

  const walk = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      return (node.textContent || "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] as string));
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    const el = node as HTMLElement;
    const tag = el.tagName;
    const inner = Array.from(el.childNodes).map(walk).join("");
    if (!ALLOWED_TAGS.has(tag)) return inner;
    if (tag === "BR") return "<br>";
    if (tag === "A") {
      const href = el.getAttribute("href") || "";
      const safe = /^(https?:|mailto:|\{\{)/i.test(href) ? href : "#";
      return `<a href="${safe.replace(/"/g, "&quot;")}" style="color:${LIVO_TEAL};text-decoration:underline">${inner}</a>`;
    }
    const map: Record<string, string> = { STRONG: "b", B: "b", EM: "i", I: "i", U: "u", UL: "ul", OL: "ol", LI: "li", P: "p", SPAN: "span", DIV: "div" };
    const t = map[tag] || "span";
    return `<${t}>${inner}</${t}>`;
  };

  return Array.from(root.childNodes).map(walk).join("").trim();
}

function esc(s: string): string {
  return (s || "").replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c] as string));
}

// ------------------------------------------------------------------ render
function renderBlock(b: EmailBlock, bodyTextColor?: string): string {
  const align = b.align || "left";
  switch (b.type) {
    case "heading":
      return `<tr><td style="padding:6px 36px 2px;background:#fff;text-align:${align}">
        <h2 style="margin:0;font-size:20px;line-height:1.3;color:${b.textColor || LIVO_TEAL};font-weight:700">${sanitizeInlineHtml(b.html || "")}</h2>
      </td></tr>`;
    case "text":
      return `<tr><td style="padding:8px 36px;background:#fff;text-align:${align};font-size:15px;line-height:1.62;color:${b.textColor || bodyTextColor || "#333"}">${sanitizeInlineHtml(b.html || "")}</td></tr>`;
    case "button": {
      const radius = Math.max(0, Math.min(26, b.radius ?? 6));
      const color = b.color || LIVO_TEAL;
      const url = /^(https?:|mailto:|\{\{)/i.test(b.url || "") ? (b.url as string) : "#";
      const width = b.full ? "width:100%;display:block;" : "";
      return `<tr><td style="padding:12px 36px;background:#fff;text-align:${align}">
        <a href="${esc(url)}" style="${width}background:${color};color:#fff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 26px;border-radius:${radius}px;display:inline-block;text-align:center">${esc(b.label || "Botão")}</a>
      </td></tr>`;
    }
    case "image":
      return b.src
        ? `<tr><td style="padding:10px 36px;background:#fff;text-align:${align}"><img src="${esc(b.src)}" alt="${esc(b.alt || "")}" style="max-width:100%;border-radius:8px;display:inline-block"></td></tr>`
        : `<tr><td style="padding:10px 36px;background:#fff"><div style="border:1px dashed #cfdbd7;border-radius:8px;padding:26px;text-align:center;color:#8a9793;font-size:13px">Imagem</div></td></tr>`;
    case "file": {
      if (!b.src) {
        return `<tr><td style="padding:10px 36px;background:#fff"><div style="border:1px dashed #cfdbd7;border-radius:8px;padding:26px;text-align:center;color:#8a9793;font-size:13px">Arquivo</div></td></tr>`;
      }
      const radius = Math.max(0, Math.min(26, b.radius ?? 8));
      const color = b.color || LIVO_TEAL;
      const width = b.full ? "width:100%;display:block;" : "";
      const download = b.fileName ? ` download="${esc(b.fileName)}"` : "";
      return `<tr><td style="padding:12px 36px;background:#fff;text-align:${align}">
        <a href="${esc(b.src)}"${download} style="${width}background:${color};color:#fff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 26px;border-radius:${radius}px;display:inline-block;text-align:center">📎 ${esc(b.label || "Baixar arquivo")}</a>
      </td></tr>`;
    }
    case "html":
      return `<tr><td style="background:#fff">${b.html || ""}</td></tr>`;
    case "divider":
      return `<tr><td style="padding:8px 36px;background:#fff"><div style="height:1px;background:#e4e9e7;line-height:1px">&nbsp;</div></td></tr>`;
    case "spacer":
      return `<tr><td style="background:#fff;height:${Math.max(4, b.height ?? 22)}px;line-height:${Math.max(4, b.height ?? 22)}px">&nbsp;</td></tr>`;
    case "table": {
      const rows = b.rows || [];
      const body = rows
        .map((cells, r) => {
          const isHead = b.headerRow && r === 0;
          const bg = isHead ? LIVO_TEAL : b.zebra && r % 2 === 0 ? "#f4f8f7" : "#fff";
          const fg = isHead ? "#fff" : "#333";
          const weight = isHead ? "600" : "400";
          const tds = cells
            .map((c) => `<td style="border:1px solid #e4e9e7;padding:9px 12px;font-size:13px;color:${fg};font-weight:${weight}">${esc(c)}</td>`)
            .join("");
          return `<tr style="background:${bg}">${tds}</tr>`;
        })
        .join("");
      return `<tr><td style="padding:10px 36px;background:#fff">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">${body}</table>
      </td></tr>`;
    }
    default:
      return "";
  }
}

export function renderBlocksToHtml(
  blocks: EmailBlock[],
  settings: EmailGenerationSettings = {},
  headerTitle?: string,
): string {
  const title = headerTitle || settings.header_title || "NEWSLETTER";
  const { header, footer } = buildBlockEmailShell(title, settings);
  const body = blocks.map((b) => renderBlock(b, settings.body_text_color)).join("\n");
  // Os espaçadores de respiro entre cabeçalho/corpo e corpo/rodapé só fazem
  // sentido quando há de fato uma faixa de marca ali — caso contrário sobra
  // uma barra branca vazia sem nada acima/abaixo para justificar o espaço.
  const topSpacer = settings.hide_header ? "" : `<tr><td style="padding:16px 0 6px;background:#fff"></td></tr>`;
  const bottomSpacer = settings.hide_footer ? "" : `<tr><td style="padding:8px 0;background:#fff"></td></tr>`;
  const inner = `
  <table role="presentation" align="center" width="600" cellpadding="0" cellspacing="0" style="background:#fff;margin:0 auto;overflow:hidden;">
    ${header}
    ${topSpacer}
    ${body}
    ${bottomSpacer}
    ${footer}
  </table>`;
  return wrapEmail(inner);
}

/** True while blocks is still exactly the untouched default single placeholder text block. */
export function isBlankSeed(blocks: EmailBlock[]): boolean {
  if (blocks.length !== 1) return false;
  const [b] = blocks;
  return b.type === "text" && (b.html || "") === "Escreva o conteúdo da mensagem aqui…";
}

/** Wraps raw HTML (e.g. AI-assistant output) into a single html-type block. */
export function blocksFromHtml(html: string): EmailBlock[] {
  const block = createBlock("html");
  block.html = html;
  return [block];
}

export function defaultBlocksFor(kind: "blank" | "circular" | "informe" = "blank"): EmailBlock[] {
  if (kind === "blank") return [createBlock("text")];
  const heading = createBlock("heading");
  heading.html = kind === "circular" ? "Comunicado oficial" : "Informe da semana";
  const intro = createBlock("text");
  intro.html = "Prezado {{name}}, saudações:\n\n" + (kind === "circular"
    ? "Segue a atualização abaixo."
    : "Aqui vão os destaques desta edição.");
  const cta = createBlock("button");
  cta.label = "Saiba mais";
  return [heading, intro, createBlock("divider"), cta];
}
