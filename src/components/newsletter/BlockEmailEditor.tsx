import { useCallback, useEffect, useRef, useState } from "react";
import {
  Type, Heading, MousePointerClick, Table as TableIcon, ImageIcon,
  Minus, MoveVertical, ArrowUp, ArrowDown, Copy, Trash2,
  Bold, Italic, List, Link2, Monitor, Smartphone, Upload, Loader2, Paperclip, Code2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  createBlock, newBlockId, LIVO_TEAL, sanitizeInlineHtml, isBlankSeed,
  type BlockAlign, type EmailBlock, type EmailBlockType,
} from "@/lib/emailBlocks";
import type { EmailGenerationSettings } from "@/lib/emailTemplates";
import { ImageUploadField } from "./ImageUploadField";

const COLOR_CATALOG = [
  "#1a6b5a", "#0f3d34", "#2e9e85", "#14505c",
  "#1e5f8f", "#1b2a4a", "#2b2f33", "#475569",
  "#7a2e3a", "#b5561f", "#b8863b", "#4b3b7a",
];

const DEFAULT_LOGO_LIVONIUS = "https://uvwqhpesqbufjpytveti.supabase.co/storage/v1/object/public/assets-email/Livonius_logo_white.png";
const DEFAULT_LOGO_LIVO     = "https://uvwqhpesqbufjpytveti.supabase.co/storage/v1/object/public/assets-email/livo_logo_white.png";
const DEFAULT_HEADER_PHOTO  = "https://uvwqhpesqbufjpytveti.supabase.co/storage/v1/object/public/assets-email/realistic_office_background.png";
const ICON_INSTAGRAM = "https://uvwqhpesqbufjpytveti.supabase.co/storage/v1/object/public/assets-email/instagram.png";
const ICON_FACEBOOK  = "https://uvwqhpesqbufjpytveti.supabase.co/storage/v1/object/public/assets-email/facebook.png";
const ICON_LINKEDIN  = "https://uvwqhpesqbufjpytveti.supabase.co/storage/v1/object/public/assets-email/linkedin.png";

interface BlockEmailEditorProps {
  blocks: EmailBlock[];
  onChange: (blocks: EmailBlock[]) => void;
  headerTitle?: string;
  disabled?: boolean;
  settings?: EmailGenerationSettings;
  onSettingsChange?: (s: EmailGenerationSettings) => void;
}

const LIBRARY: { type: EmailBlockType; label: string; icon: React.ElementType }[] = [
  { type: "heading", label: "Título", icon: Heading },
  { type: "text", label: "Texto", icon: Type },
  { type: "button", label: "Botão", icon: MousePointerClick },
  { type: "table", label: "Tabela", icon: TableIcon },
  { type: "image", label: "Imagem", icon: ImageIcon },
  { type: "file", label: "Arquivo", icon: Paperclip },
  { type: "html", label: "HTML", icon: Code2 },
  { type: "divider", label: "Divisor", icon: Minus },
  { type: "spacer", label: "Espaço", icon: MoveVertical },
];

const PALETTE = [LIVO_TEAL, "#1a7a5e", "#2e9e85", "#14505c", "#1e5f8f", "#2b2f33"];
const ALIGNS: { value: BlockAlign; label: string }[] = [
  { value: "left", label: "Esquerda" },
  { value: "center", label: "Centro" },
  { value: "right", label: "Direita" },
];

const MEDIA_BUCKET = "mkt-post-media";

