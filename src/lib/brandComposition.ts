import { supabase } from "@/integrations/supabase/client";
import livoniusColorLogo from "@/assets/logo-livonius-color.svg";
import livoniusWhiteLogo from "@/assets/logo-livonius.svg";
import type {
  BrandAsset,
  MediaComposition,
  MediaCompositionSlide,
  OverlayAnchor,
  OverlayItem,
  PostCompany,
  RegulatoryBlock,
} from "@/types/marketing";

const MEDIA_BUCKET = "mkt-post-media";

export const SAFE_AREA_BOTTOM = 0.16;
export const DEFAULT_MAIN_LOGO_ID = "brand:primary";
const MIN_OVERLAY_SIZE = 0.06;
const MAX_OVERLAY_SIZE = 0.55;
const SNAP_THRESHOLD = 0.02;
const LIVO_COLOR_LOGO_URL =
  "https://vywalfkdlbmuoyxfgjhc.supabase.co/storage/v1/object/public/logos-marcas/LIVO_marca_color-2.png";
const LIVO_WHITE_LOGO_URL =
  "https://uvwqhpesqbufjpytveti.supabase.co/storage/v1/object/public/assets-email/livo_logo_white.png";

export function isVideoUrl(url: string) {
  return /\.(mp4|webm|mov)$/i.test(url);
}

export const POSITION_PRESETS: Array<{ id: OverlayAnchor; label: string; x: number; y: number }> = [
  { id: "top-left", label: "Sup. esquerdo", x: 0.06, y: 0.06 },
  { id: "top-right", label: "Sup. direito", x: 0.72, y: 0.06 },
  { id: "bottom-left", label: "Inf. esquerdo", x: 0.06, y: 0.72 },
  { id: "bottom-right", label: "Inf. direito", x: 0.72, y: 0.72 },
  { id: "center", label: "Centro", x: 0.36, y: 0.36 },
  { id: "footer-center", label: "Rodapé", x: 0.33, y: 0.78 },
];

// O bloco regulatório (SUSEP/ANS) pode ser posicionado livremente em qualquer
// lugar da arte. Estes presets são apenas atalhos de posicionamento rápido,
// calculados a partir da largura/altura reais do bloco para não estourar as
// bordas ao usar cada âncora.
export const REGULATORY_POSITION_PRESETS: Array<{ id: OverlayAnchor; label: string }> = [
  { id: "top", label: "Topo" },
  { id: "bottom", label: "Base" },
  { id: "left", label: "Esquerda" },
  { id: "right", label: "Direita" },
  { id: "top-left", label: "Sup. esquerdo" },
  { id: "top-right", label: "Sup. direito" },
  { id: "bottom-left", label: "Inf. esquerdo" },
  { id: "bottom-right", label: "Inf. direito" },
  { id: "center", label: "Centro" },
  { id: "footer-center", label: "Rodapé" },
];

export function getRegulatoryPresetPosition(
  id: OverlayAnchor,
  width: number,
  height: number,
): { x: number; y: number } {
  const w = clamp(width, 0.08, 1);
  const h = clamp(height, 0.03, 1);
  const leftX = 0.04;
  const centerX = clamp((1 - w) / 2, 0, 1 - w);
  const rightX = clamp(1 - w - 0.04, 0, 1 - w);
  const topY = 0.06;
  const bottomY = clamp(1 - h - 0.04, 0, 1 - h);

  const middleY = clamp((1 - h) / 2, 0, 1 - h);

  switch (id) {
    case "top-left":
      return { x: leftX, y: topY };
    case "top-right":
      return { x: rightX, y: topY };
    case "bottom-left":
      return { x: leftX, y: bottomY };
    case "bottom-right":
      return { x: rightX, y: bottomY };
    // Bordas centralizadas — como as opções de alinhamento do PowerPoint,
    // além dos cantos e do centro que já existiam.
    case "top":
      return { x: centerX, y: topY };
    case "bottom":
      return { x: centerX, y: bottomY };
    case "left":
      return { x: leftX, y: middleY };
    case "right":
      return { x: rightX, y: middleY };
    case "center":
      return { x: centerX, y: middleY };
    case "footer-center":
    default:
      return { x: centerX, y: bottomY };
  }
}

