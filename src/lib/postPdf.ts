import type { SocialPost } from "@/types/marketing";

const MARGIN = 40;
const PAGE_WIDTH = 595.28; // A4 pt
const PAGE_HEIGHT = 841.89; // A4 pt
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

async function loadImageAsDataUrl(url: string): Promise<{ dataUrl: string; width: number; height: number } | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Falha ao ler a imagem"));
      reader.readAsDataURL(blob);
    });

    const { width, height } = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => reject(new Error("Falha ao carregar a imagem"));
      img.src = dataUrl;
    });

    return { dataUrl, width, height };
  } catch {
    return null;
  }
}

function pickMainImage(post: SocialPost): string | null {
  return post.thumbnail_url || post.rendered_media_urls?.[0] || post.image_urls?.[0] || post.media_urls?.[0] || null;
}

const CHANNEL_LABELS: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  blog: "Blog",
  newsletter: "Newsletter",
};

/**
 * Gera e baixa um PDF de uma página com a imagem principal do post e seu
 * conteúdo/legenda — usado no botão "Baixar PDF" da Revisão de Post, para
 * quem precisa de uma cópia offline/impressa pra aprovar ou arquivar.
 */
export async function downloadPostPdf(post: SocialPost): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  let cursorY = MARGIN;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  const titleLines = doc.splitTextToSize(post.title || "Post sem título", CONTENT_WIDTH);
  doc.text(titleLines, MARGIN, cursorY);
  cursorY += titleLines.length * 22 + 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(110);
  const channelLabels = (post.channels || []).map((c) => CHANNEL_LABELS[c] || c).join(" · ");
  const metaParts = [
    channelLabels,
    post.published_at ? `Publicado em ${new Date(post.published_at).toLocaleDateString("pt-BR")}` : null,
    !post.published_at && post.scheduled_at ? `Agendado para ${new Date(post.scheduled_at).toLocaleDateString("pt-BR")}` : null,
  ].filter(Boolean);
  if (metaParts.length > 0) {
    doc.text(metaParts.join("  •  "), MARGIN, cursorY);
    cursorY += 18;
  }
  doc.setTextColor(0);

  const mainImageUrl = pickMainImage(post);
  if (mainImageUrl) {
    const image = await loadImageAsDataUrl(mainImageUrl);
    if (image) {
      const maxImageHeight = 320;
      const ratio = image.width / image.height || 1;
      let drawWidth = CONTENT_WIDTH;
      let drawHeight = drawWidth / ratio;
      if (drawHeight > maxImageHeight) {
        drawHeight = maxImageHeight;
        drawWidth = drawHeight * ratio;
      }
      const imageX = MARGIN + (CONTENT_WIDTH - drawWidth) / 2;
      const format = image.dataUrl.startsWith("data:image/png") ? "PNG" : "JPEG";
      doc.addImage(image.dataUrl, format, imageX, cursorY, drawWidth, drawHeight);
      cursorY += drawHeight + 20;
    }
  }

  const bodyText = post.content?.trim() || post.excerpt?.trim() || "";
  if (bodyText) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    const bodyLines = doc.splitTextToSize(bodyText, CONTENT_WIDTH);
    for (const line of bodyLines) {
      if (cursorY > PAGE_HEIGHT - MARGIN) {
        doc.addPage();
        cursorY = MARGIN;
      }
      doc.text(line, MARGIN, cursorY);
      cursorY += 15;
    }
  }

  if (post.tags && post.tags.length > 0) {
    cursorY += 10;
    if (cursorY > PAGE_HEIGHT - MARGIN) {
      doc.addPage();
      cursorY = MARGIN;
    }
    doc.setFontSize(9);
    doc.setTextColor(110);
    doc.text(post.tags.map((t) => `#${t}`).join("  "), MARGIN, cursorY, { maxWidth: CONTENT_WIDTH });
  }

  const fileSlug = (post.title || "post")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "post";

  doc.save(`${fileSlug}.pdf`);
}
