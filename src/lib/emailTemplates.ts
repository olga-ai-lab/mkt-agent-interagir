// ============================================================
// EMAIL TEMPLATES — Livonius/Livo
// Parâmetros dinâmicos: titulo, subtitulo, corpo, nomeAssinante, cargoAssinante
// {{name}} no corpo é preservado para substituição em runtime pelo n8n
// ============================================================
// ─── ASSET DEFAULTS ─────────────────────────────────────────
const DEFAULT_ASSETS = {
  logoLivonius:  "https://uvwqhpesqbufjpytveti.supabase.co/storage/v1/object/public/assets-email/Livonius_logo_white.png",
  logoLivo:      "https://uvwqhpesqbufjpytveti.supabase.co/storage/v1/object/public/assets-email/livo_logo_white.png",
  headerPhoto:   "https://uvwqhpesqbufjpytveti.supabase.co/storage/v1/object/public/assets-email/realistic_office_background.png",
  iconInstagram: "https://uvwqhpesqbufjpytveti.supabase.co/storage/v1/object/public/assets-email/instagram.png",
  iconFacebook:  "https://uvwqhpesqbufjpytveti.supabase.co/storage/v1/object/public/assets-email/facebook.png",
  iconLinkedIn:  "https://uvwqhpesqbufjpytveti.supabase.co/storage/v1/object/public/assets-email/linkedin.png",
};
const DEFAULT_INFO = {
  primaryColor:  "#1a6b5a",
  companyName:   "Livonius MGA",
  address:       "Av. Loureiro da Silva, 1940 - 12º andar - 90050-240 - Porto Alegre, RS, Brasil",
  addressShort:  "Av. Loureiro da Silva, 1940 - 12º andar",
  cep:           "CEP 90050-240 - Porto Alegre/RS",
  phone:         "(51) 3224.8555",
  siteUrl:       "livomga.com.br",
  instagramUrl:  "https://www.instagram.com/livoniusmga",
  facebookUrl:   "https://www.facebook.com/livoniusmga",
  linkedinUrl:   "https://www.linkedin.com/in/livonius-mga-2a1938173/",
};

// ─── WORKSPACE EMAIL SETTINGS ────────────────────────────────
// Optional settings passed from the workspace configuration.
// When provided they override the defaults above.
export interface EmailGenerationSettings {
  logo_livonius_url?: string;
  logo_livo_url?: string;
  header_photo_url?: string;
  primary_color?: string;
  company_name?: string;
  address?: string;
  phone?: string;
  site_url?: string;
  instagram_url?: string;
  facebook_url?: string;
  linkedin_url?: string;
  // ─── Custom template fields ──────────────────────
  header_title?: string;       // e.g. "CIRCULARES", "INFORME", "AVISOS"
  header_title_color?: string; // font color for the header title text (hex)
  body_text_color?: string;    // default font color for body text/heading blocks (hex)
  footer_text_color?: string;  // font color for the small legal text at the bottom of the footer (hex)
  show_livo?: boolean;         // show secondary logo alongside primary
  gradient_color?: string;     // base color for header/footer gradient (hex)
  show_site?: boolean;         // show site URL in footer
  sender_name?: string;        // e.g. "Livo MGA", "Livonius MGA"
  greeting?: string;           // e.g. "Prezado Parceiro, saudações:"
  closing?: string;            // e.g. "Atenciosamente,"
  hide_header?: boolean;       // omit the branded header band entirely
  hide_footer?: boolean;       // omit the branded footer band entirely
}

// Merge workspace settings into the resolved asset/info objects.
interface ResolvedAssets {
  logoLivonius: string;
  logoLivo: string;
  headerPhoto: string;
  iconInstagram: string;
  iconFacebook: string;
  iconLinkedIn: string;
}
interface ResolvedInfo {
  primaryColor: string;
  companyName: string;
  address: string;
  phone: string;
  siteUrl: string;
  instagramUrl: string;
  facebookUrl: string;
  linkedinUrl: string;
}