export function getBrandLogoUrl(company: PostCompany, variant: "default" | "white" = "default") {
  if (company === "livonius") {
    return variant === "white" ? livoniusWhiteLogo : livoniusColorLogo;
  }
  return variant === "white" ? LIVO_WHITE_LOGO_URL : LIVO_COLOR_LOGO_URL;
}

export function createDefaultBrandOverlay(company: PostCompany): OverlayItem {
  return {
    id: crypto.randomUUID(),
    assetId: DEFAULT_MAIN_LOGO_ID,
    type: "brand_logo",
    x: 0.68,
    y: 0.06,
    width: company === "livonius" ? 0.2 : 0.14,
    height: company === "livonius" ? 0.065 : 0.08,
    rotation: 0,
    opacity: 1,
    variant: "default",
    locked: false,
    anchor: "top-right",
    zIndex: 10,
    visible: true,
    label: company === "livonius" ? "Livonius" : "Livo",
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function snap(value: number, candidates: number[]) {
  for (const candidate of candidates) {
    if (Math.abs(value - candidate) <= SNAP_THRESHOLD) {
      return candidate;
    }
  }
  return value;
}

export function clampOverlay(overlay: OverlayItem): OverlayItem {
  const width = clamp(overlay.width, MIN_OVERLAY_SIZE, MAX_OVERLAY_SIZE);
  const height = clamp(overlay.height, MIN_OVERLAY_SIZE, 0.35);
  const x = clamp(snap(overlay.x, [0, 0.06, 0.5 - width / 2, 1 - width, 0.94 - width]), 0, 1 - width);
  const yMax = Math.max(0, 1 - SAFE_AREA_BOTTOM - height);
  const y = clamp(snap(overlay.y, [0, 0.06, 0.5 - height / 2, yMax]), 0, yMax);

  return {
    ...overlay,
    x,
    y,
    width,
    height,
  };
}

export function clampRegulatory(regulatory: RegulatoryBlock | null | undefined): RegulatoryBlock | null {
  if (!regulatory) return null;
  // O bloco regulatório pode ser posicionado livremente em qualquer lugar da
  // arte (inclusive ultrapassando a safe area), assim como as logos. Mantemos
  // apenas um limite mínimo on-canvas para o bloco não sumir por completo.
  const width = clamp(regulatory.width, 0.08, 1);
  const height = clamp(regulatory.height, 0.03, 1);
  // x/y devem ser limitados pela largura/altura REAIS do bloco (não por uma
  // constante fixa) — só assim a margem até a borda fica igual em toda a
  // imagem e o bloco consegue encostar exatamente em qualquer borda (direita
  // ou inferior) em vez de parar antes dela ou ultrapassá-la dependendo do
  // tamanho do bloco.
  return {
    ...regulatory,
    x: clamp(regulatory.x, 0, Math.max(0, 1 - width)),
    y: clamp(regulatory.y, 0, Math.max(0, 1 - height)),
    width,
    height,
    color: regulatory.color ?? "white",
    orientation: regulatory.orientation ?? "horizontal",
    visible: regulatory.visible ?? true,
  };
}

export function cloneSlideForSource(slide: MediaCompositionSlide, sourceUrl: string): MediaCompositionSlide {
  return {
    sourceUrl,
    outputUrl: slide.outputUrl || null,
    overlays: slide.overlays.map((overlay) => ({ ...overlay })),
    regulatory: slide.regulatory ? { ...slide.regulatory } : null,
  };
}

export function normalizeComposition(
  baseMediaUrls: string[],
  composition: MediaComposition | null | undefined,
  company: PostCompany,
): MediaComposition {
  const slides = baseMediaUrls.map((sourceUrl, index) => {
    const existing = composition?.slides?.[index];
    const baseSlide = existing ? cloneSlideForSource(existing, sourceUrl) : {
      sourceUrl,
      outputUrl: null,
      overlays: [],
      regulatory: null,
    };

    const rawOverlays = (baseSlide.overlays || []).map(clampOverlay);
    const firstPrimary = rawOverlays.find((overlay) => isMainBrandOverlay(overlay));

    let overlays: OverlayItem[];
    if (!firstPrimary) {
      overlays = [...rawOverlays, createDefaultBrandOverlay(company)];
    } else {
      // Overlays legados podiam ter `type: "brand_logo"` sem `assetId` ==
      // DEFAULT_MAIN_LOGO_ID (ver isMainBrandOverlay acima) — se mais de um
      // overlay bater no critério, mantém só o primeiro (id de `firstPrimary`)
      // e descarta os demais, pra não desenhar a logo principal duas vezes
      // na arte final.
      const updatedPrimary = clampOverlay({
        ...firstPrimary,
        assetId: DEFAULT_MAIN_LOGO_ID,
        type: "brand_logo",
        width: company === "livonius" ? Math.max(firstPrimary.width, 0.18) : Math.min(firstPrimary.width, 0.16),
        label: company === "livonius" ? "Livonius" : "Livo",
      });
      overlays = rawOverlays
        .filter((overlay) => overlay.id === firstPrimary.id || !isMainBrandOverlay(overlay))
        .map((overlay) => (overlay.id === firstPrimary.id ? updatedPrimary : overlay));
    }

    return {
      ...baseSlide,
      sourceUrl,
      overlays,
      regulatory: clampRegulatory(baseSlide.regulatory),
    };
  });

  return { slides };
}

export function countPartnerLogos(composition?: MediaComposition | null) {
  return (
    composition?.slides?.reduce((total, slide) => {
      return total + slide.overlays.filter((overlay) => overlay.type === "partner_logo" && overlay.visible !== false).length;
    }, 0) || 0
  );
}

export function hasRegulatoryNotes(composition?: MediaComposition | null, notes?: string | null) {
  return Boolean(
    notes?.trim() ||
      composition?.slides?.some((slide) => slide.regulatory?.visible !== false && slide.regulatory?.text?.trim())
  );
}

async function blobFromUrl(url: string): Promise<Blob> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Falha ao carregar mídia: ${response.status}`);
  }
  return response.blob();
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  const blob = await blobFromUrl(url);
  const objectUrl = URL.createObjectURL(blob);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Não foi possível abrir a imagem ${url}`));
      img.src = objectUrl;
    });
    return image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const trial = current ? `${current} ${word}` : word;
    if (ctx.measureText(trial).width <= maxWidth || !current) {
      current = trial;
    } else {
      lines.push(current);
      current = word;
    }
  }

  if (current) lines.push(current);
  return lines;
}