export function BlockEmailEditor({ blocks, onChange, headerTitle = "NEWSLETTER", disabled = false, settings, onSettingsChange }: BlockEmailEditorProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [uploading, setUploading] = useState(false);
  const editableRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const primaryColor  = settings?.primary_color || LIVO_TEAL;
  const logoLivonius  = settings?.logo_livonius_url || DEFAULT_LOGO_LIVONIUS;
  const logoLivo      = settings?.logo_livo_url || DEFAULT_LOGO_LIVO;
  const headerPhoto   = settings?.header_photo_url || DEFAULT_HEADER_PHOTO;
  const showLivo      = settings?.show_livo !== false;
  const companyName   = settings?.company_name || "Livonius MGA";
  const address       = settings?.address || "Av. Loureiro da Silva, 1940 - 12º andar - Porto Alegre, RS";
  const phone         = settings?.phone || "(51) 3224.8555";
  const siteUrl       = settings?.site_url || "livomga.com.br";
  const showSite      = settings?.show_site !== false;
  const instagramUrl  = settings?.instagram_url || "https://www.instagram.com/livoniusmga";
  const facebookUrl   = settings?.facebook_url || "https://www.facebook.com/livoniusmga";
  const linkedinUrl   = settings?.linkedin_url || "https://www.linkedin.com/in/livonius-mga-2a1938173/";

  const selected = blocks.find((b) => b.id === selectedId) || null;

  const update = useCallback(
    (id: string, patch: Partial<EmailBlock>) => {
      onChange(blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)));
    },
    [blocks, onChange],
  );

  const addBlock = (type: EmailBlockType) => {
    if (disabled) return;
    const block = createBlock(type);
    // Ao colar HTML sobre a seed em branco não-editada, substitui em vez de
    // empilhar — senão o placeholder some enviado de verdade junto com o HTML.
    if (type === "html" && isBlankSeed(blocks)) {
      onChange([block]);
      setSelectedId(block.id);
      return;
    }
    const idx = selectedId ? blocks.findIndex((b) => b.id === selectedId) : blocks.length - 1;
    const next = [...blocks];
    next.splice(idx + 1, 0, block);
    onChange(next);
    setSelectedId(block.id);
  };

  const move = (id: string, dir: -1 | 1) => {
    const i = blocks.findIndex((b) => b.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  const duplicate = (id: string) => {
    const i = blocks.findIndex((b) => b.id === id);
    if (i < 0) return;
    const copy = { ...blocks[i], id: newBlockId() };
    const next = [...blocks];
    next.splice(i + 1, 0, copy);
    onChange(next);
    setSelectedId(copy.id);
  };

  const remove = (id: string) => {
    onChange(blocks.filter((b) => b.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const exec = (cmd: string) => {
    document.execCommand(cmd, false);
    if (selected && editableRefs.current[selected.id]) {
      update(selected.id, { html: editableRefs.current[selected.id]!.innerHTML });
    }
  };

  const insertLink = () => {
    const url = window.prompt("URL do link (https://…)");
    if (!url) return;
    document.execCommand("createLink", false, url);
    if (selected && editableRefs.current[selected.id]) {
      update(selected.id, { html: editableRefs.current[selected.id]!.innerHTML });
    }
  };

  const uploadImage = async (file: File, blockId: string) => {
    if (!file.type.startsWith("image/")) { toast.error("Selecione um arquivo de imagem"); return; }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `newsletter/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file, { contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
      update(blockId, { src: data.publicUrl });
    } catch {
      toast.error("Erro ao enviar imagem");
    } finally {
      setUploading(false);
    }
  };

  const uploadFile = async (file: File, blockId: string) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "bin";
      const path = `newsletter/files/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file, { contentType: file.type || "application/octet-stream" });
      if (error) throw error;
      const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
      update(blockId, { src: data.publicUrl, fileName: file.name, label: file.name });
    } catch {
      toast.error("Erro ao enviar arquivo");
    } finally {
      setUploading(false);
    }
  };

  const canvasWidth = device === "desktop" ? 560 : 360;

  return (
    <div className={cn("grid grid-cols-[88px_minmax(0,1fr)_280px] h-full min-h-0 overflow-hidden rounded-xl border", disabled && "pointer-events-none opacity-60")}>
      {/* Block library */}
      <div className="border-r bg-muted/30 p-2 flex flex-col gap-2 overflow-y-auto">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground text-center mb-1">Blocos</div>
        {LIBRARY.map((l) => {
          const Icon = l.icon;
          return (
            <button
              key={l.type}
              onClick={() => addBlock(l.type)}
              className="flex flex-col items-center gap-1.5 rounded-lg border bg-background px-1 py-2.5 text-primary hover:border-primary hover:bg-primary/5 transition-colors"
            >
              <Icon className="h-4 w-4" />
              <span className="text-[10px] font-medium text-foreground/70 leading-tight text-center">{l.label}</span>
            </button>
          );
        })}
      </div>

      {/* Canvas */}
      <div className="overflow-auto bg-muted/40 px-4 py-4">
        <div className="flex justify-center gap-2 mb-4">
          <Button size="sm" variant={device === "desktop" ? "default" : "outline"} onClick={() => setDevice("desktop")}>
            <Monitor className="h-4 w-4 mr-1.5" />Desktop
          </Button>
          <Button size="sm" variant={device === "mobile" ? "default" : "outline"} onClick={() => setDevice("mobile")}>
            <Smartphone className="h-4 w-4 mr-1.5" />Mobile
          </Button>
        </div>

        <div
          className="mx-auto bg-white rounded-lg overflow-hidden shadow-lg"
          style={{ width: canvasWidth, maxWidth: "100%" }}
          onClick={() => setSelectedId(null)}
        >
          {/* Header preview */}
          {!settings?.hide_header && (
            <div className="relative overflow-hidden" style={{ background: `linear-gradient(120deg, #0f3d34, ${primaryColor})` }}>
              <img src={headerPhoto} alt="" className="absolute inset-0 w-full h-full object-cover opacity-40 pointer-events-none" style={{ objectPosition: "center" }} />
              <div className="relative px-7 py-6 text-white">
                <div className="flex items-center gap-3 mb-4">
                  <img src={logoLivonius} alt="Livonius" style={{ height: 28, filter: "brightness(0) invert(1)", opacity: 0.92 }} />
                  {showLivo && <img src={logoLivo} alt="Livo" style={{ height: 20, filter: "brightness(0) invert(1)", opacity: 0.85 }} />}
                </div>
                <div className="text-2xl font-bold tracking-wide" style={{ color: settings?.header_title_color || "#ffffff" }}>{(headerTitle || "NEWSLETTER").toUpperCase()}</div>
              </div>
            </div>
          )}

          {/* Blocks */}
          <div className="px-7 py-4 flex flex-col gap-0.5" onClick={(e) => e.stopPropagation()}>
            {blocks.length === 0 && (
              <div className="text-center text-sm text-muted-foreground py-10">
                Adicione blocos pela barra à esquerda.
              </div>
            )}
            {blocks.map((b) => (
              <div
                key={b.id}
                className={cn(
                  "relative group rounded-md -mx-2 px-2 py-1 border border-transparent cursor-pointer",
                  selectedId === b.id && "border-primary/40 bg-primary/[0.03]",
                  selectedId !== b.id && "hover:border-border",
                )}
                onClick={(e) => { e.stopPropagation(); setSelectedId(b.id); }}
              >
                {/* Block toolbar */}
                {selectedId === b.id && (
                  <div className="absolute -top-3.5 right-1 z-10 flex gap-0.5 bg-background border rounded-lg p-1 shadow-md">
                    {(b.type === "text" || b.type === "heading") && (
                      <div className="flex gap-0.5 pr-1 mr-1 border-r">
                        <ToolBtn onMouseDown={(e) => e.preventDefault()} onClick={() => exec("bold")}><Bold className="h-3.5 w-3.5" /></ToolBtn>
                        <ToolBtn onMouseDown={(e) => e.preventDefault()} onClick={() => exec("italic")}><Italic className="h-3.5 w-3.5" /></ToolBtn>
                        <ToolBtn onMouseDown={(e) => e.preventDefault()} onClick={() => exec("insertUnorderedList")}><List className="h-3.5 w-3.5" /></ToolBtn>
                        <ToolBtn onMouseDown={(e) => e.preventDefault()} onClick={insertLink}><Link2 className="h-3.5 w-3.5" /></ToolBtn>
                      </div>
                    )}
                    <ToolBtn onClick={() => move(b.id, -1)}><ArrowUp className="h-3.5 w-3.5" /></ToolBtn>
                    <ToolBtn onClick={() => move(b.id, 1)}><ArrowDown className="h-3.5 w-3.5" /></ToolBtn>
                    <ToolBtn onClick={() => duplicate(b.id)}><Copy className="h-3.5 w-3.5" /></ToolBtn>
                    <ToolBtn onClick={() => remove(b.id)} danger><Trash2 className="h-3.5 w-3.5" /></ToolBtn>
                  </div>
                )}

                <BlockView
                  block={b}
                  bodyTextColor={settings?.body_text_color}
                  editableRef={(el) => (editableRefs.current[b.id] = el)}
                  onInput={(html) => update(b.id, { html })}
                />
              </div>
            ))}
          </div>

          {/* Footer preview */}
          {!settings?.hide_footer && (
            <>
              <div className="px-7 py-5 text-white text-xs leading-relaxed" style={{ background: `linear-gradient(120deg, #0f3d34, ${primaryColor})` }}>
                <div className="flex items-center gap-3 mb-3">
                  <img src={logoLivonius} alt="Livonius" style={{ height: 26, filter: "brightness(0) invert(1)", opacity: 0.9 }} />
                  {showLivo && <img src={logoLivo} alt="Livo" style={{ height: 18, filter: "brightness(0) invert(1)", opacity: 0.85 }} />}
                </div>
                <div className="font-bold text-sm tracking-wide mb-0.5">{companyName}</div>
                {address && <div className="opacity-70 text-[10px] leading-relaxed">{address}</div>}
                {phone && <div className="opacity-70 text-[10px]">{phone}</div>}
                {showSite && siteUrl && <div className="opacity-70 text-[10px]">{siteUrl}</div>}
                <div className="flex items-center gap-2 mt-3">
                  {instagramUrl && <a href={instagramUrl} target="_blank" rel="noreferrer"><img src={ICON_INSTAGRAM} alt="Instagram" style={{ height: 22, width: 22, objectFit: "contain" }} /></a>}
                  {facebookUrl && <a href={facebookUrl} target="_blank" rel="noreferrer"><img src={ICON_FACEBOOK} alt="Facebook" style={{ height: 22, width: 22, objectFit: "contain" }} /></a>}
                  {linkedinUrl && <a href={linkedinUrl} target="_blank" rel="noreferrer"><img src={ICON_LINKEDIN} alt="LinkedIn" style={{ height: 22, width: 22, objectFit: "contain" }} /></a>}
                </div>
              </div>
              <div className="px-7 py-3 text-center text-[10px] bg-white" style={{ color: settings?.footer_text_color || "#666666" }}>
                Visualizar como página web · <span className="underline">cancelar inscrição</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Properties panel */}
      <div className="border-l bg-background p-4 overflow-y-auto">
        {!selected && onSettingsChange ? (
          <TemplateSettingsPanel settings={settings ?? {}} onChange={onSettingsChange} />
        ) : !selected ? (
          <div className="text-sm text-muted-foreground">Clique em um bloco para editar suas propriedades.</div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {LIBRARY.find((l) => l.type === selected.type)?.label || selected.type}
            </div>

            {(selected.type === "text" || selected.type === "heading" || selected.type === "button" || selected.type === "file") && (
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Alinhamento</Label>
                <div className="flex gap-1.5">
                  {ALIGNS.map((a) => (
                    <Button key={a.value} size="sm" variant={(selected.align || "left") === a.value ? "default" : "outline"} className="flex-1 text-xs" onClick={() => update(selected.id, { align: a.value })}>
                      {a.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {(selected.type === "text" || selected.type === "heading") && (
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Cor da fonte</Label>
                <div className="flex gap-2 flex-wrap items-center">
                  {COLOR_CATALOG.map((c) => (
                    <button
                      key={c}
                      onClick={() => update(selected.id, { textColor: c })}
                      className={cn("h-7 w-7 rounded-full border-2", (selected.textColor || "").toLowerCase() === c ? "border-foreground" : "border-transparent")}
                      style={{ background: c }}
                    />
                  ))}
                  <input
                    type="color"
                    value={selected.textColor || (selected.type === "heading" ? LIVO_TEAL : "#333333")}
                    onChange={(e) => update(selected.id, { textColor: e.target.value })}
                    className="h-7 w-7 cursor-pointer rounded-full border p-0.5"
                  />
                </div>
              </div>
            )}

            {selected.type === "button" && (
              <>
                <Field label="Texto do botão">
                  <Input value={selected.label || ""} onChange={(e) => update(selected.id, { label: e.target.value })} />
                </Field>
                <Field label="URL de destino">
                  <Input value={selected.url || ""} placeholder="https://" onChange={(e) => update(selected.id, { url: e.target.value })} />
                </Field>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">Cor</Label>
                  <div className="flex gap-2 flex-wrap">
                    {PALETTE.map((c) => (
                      <button key={c} onClick={() => update(selected.id, { color: c })} className={cn("h-7 w-7 rounded-full border-2", selected.color === c ? "border-foreground" : "border-transparent")} style={{ background: c }} />
                    ))}
                    <input type="color" value={selected.color || LIVO_TEAL} onChange={(e) => update(selected.id, { color: e.target.value })} className="h-7 w-7 cursor-pointer rounded-full border p-0.5" />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Label className="text-xs">Arredondamento — {selected.radius ?? 6}px</Label>
                  <Slider value={[selected.radius ?? 6]} min={0} max={999} step={1} onValueChange={([v]) => update(selected.id, { radius: v })} />
                </div>
                <Button size="sm" variant={selected.full ? "default" : "outline"} onClick={() => update(selected.id, { full: !selected.full })}>
                  {selected.full ? "Usar largura total ✓" : "Usar largura total"}
                </Button>
              </>
            )}

            {selected.type === "image" && (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">Upload de imagem</Label>
                  <label className={cn("flex flex-col items-center justify-center gap-2 h-20 border-2 border-dashed rounded-lg cursor-pointer transition-colors", uploading ? "opacity-50" : "hover:border-primary/50 hover:bg-muted/40")}>
                    {uploading ? (
                      <><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /><span className="text-xs text-muted-foreground">Enviando...</span></>
                    ) : selected.src ? (
                      <><img src={selected.src} alt="" className="h-12 object-contain rounded" /><span className="text-xs text-muted-foreground">Clique para trocar</span></>
                    ) : (
                      <><Upload className="w-5 h-5 text-muted-foreground" /><span className="text-xs text-muted-foreground">Clique para enviar</span></>
                    )}
                    <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f, selected.id); e.target.value = ""; }} />
                  </label>
                </div>
                <Field label="Ou cole a URL">
                  <Input value={selected.src || ""} placeholder="https://…" onChange={(e) => update(selected.id, { src: e.target.value })} />
                </Field>
                <Field label="Texto alternativo">
                  <Input value={selected.alt || ""} placeholder="Descrição da imagem" onChange={(e) => update(selected.id, { alt: e.target.value })} />
                </Field>
              </>
            )}

            {selected.type === "file" && (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">Upload de arquivo</Label>
                  <label className={cn("flex flex-col items-center justify-center gap-2 h-20 border-2 border-dashed rounded-lg cursor-pointer transition-colors", uploading ? "opacity-50" : "hover:border-primary/50 hover:bg-muted/40")}>
                    {uploading ? (
                      <><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /><span className="text-xs text-muted-foreground">Enviando...</span></>
                    ) : selected.fileName ? (
                      <><Paperclip className="w-5 h-5 text-muted-foreground" /><span className="text-xs text-muted-foreground truncate max-w-full px-2">{selected.fileName}</span></>
                    ) : (
                      <><Upload className="w-5 h-5 text-muted-foreground" /><span className="text-xs text-muted-foreground">Clique para enviar</span></>
                    )}
                    <input type="file" className="hidden" disabled={uploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f, selected.id); e.target.value = ""; }} />
                  </label>
                </div>
                <Field label="Ou cole a URL">
                  <Input value={selected.src || ""} placeholder="https://…" onChange={(e) => update(selected.id, { src: e.target.value })} />
                </Field>
                <Field label="Nome do arquivo anexado">
                  <Input value={selected.fileName || ""} placeholder="documento.pdf" onChange={(e) => update(selected.id, { fileName: e.target.value })} />
                </Field>
                <Field label="Texto do botão">
                  <Input value={selected.label || ""} placeholder="Baixar arquivo" onChange={(e) => update(selected.id, { label: e.target.value })} />
                </Field>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">Cor</Label>
                  <div className="flex gap-2 flex-wrap">
                    {PALETTE.map((c) => (
                      <button key={c} onClick={() => update(selected.id, { color: c })} className={cn("h-7 w-7 rounded-full border-2", selected.color === c ? "border-foreground" : "border-transparent")} style={{ background: c }} />
                    ))}
                    <input type="color" value={selected.color || "#f7faf9"} onChange={(e) => update(selected.id, { color: e.target.value })} className="h-7 w-7 cursor-pointer rounded-full border p-0.5" />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Label className="text-xs">Arredondamento — {selected.radius ?? 8}px</Label>
                  <Slider value={[selected.radius ?? 8]} min={0} max={999} step={1} onValueChange={([v]) => update(selected.id, { radius: v })} />
                </div>
                <Button size="sm" variant={selected.full ? "default" : "outline"} onClick={() => update(selected.id, { full: !selected.full })}>
                  {selected.full ? "Usar largura total ✓" : "Usar largura total"}
                </Button>
              </>
            )}

            {selected.type === "html" && (
              <>
                <p className="text-xs text-muted-foreground">
                  HTML bruto — renderizado exatamente como digitado, sem sanitização. Use apenas conteúdo confiável.
                </p>
                <Textarea
                  className="font-mono text-xs min-h-[220px]"
                  placeholder="<p>Seu HTML aqui…</p>"
                  value={selected.html || ""}
                  onChange={(e) => update(selected.id, { html: e.target.value })}
                />
              </>
            )}

            {selected.type === "spacer" && (
              <div className="flex flex-col gap-2">
                <Label className="text-xs">Altura — {selected.height ?? 22}px</Label>
                <Slider value={[selected.height ?? 22]} min={4} max={80} step={2} onValueChange={([v]) => update(selected.id, { height: v })} />
              </div>
            )}

            {selected.type === "table" && (
              <>
                <p className="text-xs text-muted-foreground">Cole dados do Excel/Sheets (colunas separadas por tab).</p>
                <Textarea
                  className="font-mono text-xs min-h-[120px]"
                  placeholder={"Produto\tValor\nA\t10\nB\t20"}
                  defaultValue={(selected.rows || []).map((r) => r.join("\t")).join("\n")}
                  onChange={(e) => {
                    const rows = e.target.value.split("\n").filter((l) => l.trim() !== "").map((l) => l.split("\t"));
                    update(selected.id, { rows });
                  }}
                />
                <Button size="sm" variant={selected.headerRow ? "default" : "outline"} onClick={() => update(selected.id, { headerRow: !selected.headerRow })}>
                  Primeira linha é cabeçalho {selected.headerRow ? "✓" : ""}
                </Button>
                <Button size="sm" variant={selected.zebra ? "default" : "outline"} onClick={() => update(selected.id, { zebra: !selected.zebra })}>
                  Linhas zebradas {selected.zebra ? "✓" : ""}
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ToolBtn({ children, onClick, onMouseDown, danger }: { children: React.ReactNode; onClick?: () => void; onMouseDown?: (e: React.MouseEvent) => void; danger?: boolean }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      onMouseDown={onMouseDown}
      className={cn("h-6 w-6 flex items-center justify-center rounded hover:bg-muted", danger && "text-destructive hover:bg-destructive/10")}
    >
      {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-9 cursor-pointer rounded border p-0.5 shrink-0"
        />
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="font-mono text-xs h-8" />
      </div>
    </div>
  );
}

// contentEditable without cursor-reset: guard every innerHTML write with an
// activeElement check so we never stomp the cursor while the user is typing.
function EditableDiv({
  blockId,
  html,
  editableRef,
  onCommit,
  style,
}: {
  blockId: string;
  html: string;
  editableRef: (el: HTMLDivElement | null) => void;
  onCommit: (html: string) => void;
  style?: React.CSSProperties;
}) {
  const domRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = domRef.current;
    if (!el) return;
    if (el === document.activeElement) return; // user is typing — leave DOM alone
    if (el.innerHTML === html) return;         // no actual change — skip
    el.innerHTML = html;
  // blockId triggers on mount/block-swap; html triggers on external updates.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blockId, html]);

  return (
    <div
      ref={(el) => { domRef.current = el; editableRef(el); }}
      contentEditable
      suppressContentEditableWarning
      onBlur={() => { if (domRef.current) onCommit(domRef.current.innerHTML); }}
      className="outline-none"
      style={style}
    />
  );
}

function BlockView({ block, bodyTextColor, editableRef, onInput }: { block: EmailBlock; bodyTextColor?: string; editableRef: (el: HTMLDivElement | null) => void; onInput: (html: string) => void }) {
  const align = block.align || "left";

  if (block.type === "heading" || block.type === "text") {
    const isHeading = block.type === "heading";
    return (
      <EditableDiv
        blockId={block.id}
        html={block.html || ""}
        editableRef={editableRef}
        onCommit={onInput}
        style={{ textAlign: align, fontSize: isHeading ? 20 : 15, fontWeight: isHeading ? 700 : 400, color: block.textColor || (isHeading ? LIVO_TEAL : bodyTextColor || "#333"), lineHeight: 1.5, minHeight: 20 }}
      />
    );
  }
  if (block.type === "button") {
    return (
      <div style={{ textAlign: align }}>
        <span style={{ display: block.full ? "block" : "inline-block", background: block.color || LIVO_TEAL, color: "#fff", fontSize: 15, fontWeight: 600, padding: "12px 26px", borderRadius: block.radius ?? 6, textAlign: "center" }}>
          {block.label || "Botão"}
        </span>
      </div>
    );
  }
  if (block.type === "image") {
    return block.src ? (
      <div style={{ textAlign: align }}>
        <img src={block.src} alt={block.alt || ""} style={{ maxWidth: "100%", borderRadius: 8 }} />
      </div>
    ) : (
      <div className="border border-dashed rounded-lg py-6 text-center text-xs text-muted-foreground">Imagem — arraste um arquivo ou defina a URL no painel</div>
    );
  }
  if (block.type === "file") {
    return block.src ? (
      <div style={{ textAlign: align }}>
        <a
          href={block.src}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.preventDefault()}
          className="no-underline"
          style={{
            display: block.full ? "flex" : "inline-flex",
            alignItems: "center",
            gap: 8,
            justifyContent: block.full ? "center" : undefined,
            background: block.color || "#f7faf9",
            color: block.color ? "#fff" : "inherit",
            fontSize: 15,
            fontWeight: 600,
            padding: "12px 20px",
            borderRadius: block.radius ?? 8,
          }}
        >
          📎 {block.label || block.fileName || "Baixar arquivo"}
        </a>
      </div>
    ) : (
      <div className="border border-dashed rounded-lg py-6 text-center text-xs text-muted-foreground">Arquivo — envie um arquivo ou defina a URL no painel</div>
    );
  }
  if (block.type === "html") {
    return block.html ? (
      <div dangerouslySetInnerHTML={{ __html: block.html }} />
    ) : (
      <div className="border border-dashed rounded-lg py-6 text-center text-xs text-muted-foreground">HTML — cole o código no painel à direita</div>
    );
  }
  if (block.type === "divider") return <div style={{ height: 1, background: "#e4e9e7" }} />;
  if (block.type === "spacer") return <div style={{ height: block.height ?? 22 }} />;
  if (block.type === "table") {
    const rows = block.rows || [];
    return (
      <table className="w-full border-collapse text-[13px]">
        <tbody>
          {rows.map((cells, r) => {
            const isHead = block.headerRow && r === 0;
            return (
              <tr key={r} style={{ background: isHead ? LIVO_TEAL : block.zebra && r % 2 === 0 ? "#f4f8f7" : "#fff" }}>
                {cells.map((c, ci) => (
                  <td key={ci} style={{ border: "1px solid #e4e9e7", padding: "9px 12px", color: isHead ? "#fff" : "#333", fontWeight: isHead ? 600 : 400 }}>{c}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  }
  return <div dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(block.html || "") }} />;
}

// ─── Template settings panel (shown when no block is selected and onSettingsChange is provided) ───

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground pt-2 pb-1 border-b mb-2">{children}</p>;
}

function TemplateSettingsPanel({
  settings,
  onChange,
}: {
  settings: EmailGenerationSettings;
  onChange: (s: EmailGenerationSettings) => void;
}) {
  const set = <K extends keyof EmailGenerationSettings>(key: K, value: EmailGenerationSettings[K]) =>
    onChange({ ...settings, [key]: value });

  const currentColor = settings.gradient_color || settings.primary_color || LIVO_TEAL;
  const handleColor = (hex: string) => onChange({ ...settings, gradient_color: hex, primary_color: hex });

  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Modelo</div>

      {/* ── Aparência ── */}
      <SectionTitle>Aparência</SectionTitle>

      <Field label="Título do cabeçalho">
        <Input
          value={settings.header_title ?? ""}
          placeholder="CIRCULARES"
          onChange={(e) => set("header_title", e.target.value)}
          className="text-xs h-8"
        />
      </Field>

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">Cor principal</Label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={currentColor}
            onChange={(e) => handleColor(e.target.value)}
            className="h-8 w-9 cursor-pointer rounded border p-0.5 shrink-0"
          />
          <Input
            value={currentColor}
            onChange={(e) => handleColor(e.target.value)}
            className="font-mono text-xs h-8"
          />
        </div>
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {COLOR_CATALOG.map((c) => (
            <button
              key={c}
              onClick={() => handleColor(c)}
              className={cn("h-6 w-6 rounded-full border-2 transition-transform hover:scale-110", currentColor.toLowerCase() === c ? "border-foreground" : "border-transparent")}
              style={{ background: c }}
            />
          ))}
        </div>
      </div>

      <ColorField
        label="Cor do título do cabeçalho"
        value={settings.header_title_color || "#ffffff"}
        onChange={(v) => set("header_title_color", v)}
      />

      <div className="flex items-center justify-between py-0.5">
        <Label className="text-xs">Mostrar logo secundária</Label>
        <Switch checked={settings.show_livo !== false} onCheckedChange={(v) => set("show_livo", v)} />
      </div>
      <div className="flex items-center justify-between py-0.5">
        <Label className="text-xs">Mostrar site no rodapé</Label>
        <Switch checked={settings.show_site !== false} onCheckedChange={(v) => set("show_site", v)} />
      </div>
      <div className="flex items-center justify-between py-0.5">
        <Label className="text-xs">Mostrar cabeçalho de marca</Label>
        <Switch checked={!settings.hide_header} onCheckedChange={(v) => set("hide_header", !v)} />
      </div>
      <div className="flex items-center justify-between py-0.5">
        <Label className="text-xs">Mostrar rodapé de marca</Label>
        <Switch checked={!settings.hide_footer} onCheckedChange={(v) => set("hide_footer", !v)} />
      </div>

      <ColorField
        label="Cor padrão do texto do corpo"
        value={settings.body_text_color || "#333333"}
        onChange={(v) => set("body_text_color", v)}
      />
      <ColorField
        label="Cor do texto do rodapé"
        value={settings.footer_text_color || "#666666"}
        onChange={(v) => set("footer_text_color", v)}
      />

      {/* ── Identidade Visual ── */}
      <SectionTitle>Identidade Visual</SectionTitle>

      <ImageUploadField
        label="Logo Primária"
        hint="Cabeçalho e rodapé (ideal: 120px)"
        value={settings.logo_livonius_url ?? ""}
        onChange={(v) => set("logo_livonius_url", v)}
      />
      <ImageUploadField
        label="Logo Secundária"
        hint="Ao lado da primária (ideal: 55px)"
        value={settings.logo_livo_url ?? ""}
        onChange={(v) => set("logo_livo_url", v)}
      />
      <ImageUploadField
        label="Foto de Fundo do Cabeçalho"
        hint="600×220px recomendado"
        value={settings.header_photo_url ?? ""}
        onChange={(v) => set("header_photo_url", v)}
      />

      {/* ── Empresa ── */}
      <SectionTitle>Empresa</SectionTitle>

      <Field label="Nome da empresa">
        <Input value={settings.company_name ?? ""} placeholder="Livonius MGA" onChange={(e) => set("company_name", e.target.value)} className="text-xs h-8" />
      </Field>
      <Field label="Endereço">
        <Input value={settings.address ?? ""} placeholder="Av. Exemplo, 1000 - Cidade/UF" onChange={(e) => set("address", e.target.value)} className="text-xs h-8" />
      </Field>
      <Field label="Telefone">
        <Input value={settings.phone ?? ""} placeholder="(00) 0000.0000" onChange={(e) => set("phone", e.target.value)} className="text-xs h-8" />
      </Field>
      <Field label="Site">
        <Input value={settings.site_url ?? ""} placeholder="meusite.com.br" onChange={(e) => set("site_url", e.target.value)} className="text-xs h-8" />
      </Field>
      <Field label="Nome do remetente">
        <Input value={settings.sender_name ?? ""} placeholder="Livonius MGA" onChange={(e) => set("sender_name", e.target.value)} className="text-xs h-8" />
      </Field>

      {/* ── Redes Sociais ── */}
      <SectionTitle>Redes Sociais</SectionTitle>

      <Field label="Instagram">
        <Input value={settings.instagram_url ?? ""} placeholder="https://www.instagram.com/…" onChange={(e) => set("instagram_url", e.target.value)} className="text-xs h-8" />
      </Field>
      <Field label="Facebook">
        <Input value={settings.facebook_url ?? ""} placeholder="https://www.facebook.com/…" onChange={(e) => set("facebook_url", e.target.value)} className="text-xs h-8" />
      </Field>
      <Field label="LinkedIn">
        <Input value={settings.linkedin_url ?? ""} placeholder="https://www.linkedin.com/…" onChange={(e) => set("linkedin_url", e.target.value)} className="text-xs h-8" />
      </Field>
    </div>
  );
}
