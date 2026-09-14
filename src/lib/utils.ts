import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Converte texto puro em HTML estruturado.
 * Se o texto já contém tags HTML, retorna sem modificar.
 */
export function convertPlainTextToHtml(text: string): string {
  // Se já tem tags HTML, retorna sem modificar
  if (/<[a-z][\s\S]*>/i.test(text)) {
    return text;
  }

  // Divide por linhas vazias (parágrafos)
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim());

  return paragraphs.map(paragraph => {
    const trimmed = paragraph.trim();
    
    // Linhas curtas e sem pontuação final = provavelmente título
    const isHeading = trimmed.length < 100 && 
                      !trimmed.endsWith('.') && 
                      !trimmed.endsWith(',') &&
                      !trimmed.endsWith(':');
    
    if (isHeading) {
      return `<h2>${trimmed}</h2>`;
    }
    
    // Parágrafos normais - preserva quebras de linha internas como <br>
    return `<p>${trimmed.replace(/\n/g, ' ')}</p>`;
  }).join('\n\n');
}