// Mesmo critério usado em normalizeComposition() pra achar/deduplicar a logo
// principal — precisa ser o MESMO em ambos os lugares. Overlays antigos podem
// ter `type: "brand_logo"` sem `assetId` == DEFAULT_MAIN_LOGO_ID (o campo
// assetId foi adicionado depois); se os dois critérios divergirem,
// normalizeComposition não reconhece esse overlay legado como "já tem logo
// principal" e injeta um segundo, que o renderer abaixo também desenha por
// bater em `type === "brand_logo"` — resultado: logo duplicada na arte final.
export function isMainBrandOverlay(overlay: OverlayItem) {
  return overlay.assetId === DEFAULT_MAIN_LOGO_ID || overlay.type === "brand_logo";
}

async function resolveOverlayUrl(overlay: OverlayItem, company: PostCompany) {
  if (isMainBrandOverlay(overlay)) {
    return getBrandLogoUrl(company, overlay.variant || "default");
  }
  if (overlay.uploadedUrl) {
    return overlay.uploadedUrl;
  }
  return null;
}

export async function renderSlideToBlob(
  slide: MediaCompositionSlide,
  company: PostCompany,
): Promise<Blob> {
  const baseImage = await loadImage(slide.sourceUrl);
  const canvas = document.createElement("canvas");
  canvas.width = baseImage.naturalWidth || baseImage.width;
  canvas.height = baseImage.naturalHeight || baseImage.height;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Canvas indisponível para compor a arte");
  }

  ctx.drawImage(baseImage, 0, 0, canvas.width, canvas.height);

  const overlays = [...(slide.overlays || [])]
    .filter((overlay) => overlay.visible !== false)
    .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

  for (const overlay of overlays) {
    const overlayUrl = await resolveOverlayUrl(overlay, company);
    if (!overlayUrl) continue;

    const overlayImage = await loadImage(overlayUrl);
    const safeOverlay = clampOverlay(overlay);
    const x = safeOverlay.x * canvas.width;
    const y = safeOverlay.y * canvas.height;
    const drawWidth = safeOverlay.width * canvas.width;
    // Preserve natural aspect ratio of the logo (matches CSS object-contain in the editor)
    const naturalRatio = overlayImage.naturalWidth / overlayImage.naturalHeight || 1;
    const drawHeight = drawWidth / naturalRatio;

    ctx.save();
    ctx.globalAlpha = clamp(safeOverlay.opacity, 0.1, 1);
    ctx.translate(x + drawWidth / 2, y + drawHeight / 2);
    ctx.rotate((safeOverlay.rotation * Math.PI) / 180);
    ctx.drawImage(overlayImage, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
    ctx.restore();
  }

  const regulatory = clampRegulatory(slide.regulatory);
  if (regulatory?.visible !== false && regulatory?.text?.trim()) {
    const x = regulatory.x * canvas.width;
    const y = regulatory.y * canvas.height;
    const width = regulatory.width * canvas.width;
    const height = regulatory.height * canvas.height;

    ctx.save();
    const fontSize = regulatory.fontSize
      ? Math.max(8, regulatory.fontSize * canvas.height)
      : Math.max(12, height * 0.28);
    ctx.fillStyle = regulatory.color === "black" ? "#000000" : "#FFFFFF";
    ctx.font = `600 ${fontSize}px Inter, Arial, sans-serif`;
    const lineHeight = fontSize * 1.35;
    const text = regulatory.text.trim();

    if (regulatory.orientation === "vertical") {
      // Texto na vertical: rotaciona o contexto 90° em torno do centro do bloco
      // e escreve as linhas ao longo da altura original do bloco.
      ctx.translate(x + width / 2, y + height / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";
      const lines = wrapText(ctx, text, height).slice(0, 6);
      const totalHeight = lines.length * lineHeight;
      lines.forEach((line, index) => {
        ctx.fillText(line, 0, -totalHeight / 2 + index * lineHeight + lineHeight / 2, height);
      });
    } else {
      ctx.textBaseline = "top";
      ctx.textAlign = "left";
      const lines = wrapText(ctx, text, width).slice(0, 6);
      lines.forEach((line, index) => {
        ctx.fillText(line, x, y + index * lineHeight, width);
      });
    }
    ctx.restore();
  }

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Não foi possível exportar a arte final"));
        return;
      }
      resolve(blob);
    }, "image/png");
  });
}