function resolveAssets(s?: EmailGenerationSettings): ResolvedAssets {
  return {
    logoLivonius: s?.logo_livonius_url || DEFAULT_ASSETS.logoLivonius,
    logoLivo:     s?.logo_livo_url     || DEFAULT_ASSETS.logoLivo,
    headerPhoto:  s?.header_photo_url  || DEFAULT_ASSETS.headerPhoto,
    iconInstagram: DEFAULT_ASSETS.iconInstagram,
    iconFacebook:  DEFAULT_ASSETS.iconFacebook,
    iconLinkedIn:  DEFAULT_ASSETS.iconLinkedIn,
  };
}
function resolveInfo(s?: EmailGenerationSettings): ResolvedInfo {
  return {
    primaryColor: s?.primary_color  || DEFAULT_INFO.primaryColor,
    companyName:  s?.company_name   || DEFAULT_INFO.companyName,
    address:      s?.address        || DEFAULT_INFO.address,
    phone:        s?.phone          || DEFAULT_INFO.phone,
    siteUrl:      s?.site_url       || DEFAULT_INFO.siteUrl,
    instagramUrl: s?.instagram_url  || DEFAULT_INFO.instagramUrl,
    facebookUrl:  s?.facebook_url   || DEFAULT_INFO.facebookUrl,
    linkedinUrl:  s?.linkedin_url   || DEFAULT_INFO.linkedinUrl,
  };
}

export interface TemplateFields {
  titulo: string;
  subtitulo: string;
  corpo: string;
  nomeAssinante: string;
  cargoAssinante: string;
}
// ─── COLOR HELPERS ──────────────────────────────────────────
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}
function darkenHex(hex: string, factor: number): string {
  const [r, g, b] = hexToRgb(hex);
  const d = (v: number) => Math.round(v * (1 - factor)).toString(16).padStart(2, "0");
  return `#${d(r)}${d(g)}${d(b)}`;
}
function lightenHex(hex: string, factor: number): string {
  const [r, g, b] = hexToRgb(hex);
  const l = (v: number) => Math.round(v + (255 - v) * factor).toString(16).padStart(2, "0");
  return `#${l(r)}${l(g)}${l(b)}`;
}
function gradientCss(base: string): string {
  const [r, g, b] = hexToRgb(base);
  const dark = hexToRgb(darkenHex(base, 0.25));
  const light = hexToRgb(lightenHex(base, 0.20));
  return `linear-gradient(160deg,rgba(${dark[0]},${dark[1]},${dark[2]},0.94) 0%,rgba(${r},${g},${b},0.90) 50%,rgba(${light[0]},${light[1]},${light[2]},0.78) 100%)`;
}
function gradientSolidCss(base: string): string {
  return `linear-gradient(160deg,${darkenHex(base, 0.25)} 0%,${base} 50%,${lightenHex(base, 0.20)} 100%)`;
}
const DEFAULT_GRADIENT = "#1a8c6a";
// ─── SHARED HELPERS ─────────────────────────────────────────
const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
// If the content contains HTML tags (inserted via block editor) pass it through directly.
// Otherwise escape plain text and convert newlines to <br>.
const bodyToHtml = (texto: string) => {
  const hasHtmlTags = /<[a-zA-Z][^>]*>/.test(texto);
  if (hasHtmlTags) {
    return texto.replace(/\{\{name\}\}/g, "{{name}}");
  }
  const escaped = escapeHtml(texto);
  const restored = escaped.replace(/\{\{name\}\}/g, "{{name}}");
  return restored.replace(/\n/g, "<br>");
};
const ph = (val: string, placeholder: string) =>
  val.trim() ? escapeHtml(val) : `<span style="color:#aaaaaa">${placeholder}</span>`;
const bodyPh = (val: string, placeholder: string) =>
  val.trim() ? bodyToHtml(val) : `<span style="color:#aaaaaa">${placeholder}</span>`;
// ─── SHARED SECTIONS ────────────────────────────────────────
const buildSocialIcons = (a: ResolvedAssets, info: ResolvedInfo) => `
<table width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td align="center" style="padding:16px 0 8px;">
      <a href="${info.instagramUrl}" style="text-decoration:none;display:inline-block;margin:0 4px;">
        <img src="${a.iconInstagram}" alt="Instagram" width="36" height="36"
             style="border:0;border-radius:50%;display:block;" border="0">
      </a>
      <a href="${info.facebookUrl}" style="text-decoration:none;display:inline-block;margin:0 4px;">
        <img src="${a.iconFacebook}" alt="Facebook" width="36" height="36"
             style="border:0;border-radius:50%;display:block;" border="0">
      </a>
      <a href="${info.linkedinUrl}" style="text-decoration:none;display:inline-block;margin:0 4px;">
        <img src="${a.iconLinkedIn}" alt="LinkedIn" width="36" height="36"
             style="border:0;border-radius:50%;display:block;" border="0">
      </a>
    </td>
  </tr>
</table>`;
const buildRodapeTexto = (remetente: string, info: ResolvedInfo, textColor?: string) => `
<table width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td align="center" style="padding:12px 24px 20px;font-family:Arial,sans-serif;font-size:10px;color:${textColor || "#666666"};line-height:1.6;">
      Visualizar este e-mail como <a href="#" style="color:${info.primaryColor};">página web</a><br>
      Enviado por ${remetente}<br>
      ${info.address}<br>
      Caso não queira mais receber estes e-mails, <a href="#" style="color:${info.primaryColor};">cancele sua inscrição</a>.
    </td>
  </tr>
</table>`;
const buildFooterLogos = (showSite: boolean, a: ResolvedAssets, info: ResolvedInfo, gradientBase?: string, showSecondaryLogo?: boolean) => {
  const base = gradientBase || DEFAULT_GRADIENT;
  const solidGrad = gradientSolidCss(base);
  const secondaryLogoHtml = (showSecondaryLogo !== false && a.logoLivo)
    ? `<img src="${a.logoLivo}" alt="Logo Secundária" width="75" style="display:block;border:0;margin-top:8px;" border="0">`
    : "";
  return `
<table width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td style="padding:0 16px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td bgcolor="${base}" style="background:${solidGrad};padding:28px 32px;border-radius:4px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td width="45%" valign="middle" style="padding-right:16px;">
                  <img src="${a.logoLivonius}" alt="Logo Primária" width="170"
                       style="display:block;border:0;" border="0">
                  ${secondaryLogoHtml}
                </td>
                <td width="55%" valign="middle" style="padding-left:16px;">
                  <div style="font-family:Arial,sans-serif;font-size:12px;font-weight:700;color:#ffffff;margin-bottom:8px;">
                    ${escapeHtml(info.companyName).toUpperCase()}
                  </div>
                  <table cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td valign="top" style="padding-right:6px;font-size:13px;color:#ffffff;">&#127963;</td>
                      <td valign="top">
                        <div style="font-family:Arial,sans-serif;font-size:11px;color:#ffffff;line-height:1.6;">
                          ${escapeHtml(info.address)}<br>
                          Fone: ${escapeHtml(info.phone)}
                        </div>
                      </td>
                    </tr>
                    ${showSite ? `<tr>
                      <td valign="middle" style="padding-right:6px;padding-top:6px;font-size:12px;color:#ffffff;">&#127760;</td>
                      <td valign="middle" style="padding-top:6px;">
                        <div style="font-family:Arial,sans-serif;font-size:11px;color:#ffffff;font-weight:700;">
                          ${escapeHtml(info.siteUrl)}
                        </div>
                      </td>
                    </tr>` : ""}
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
};
const corpoEmail = (f: TemplateFields, saudacao: string, encerramento?: string) => `
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;">
  <tr>
    <td style="padding:32px 24px 0;">
      <p style="margin:0 0 8px;font-family:Arial,sans-serif;font-size:14px;font-weight:700;color:#1a1a1a;">
        ${ph(f.titulo, "CIRCULAR LIVONIUS XXXX/XX")}
      </p>
      <p style="margin:0 0 48px;font-family:Arial,sans-serif;font-size:14px;font-weight:700;color:#1a1a1a;">
        ${ph(f.subtitulo, "LIVONIUS &amp; XXX: XXX")}
      </p>
      <p style="margin:0 0 24px;font-family:Arial,sans-serif;font-size:14px;color:#1a1a1a;">
        ${saudacao}
      </p>
      <p style="margin:0 0 32px;font-family:Arial,sans-serif;font-size:14px;color:#1a1a1a;line-height:1.6;white-space:pre-wrap;">
        ${bodyPh(f.corpo, "Escreva o conteúdo da mensagem aqui...")}
      </p>
      <p style="margin:0 0 24px;font-family:Arial,sans-serif;font-size:14px;color:#1a1a1a;">
        ${escapeHtml(encerramento || "Atenciosamente,")}
      </p>
      <p style="margin:0 0 4px;font-family:Arial,sans-serif;font-size:14px;font-weight:700;color:#1a1a1a;">
        ${ph(f.nomeAssinante, "Nome do Assinante")}
      </p>
      <p style="margin:0 0 32px;font-family:Arial,sans-serif;font-size:14px;color:#1a1a1a;">
        ${ph(f.cargoAssinante, "Cargo | Título")}
      </p>
    </td>
  </tr>
</table>`;
// ─── HEADER BUILDERS ────────────────────────────────────────
// Bulletproof background-image technique: <td background="..."> for webmail,
// VML v:rect for Outlook.  Green panel uses bgcolor fallback + CSS gradient.
// NO position:absolute, NO transform — 100 % table-based layout.
const buildHeader = (tituloHeader: string, showLivo: boolean, a: ResolvedAssets, info: ResolvedInfo, gradientBase?: string, titleColor?: string) => {
  const base = gradientBase || DEFAULT_GRADIENT;
  const solidGrad = gradientSolidCss(base);
  const solidColor = darkenHex(base, 0.15);
  return `
<table width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td style="padding:0 16px 16px 16px;">
      <!--[if gte mso 9]>
      <v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:568px;height:240px;">
        <v:fill type="frame" src="${a.headerPhoto}" color="#c8c8c8" />
        <v:textbox style="mso-fit-shape-to-text:false" inset="0,0,0,0">
      <![endif]-->
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td background="${a.headerPhoto}" bgcolor="#c8c8c8" width="568" height="240" style="background-image:url('${a.headerPhoto}');background-size:cover;background-position:center top;height:240px;" valign="top">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td width="40%" bgcolor="${solidColor}" style="background:${solidGrad};padding:22px 16px 18px 24px;width:40%;" valign="top" height="240">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td valign="top">
                        <table cellpadding="0" cellspacing="0" border="0">
                          <tr>
                            <td valign="middle">
                              <img src="${a.logoLivonius}" alt="LIVONIUS." width="140"
                                   style="display:block;border:0;color:#ffffff;font-family:Arial,sans-serif;font-weight:900;font-size:15px;" border="0">
                            </td>
                            ${showLivo ? `<td width="10" valign="middle"></td>
                            <td valign="middle">
                              <img src="${a.logoLivo}" alt="livo" width="48"
                                   style="display:block;border:0;color:#ffffff;font-family:Georgia,serif;font-style:italic;font-size:13px;" border="0">
                            </td>` : ""}
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td valign="middle" align="center" height="150" style="padding-top:10px;">
                        <span style="font-family:'Montserrat','Arial Black',Impact,'Helvetica Neue',sans-serif;font-size:32px;font-weight:900;color:${titleColor || "#ffffff"};letter-spacing:1.5px;text-transform:uppercase;line-height:1.1;">${tituloHeader}</span>
                      </td>
                    </tr>
                  </table>
                </td>
                <td style="font-size:0;line-height:0;" height="240">&#160;</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
      <!--[if gte mso 9]>
        </v:textbox>
      </v:rect>
      <![endif]-->
    </td>
  </tr>
</table>`;
};
// ─── TEMPLATE WRAPPERS ──────────────────────────────────────
const wrapEmail = (innerHtml: string) => `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Email Livonius</title>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@800;900&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f5f5;padding:20px 0;">
  <tr>
    <td align="center">
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:4px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr><td>${innerHtml}</td></tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
// ─── PUBLIC GENERATORS ──────────────────────────────────────
export function generateCircularLivonius(f: TemplateFields, settings?: EmailGenerationSettings): string {
  const a = resolveAssets(settings);
  const info = resolveInfo(settings);
  const gc = settings?.gradient_color || settings?.primary_color;
  const greeting = settings?.greeting || "Prezado Parceiro, saudações:";
  const closing = settings?.closing || "Atenciosamente,";
  const inner =
    buildHeader("CIRCULARES", false, a, info, gc, settings?.header_title_color) +
    corpoEmail(f, greeting, closing) +
    buildFooterLogos(false, a, info, gc, false) +
    buildSocialIcons(a, info) +
    buildRodapeTexto(settings?.sender_name || "Livonius MGA", info, settings?.footer_text_color);
  return wrapEmail(inner);
}
export function generateCircularGrupo(f: TemplateFields, settings?: EmailGenerationSettings): string {
  const a = resolveAssets(settings);
  const info = resolveInfo(settings);
  const gc = settings?.gradient_color || settings?.primary_color;
  const greeting = settings?.greeting || "Prezado Parceiro, saudações:";
  const closing = settings?.closing || "Atenciosamente,";
  const inner =
    buildHeader("CIRCULARES", true, a, info, gc, settings?.header_title_color) +
    corpoEmail(f, greeting, closing) +
    buildFooterLogos(true, a, info, gc, true) +
    buildSocialIcons(a, info) +
    buildRodapeTexto(settings?.sender_name || "Livo MGA", info, settings?.footer_text_color);
  return wrapEmail(inner);
}
export function generateInforme(f: TemplateFields, settings?: EmailGenerationSettings): string {
  const a = resolveAssets(settings);
  const info = resolveInfo(settings);
  const gc = settings?.gradient_color || settings?.primary_color;
  const greeting = settings?.greeting || "Prezado parceiro, saudações:";
  const closing = settings?.closing || "Atenciosamente,";
  const inner =
    buildHeader("INFORME", true, a, info, gc, settings?.header_title_color) +
    corpoEmail(f, greeting, closing) +
    buildFooterLogos(false, a, info, gc, false) +
    buildSocialIcons(a, info) +
    buildRodapeTexto(settings?.sender_name || "Livonius MGA", info, settings?.footer_text_color);
  return wrapEmail(inner);
}
export function generateCustomTemplate(f: TemplateFields, settings?: EmailGenerationSettings): string {
  const a = resolveAssets(settings);
  const info = resolveInfo(settings);
  const headerTitle = settings?.header_title || "CIRCULARES";
  const showLivo = settings?.show_livo ?? true;
  const gc = settings?.gradient_color || settings?.primary_color;
  const showSite = settings?.show_site ?? true;
  const senderName = settings?.sender_name || info.companyName || "Livonius MGA";
  const greeting = settings?.greeting || "Prezado Parceiro, saudações:";
  const closing = settings?.closing || "Atenciosamente,";
  const inner =
    buildHeader(headerTitle, showLivo, a, info, gc, settings?.header_title_color) +
    corpoEmail(f, greeting, closing) +
    buildFooterLogos(showSite, a, info, gc, showLivo) +
    buildSocialIcons(a, info) +
    buildRodapeTexto(senderName, info, settings?.footer_text_color);
  return wrapEmail(inner);
}
// ─── BLOCK EDITOR SHELL ─────────────────────────────────────
/** Returns the header and footer HTML strings for use by the block email editor. */
export function buildBlockEmailShell(
  headerTitle: string,
  settings?: EmailGenerationSettings,
): { header: string; footer: string } {
  const a = resolveAssets(settings);
  const info = resolveInfo(settings);
  const gc = settings?.gradient_color || settings?.primary_color;
  const showLivo = settings?.show_livo ?? false;
  const showSite = settings?.show_site ?? true;
  const senderName = settings?.sender_name || info.companyName || "Livonius MGA";
  return {
    header: settings?.hide_header ? "" : buildHeader(headerTitle, showLivo, a, info, gc, settings?.header_title_color),
    footer: settings?.hide_footer ? "" :
      buildFooterLogos(showSite, a, info, gc, showLivo) +
      buildSocialIcons(a, info) +
      buildRodapeTexto(senderName, info, settings?.footer_text_color),
  };
}
export { wrapEmail };

export const EMAIL_TEMPLATES = {
  "circular-livonius": {
    id: "circular-livonius",
    label: "Circular Livonius",
    marca: "LIVONIUS",
    tituloPlaceholder: "CIRCULAR LIVONIUS XXXX/XX",
    subtituloPlaceholder: "LIVONIUS & XXX: XXX",
    generate: generateCircularLivonius,
  },
  "circular-grupo": {
    id: "circular-grupo",
    label: "Circular Grupo",
    marca: "LIVO + LIVONIUS",
    tituloPlaceholder: "CIRCULAR GRUPO LIVONIUS XXXX/XX",
    subtituloPlaceholder: "LIVO & XXX: XXX",
    generate: generateCircularGrupo,
  },
  informe: {
    id: "informe",
    label: "Informe",
    marca: "LIVO + LIVONIUS",
    tituloPlaceholder: "INFORME | LIVONIUS E LIVO XXXX/XX: XXX",
    subtituloPlaceholder: "",
    generate: generateInforme,
  },
} as const;
export type TemplateKey = keyof typeof EMAIL_TEMPLATES;