async function uploadRenderedBlob(postId: string, index: number, blob: Blob) {
  const path = `composed/${postId}/${Date.now()}-${index}-${crypto.randomUUID()}.png`;
  const { error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, blob, {
      cacheControl: "3600",
      contentType: "image/png",
      upsert: true,
    });

  if (error) {
    throw error;
  }

  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  return {
    path,
    publicUrl: data.publicUrl,
  };
}

export async function renderAndUploadComposition(params: {
  postId: string;
  company: PostCompany;
  composition: MediaComposition;
}) {
  const uploaded: Array<{ path: string; publicUrl: string }> = [];

  for (let index = 0; index < params.composition.slides.length; index += 1) {
    const slide = params.composition.slides[index];
    if (isVideoUrl(slide.sourceUrl)) {
      uploaded.push({
        path: slide.sourceUrl,
        publicUrl: slide.sourceUrl,
      });
      continue;
    }
    const blob = await renderSlideToBlob(slide, params.company);
    uploaded.push(await uploadRenderedBlob(params.postId, index, blob));
  }

  return uploaded;
}

export function buildPartnerOverlayFromAsset(asset: BrandAsset): OverlayItem {
  return clampOverlay({
    id: crypto.randomUUID(),
    assetId: asset.id,
    uploadedUrl: asset.file_url,
    type: "partner_logo",
    x: 0.06,
    y: 0.74,
    width: 0.18,
    height: 0.12,
    rotation: 0,
    opacity: 1,
    variant: "default",
    locked: false,
    anchor: "bottom-left",
    zIndex: 20,
    visible: true,
    label: asset.name,
  });
}
