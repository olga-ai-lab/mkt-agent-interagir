import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  AlertTriangle,
  Copy,
  Eraser,
  ImagePlus,
  Loader2,
  Maximize2,
  Move,
  Plus,
  RefreshCw,
  Save,
  SquareDashedMousePointer,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { api } from "@/services/api";
import { cn } from "@/lib/utils";
import {
  DEFAULT_MAIN_LOGO_ID,
  POSITION_PRESETS,
  REGULATORY_POSITION_PRESETS,
  SAFE_AREA_BOTTOM,
  buildPartnerOverlayFromAsset,
  clampOverlay,
  clampRegulatory,
  createDefaultBrandOverlay,
  getBrandLogoUrl,
  getRegulatoryPresetPosition,
  normalizeComposition,
} from "@/lib/brandComposition";
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
const PARTNER_ALLOWED_TYPES = ["image/png", "image/webp"];

type SelectedLayer =
  | { kind: "overlay"; id: string }
  | { kind: "regulatory" }
  | null;

interface BrandCompositionEditorProps {
  workspaceId: string;
  company: PostCompany;
  baseMediaUrls: string[];
  composition: MediaComposition | null | undefined;
  regulatoryNotes: string;
  isBaseMediaDerived?: boolean;
  disabled?: boolean;
  onCompositionChange: (composition: MediaComposition) => void;
  onRegulatoryNotesChange: (notes: string) => void;
  /** Called when user clicks "Salvar posicionamento" inside the Ampliar dialog */
  onSaveComposition?: () => Promise<void>;
}

function isMissingBrandAssetsTableError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : JSON.stringify(error || {});

  return /brand_assets/i.test(message) && /(schema cache|does not exist|could not find the table)/i.test(message);
}

function isVideo(url: string) {
  return /\.(mp4|webm|mov)$/i.test(url);
}

function compositionSignature(value: MediaComposition) {
  return JSON.stringify(value);
}

function cloneSlides(slides: MediaCompositionSlide[]): MediaCompositionSlide[] {
  return slides.map((slide) => ({
    ...slide,
    overlays: slide.overlays.map((overlay) => ({ ...overlay })),
    regulatory: slide.regulatory ? { ...slide.regulatory } : null,
  }));
}

function updateSlide(
  composition: MediaComposition,
  slideIndex: number,
  updater: (slide: MediaCompositionSlide) => MediaCompositionSlide,
) {
  const slides = cloneSlides(composition.slides);
  slides[slideIndex] = updater(slides[slideIndex]);
  return { slides };
}

export function BrandCompositionEditor({
  workspaceId,
  company,
  baseMediaUrls,
  composition,
  regulatoryNotes,
  isBaseMediaDerived = false,
  disabled = false,
  onCompositionChange,
  onRegulatoryNotesChange,
  onSaveComposition,
}: BrandCompositionEditorProps) {
  const [selectedSlide, setSelectedSlide] = useState(0);
  const [selectedLayer, setSelectedLayer] = useState<SelectedLayer>(null);
  const [brandAssets, setBrandAssets] = useState<BrandAsset[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [assetName, setAssetName] = useState("");
  const [assetFile, setAssetFile] = useState<File | null>(null);
  const [saveToLibrary, setSaveToLibrary] = useState(true);
  const [uploadingAsset, setUploadingAsset] = useState(false);
  const [libraryPersistenceAvailable, setLibraryPersistenceAvailable] = useState(true);
  const [imageAspect, setImageAspect] = useState(1);
  const [expandOpen, setExpandOpen] = useState(false);
  const [savingComposition, setSavingComposition] = useState(false);

  const handleSaveComposition = useCallback(async () => {
    if (!onSaveComposition) return;
    setSavingComposition(true);
    try {
      await onSaveComposition();
      toast.success("Posicionamento salvo!");
    } catch {
      toast.error("Erro ao salvar posicionamento");
    } finally {
      setSavingComposition(false);
    }
  }, [onSaveComposition]);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const expandedPreviewRef = useRef<HTMLDivElement | null>(null);
  const normalized = useMemo(
    () => normalizeComposition(baseMediaUrls, composition, company),
    [baseMediaUrls, composition, company],
  );
  const normalizedSignature = useMemo(() => compositionSignature(normalized), [normalized]);

  useEffect(() => {
    if (!composition || compositionSignature(composition) !== normalizedSignature) {
      onCompositionChange(normalized);
    }
  }, [composition, normalized, normalizedSignature, onCompositionChange]);

  useEffect(() => {
    if (selectedSlide > Math.max(baseMediaUrls.length - 1, 0)) {
      setSelectedSlide(0);
    }
  }, [baseMediaUrls.length, selectedSlide]);

  useEffect(() => {
    let active = true;
    async function loadAssets() {
      setAssetsLoading(true);
      try {
        const assets = await api.listBrandAssets(workspaceId, "partner_logo");
        if (active) {
          setBrandAssets(assets);
          setLibraryPersistenceAvailable(true);
        }
      } catch (error) {
        if (!active) return;
        if (isMissingBrandAssetsTableError(error)) {
          setLibraryPersistenceAvailable(false);
          setSaveToLibrary(false);
          setBrandAssets([]);
          return;
        }
        console.error("Error loading brand assets:", error);
      } finally {
        if (active) setAssetsLoading(false);
      }
    }
    loadAssets();
    return () => {
      active = false;
    };
  }, [workspaceId]);

  const slides = normalized.slides;
  const currentSlide = slides[selectedSlide];
  const currentSourceUrl = currentSlide?.sourceUrl;

  useEffect(() => {
    if (!currentSourceUrl || isVideo(currentSourceUrl)) return;
    const image = new Image();
    image.onload = () => {
      const nextAspect = image.naturalWidth / image.naturalHeight || 1;
      setImageAspect(nextAspect);
    };
    image.src = currentSourceUrl;
  }, [currentSourceUrl]);

  const mainOverlay = currentSlide?.overlays.find((overlay) => overlay.assetId === DEFAULT_MAIN_LOGO_ID)
    || createDefaultBrandOverlay(company);
  const partnerOverlays = currentSlide?.overlays.filter((overlay) => overlay.type === "partner_logo") || [];
  const selectedOverlay = selectedLayer?.kind === "overlay"
    ? currentSlide?.overlays.find((overlay) => overlay.id === selectedLayer.id) || null
    : null;

  const ensureComposition = () => normalizeComposition(baseMediaUrls, normalized, company);

  const updateComposition = (next: MediaComposition) => {
    onCompositionChange(normalizeComposition(baseMediaUrls, next, company));
  };

  const updateCurrentSlide = (updater: (slide: MediaCompositionSlide) => MediaCompositionSlide) => {
    updateComposition(updateSlide(ensureComposition(), selectedSlide, updater));
  };

  const setOverlay = (overlayId: string, updater: (overlay: OverlayItem) => OverlayItem) => {
    updateCurrentSlide((slide) => ({
      ...slide,
      overlays: slide.overlays.map((overlay) => {
        if (overlay.id !== overlayId) return overlay;
        return clampOverlay(updater(overlay));
      }),
    }));
  };

  const setCurrentRegulatory = (updater: (regulatory: RegulatoryBlock | null) => RegulatoryBlock | null) => {
    updateCurrentSlide((slide) => ({
      ...slide,
      regulatory: clampRegulatory(updater(slide.regulatory ?? null)),
    }));
  };

  const applyPreset = (overlayId: string, preset: OverlayAnchor) => {
    const target = POSITION_PRESETS.find((item) => item.id === preset);
    if (!target) return;
    setOverlay(overlayId, (overlay) => ({
      ...overlay,
      anchor: preset,
      x: target.x,
      y: target.y,
    }));
  };

  const removeOverlay = (overlayId: string) => {
    updateCurrentSlide((slide) => ({
      ...slide,
      overlays: slide.overlays.filter((overlay) => overlay.id !== overlayId),
    }));
    if (selectedLayer?.kind === "overlay" && selectedLayer.id === overlayId) {
      setSelectedLayer(null);
    }
  };

  const resetCurrentSlide = () => {
    updateCurrentSlide((slide) => ({
      ...slide,
      overlays: [createDefaultBrandOverlay(company)],
      regulatory: null,
    }));
    setSelectedLayer(null);
  };

  const duplicateToAllSlides = () => {
    const next = ensureComposition();
    const templateSlide = next.slides[selectedSlide];
    if (!templateSlide) return;

    updateComposition({
      slides: next.slides.map((slide, index) =>
        index === selectedSlide
          ? slide
          : {
              ...slide,
              overlays: templateSlide.overlays.map((overlay) => ({ ...overlay, id: crypto.randomUUID() })),
              regulatory: templateSlide.regulatory ? { ...templateSlide.regulatory } : null,
            },
      ),
    });
    toast.success("Composição replicada para os demais slides");
  };

  const applyMainLogoToAllSlides = () => {
    const next = ensureComposition();
    updateComposition({
      slides: next.slides.map((slide) => {
        const partnerOnly = slide.overlays.filter((overlay) => overlay.assetId !== DEFAULT_MAIN_LOGO_ID);
        return {
          ...slide,
          overlays: [...partnerOnly, { ...mainOverlay, id: crypto.randomUUID() }],
        };
      }),
    });
    toast.success("Logo principal aplicada em todos os slides");
  };

  const insertRegulatoryBlock = () => {
    if (!regulatoryNotes.trim()) {
      toast.error("Preencha as observações regulatórias primeiro");
      return;
    }
    setCurrentRegulatory((current) => ({
      text: current?.text || regulatoryNotes.trim(),
      x: current?.x ?? 0.04,
      y: current?.y ?? 0.78,
      width: current?.width ?? 0.92,
      height: current?.height ?? 0.16,
      anchor: current?.anchor ?? "footer-center",
      color: current?.color ?? "white",
      orientation: current?.orientation ?? "horizontal",
      visible: true,
    }));
    setSelectedLayer({ kind: "regulatory" });
  };

  const handlePartnerUpload = async () => {
    if (!assetFile) {
      toast.error("Selecione uma logo PNG ou WebP");
      return;
    }
    if (!PARTNER_ALLOWED_TYPES.includes(assetFile.type)) {
      toast.error("Use apenas PNG ou WebP transparente no editor");
      return;
    }

    setUploadingAsset(true);
    try {
      const extension = assetFile.name.split(".").pop()?.toLowerCase() || "png";
      const storagePath = `brand-assets/${workspaceId}/${crypto.randomUUID()}.${extension}`;
      const { error } = await supabase.storage
        .from(MEDIA_BUCKET)
        .upload(storagePath, assetFile, {
          contentType: assetFile.type,
          upsert: false,
        });

      if (error) throw error;

      const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(storagePath);
      let assetRecord: BrandAsset | null = null;

      if (saveToLibrary) {
        try {
          assetRecord = await api.createBrandAsset({
            workspace_id: workspaceId,
            name: assetName.trim() || assetFile.name.replace(/\.[^.]+$/, ""),
            kind: "partner_logo",
            file_url: data.publicUrl,
            file_path: storagePath,
            mime_type: assetFile.type,
          });
          setBrandAssets((prev) => [assetRecord!, ...prev]);
          setLibraryPersistenceAvailable(true);
        } catch (error) {
          if (isMissingBrandAssetsTableError(error)) {
            setLibraryPersistenceAvailable(false);
            setSaveToLibrary(false);
            toast.warning("A biblioteca ainda não está habilitada neste ambiente. A logo será usada apenas neste post.");
          } else {
            throw error;
          }
        }
      }

      updateCurrentSlide((slide) => ({
        ...slide,
        overlays: [
          ...slide.overlays,
          assetRecord
            ? buildPartnerOverlayFromAsset(assetRecord)
            : {
                id: crypto.randomUUID(),
                assetId: null,
                uploadedUrl: data.publicUrl,
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
                label: assetName.trim() || assetFile.name.replace(/\.[^.]+$/, ""),
              },
        ].map(clampOverlay),
      }));

      setAssetName("");
      setAssetFile(null);
      setLibraryOpen(false);
      toast.success("Logo parceira adicionada ao slide");
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || "Erro ao subir a logo parceira");
    } finally {
      setUploadingAsset(false);
    }
  };

  const insertBrandAsset = (asset: BrandAsset) => {
    updateCurrentSlide((slide) => ({
      ...slide,
      overlays: [...slide.overlays, buildPartnerOverlayFromAsset(asset)].map(clampOverlay),
    }));
    setLibraryOpen(false);
    toast.success(`${asset.name} adicionada ao slide`);
  };

  useEffect(() => {
    if (!currentSlide) return;
    if (selectedLayer?.kind === "overlay" && !currentSlide.overlays.some((overlay) => overlay.id === selectedLayer.id)) {
      setSelectedLayer(null);
    }
  }, [currentSlide, selectedLayer]);

  const beginPointerInteraction = (
    event: React.PointerEvent,
    target: SelectedLayer,
    mode: "move" | "resize",
    containerRef: React.RefObject<HTMLDivElement> = previewRef,
  ) => {
    if (disabled || !containerRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    setSelectedLayer(target);

    const rect = containerRef.current.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const overlay =
      target?.kind === "overlay"
        ? currentSlide?.overlays.find((item) => item.id === target.id) || null
        : null;
    const regulatory = target?.kind === "regulatory" ? currentSlide?.regulatory || null : null;
    const origin = overlay || regulatory;
    if (!origin) return;

    // O bloco regulatório usa minHeight (cresce para caber o texto, inclusive
    // quebrando em mais de uma linha) — a altura ARMAZENADA em
    // `regulatory.height` pode não bater com a altura REAL renderizada.
    // clampRegulatory() usa `height` pra calcular até onde o bloco pode
    // descer (y máximo = 1 - height); se o valor guardado for menor que o
    // real, o bloco para antes de encostar na borda inferior (ou passa dela,
    // se for maior). Sincroniza com a altura real medida no DOM assim que o
    // arraste começa, pra o limite bater com o que está na tela.
    let syncedRegulatoryHeight = regulatory?.height ?? 0;
    if (target?.kind === "regulatory" && regulatory) {
      const el = event.currentTarget as HTMLElement;
      const elRect = el.getBoundingClientRect();
      const realHeight = elRect.height / rect.height;
      if (mode === "move" && Number.isFinite(realHeight) && Math.abs(realHeight - regulatory.height) > 0.002) {
        syncedRegulatoryHeight = realHeight;
        setCurrentRegulatory((item) => (item ? { ...item, height: realHeight } : item));
      }
    }

    const onMove = (moveEvent: PointerEvent) => {
      const deltaX = (moveEvent.clientX - startX) / rect.width;
      const deltaY = (moveEvent.clientY - startY) / rect.height;

      if (target?.kind === "overlay" && overlay) {
        setOverlay(target.id, (item) =>
          mode === "move"
            ? {
                ...item,
                x: overlay.x + deltaX,
                y: overlay.y + deltaY,
              }
            : {
                ...item,
                width: overlay.width + deltaX,
                height: overlay.height + deltaY,
              },
        );
      }

      if (target?.kind === "regulatory" && regulatory) {
        setCurrentRegulatory((item) => {
          const current = item || { ...regulatory, height: syncedRegulatoryHeight };
          return mode === "move"
            ? {
                ...current,
                x: current.x + deltaX,
                y: current.y + deltaY,
              }
            : {
                ...current,
                width: current.width + deltaX,
                height: current.height + deltaY,
              };
        });
      }
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  // Compartilhado entre o preview compacto do card e o modal "ampliar": mesma
  // imagem, mesmas camadas arrastáveis/redimensionáveis, apenas o ref e o
  // tamanho mudam — editar no modal ampliado atualiza o mesmo estado do post.
  const renderCanvas = (containerRef: React.RefObject<HTMLDivElement>, sizeClassName: string) => {
    if (!currentSlide || isVideo(currentSlide.sourceUrl)) return null;

    return (
      <div
        ref={containerRef}
        className={cn("relative mx-auto overflow-hidden rounded-xl border bg-background shadow-sm", sizeClassName)}
        style={{ aspectRatio: imageAspect, containerType: "size" }}
        onClick={() => setSelectedLayer(null)}
      >
        <img
          src={currentSlide.sourceUrl}
          alt={`Slide ${selectedSlide + 1}`}
          className="absolute inset-0 h-full w-full object-cover"
        />

        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 border-t border-dashed border-amber-500/70 bg-amber-500/10"
          style={{ height: `${SAFE_AREA_BOTTOM * 100}%` }}
        >
          <div className="absolute right-3 top-2 rounded-full bg-background/80 px-2 py-1 text-[11px] font-medium text-amber-700">
            Safe area do rodapé
          </div>
        </div>

        {currentSlide.overlays.map((overlay) => {
          const isSelected = selectedLayer?.kind === "overlay" && selectedLayer.id === overlay.id;
          const source = overlay.assetId === DEFAULT_MAIN_LOGO_ID
            ? getBrandLogoUrl(company, overlay.variant || "default")
            : overlay.uploadedUrl;

          if (!source || overlay.visible === false) return null;

          return (
            <div
              key={overlay.id}
              className={cn(
                "absolute cursor-move rounded-lg border-2 transition",
                isSelected ? "border-primary shadow-[0_0_0_2px_rgba(14,165,233,0.18)]" : "border-transparent hover:border-primary/50",
              )}
              style={{
                left: `${overlay.x * 100}%`,
                top: `${overlay.y * 100}%`,
                width: `${overlay.width * 100}%`,
                height: `${overlay.height * 100}%`,
                opacity: overlay.opacity,
                zIndex: overlay.zIndex || 10,
              }}
              onPointerDown={(event) => beginPointerInteraction(event, { kind: "overlay", id: overlay.id }, "move", containerRef)}
            >
              <img src={source} alt={overlay.label || "Overlay"} className="h-full w-full object-contain" />
              <button
                type="button"
                className="absolute -bottom-2 -right-2 h-4 w-4 rounded-full border border-primary bg-background"
                onPointerDown={(event) => beginPointerInteraction(event, { kind: "overlay", id: overlay.id }, "resize", containerRef)}
              />
            </div>
          );
        })}

        {currentSlide.regulatory?.visible !== false && currentSlide.regulatory?.text?.trim() && (
          <div
            className={cn(
              "absolute cursor-move overflow-hidden border-2",
              currentSlide.regulatory.orientation === "vertical" && "flex items-center justify-center",
              selectedLayer?.kind === "regulatory" ? "border-primary" : "border-transparent hover:border-primary/50",
            )}
            style={{
              left: `${currentSlide.regulatory.x * 100}%`,
              top: `${currentSlide.regulatory.y * 100}%`,
              width: `${currentSlide.regulatory.width * 100}%`,
              // height fixo (não minHeight): o clamp de y (1 - height, em
              // clampRegulatory) precisa bater exatamente com a altura visual
              // do bloco pra ele conseguir encostar na borda inferior — com
              // minHeight o texto podia empurrar a altura real além do valor
              // guardado, deixando o limite de arraste fora de sincronia com
              // o que aparecia na tela. Cresça o bloco pela alça de
              // redimensionar se o texto não couber.
              height: `${currentSlide.regulatory.height * 100}%`,
              zIndex: 30,
            }}
            onPointerDown={(event) => beginPointerInteraction(event, { kind: "regulatory" }, "move", containerRef)}
          >
            <p
              className="leading-snug font-semibold"
              style={{
                fontSize: `${(currentSlide.regulatory.fontSize ?? 0.02) * 100}cqh`,
                color: currentSlide.regulatory.color === "black" ? "#000000" : "#FFFFFF",
                ...(currentSlide.regulatory.orientation === "vertical"
                  ? { transform: "rotate(-90deg)", whiteSpace: "nowrap" as const }
                  : {}),
              }}
            >
              {currentSlide.regulatory.text}
            </p>
            <button
              type="button"
              className="absolute -bottom-2 -right-2 h-4 w-4 rounded-full border border-primary bg-background"
              onPointerDown={(event) => beginPointerInteraction(event, { kind: "regulatory" }, "resize", containerRef)}
            />
          </div>
        )}
      </div>
    );
  };

  if (baseMediaUrls.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Composição de Marca</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Adicione uma imagem primeiro. A composição visual só fica disponível para imagens, não para vídeos isolados.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
    <Card>
      <CardHeader className="gap-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>Composição de Marca</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Preserve a mídia-base e componha logos parceiras, marca principal e texto regulatório por slide.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={duplicateToAllSlides} disabled={disabled}>
              <Copy className="mr-2 h-4 w-4" />
              Duplicar composição
            </Button>
            <Button variant="outline" size="sm" onClick={applyMainLogoToAllSlides} disabled={disabled}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Aplicar logo em todos
            </Button>
            <Button variant="outline" size="sm" onClick={resetCurrentSlide} disabled={disabled}>
              <Eraser className="mr-2 h-4 w-4" />
              Resetar slide
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {isBaseMediaDerived && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">Este post ainda não tem mídia-base preservada.</p>
                <p className="mt-1 text-amber-800">
                  O editor está usando a arte final atual como fallback. As próximas gerações passam a salvar a imagem sem carimbo para reposicionamento real da marca.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_360px]">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {slides.map((slide, index) => (
                <button
                  type="button"
                  key={slide.sourceUrl}
                  className={cn(
                    "overflow-hidden rounded-lg border text-left transition",
                    selectedSlide === index ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/50",
                  )}
                  onClick={() => setSelectedSlide(index)}
                >
                  {isVideo(slide.sourceUrl) ? (
                    <div className="flex h-16 w-24 items-center justify-center bg-muted text-[11px] text-muted-foreground">
                      Vídeo
                    </div>
                  ) : (
                    <img src={slide.sourceUrl} alt={`Slide ${index + 1}`} className="h-16 w-24 object-cover" />
                  )}
                </button>
              ))}
            </div>

            {currentSlide && (
              <div className="rounded-xl border bg-muted/20 p-4">
                {isVideo(currentSlide.sourceUrl) ? (
                  <div className="flex min-h-[360px] flex-col items-center justify-center rounded-lg border border-dashed bg-background p-8 text-center">
                    <AlertTriangle className="mb-3 h-8 w-8 text-amber-500" />
                    <p className="font-medium">Edição de overlay indisponível para vídeo no v1</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      O vídeo continua preservado, mas a composição visual por arraste está habilitada apenas para imagens.
                    </p>
                  </div>
                ) : (
                  <div className="group relative">
                    {renderCanvas(previewRef, "w-full max-w-[720px]")}
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon"
                      className="absolute right-3 top-3 h-8 w-8 opacity-80 shadow transition hover:opacity-100"
                      onClick={() => setExpandOpen(true)}
                      title="Ampliar para posicionar com mais precisão"
                    >
                      <Maximize2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-4">
            {currentSlide && !isVideo(currentSlide.sourceUrl) && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full gap-2"
                onClick={() => setExpandOpen(true)}
              >
                <Maximize2 className="h-4 w-4" />
                Ampliar canvas para posicionar
              </Button>
            )}
            {onSaveComposition && (
              <Button
                type="button"
                size="sm"
                className="w-full gap-2"
                onClick={handleSaveComposition}
                disabled={savingComposition || disabled}
              >
                {savingComposition
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Save className="h-4 w-4" />}
                Salvar posicionamento
              </Button>
            )}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Marca principal</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">{company === "livonius" ? "Livonius" : "Livo"}</p>
                    <p className="text-xs text-muted-foreground">Overlay principal do post</p>
                  </div>
                  <Switch
                    checked={mainOverlay.visible !== false}
                    onCheckedChange={(checked) => setOverlay(mainOverlay.id, (overlay) => ({ ...overlay, visible: checked }))}
                    disabled={disabled}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Variante da logo</Label>
                  <Select
                    value={mainOverlay.variant || "default"}
                    onValueChange={(value: "default" | "white") =>
                      setOverlay(mainOverlay.id, (overlay) => ({ ...overlay, variant: value }))
                    }
                    disabled={disabled}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Padrão</SelectItem>
                      <SelectItem value="white">Branca</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Tamanho</Label>
                  <Slider
                    value={[mainOverlay.width]}
                    min={0.08}
                    max={0.32}
                    step={0.01}
                    onValueChange={([value]) => setOverlay(mainOverlay.id, (overlay) => ({ ...overlay, width: value }))}
                    disabled={disabled}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Posição rápida</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {POSITION_PRESETS.map((preset) => (
                      <Button
                        key={preset.id}
                        variant={mainOverlay.anchor === preset.id ? "default" : "outline"}
                        size="sm"
                        onClick={() => applyPreset(mainOverlay.id, preset.id)}
                        disabled={disabled}
                      >
                        {preset.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Logos parceiras</CardTitle>
                  <Dialog open={libraryOpen} onOpenChange={setLibraryOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" disabled={disabled}>
                        <ImagePlus className="mr-2 h-4 w-4" />
                        Biblioteca
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-3xl">
                      <DialogHeader>
                        <DialogTitle>Biblioteca de logos</DialogTitle>
                      </DialogHeader>
                      <div className="grid gap-6 md:grid-cols-[1fr_320px]">
                        <ScrollArea className="max-h-[420px] rounded-lg border">
                          <div className="grid gap-3 p-4 sm:grid-cols-2">
                            {brandAssets.map((asset) => (
                              <button
                                key={asset.id}
                                type="button"
                                title="Passe o mouse para dar zoom · clique para adicionar ao slide"
                                className="group rounded-lg border p-3 text-left transition hover:border-primary/60 hover:bg-muted/30"
                                onClick={() => insertBrandAsset(asset)}
                              >
                                <div
                                  className="mb-3 flex h-32 items-center justify-center overflow-hidden rounded-md border bg-white"
                                  style={{
                                    backgroundImage:
                                      "linear-gradient(45deg, #e2e8f0 25%, transparent 25%), linear-gradient(-45deg, #e2e8f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e2e8f0 75%), linear-gradient(-45deg, transparent 75%, #e2e8f0 75%)",
                                    backgroundSize: "16px 16px",
                                    backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0",
                                  }}
                                >
                                  <img
                                    src={asset.file_url}
                                    alt={asset.name}
                                    className="max-h-full max-w-full object-contain p-2 transition-transform duration-200 ease-out group-hover:scale-[1.6]"
                                  />
                                </div>
                                <p className="truncate text-sm font-medium">{asset.name}</p>
                              </button>
                            ))}
                            {!assetsLoading && brandAssets.length === 0 && (
                              <div className="col-span-full rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                                Ainda não há logos salvas para este workspace.
                              </div>
                            )}
                          </div>
                        </ScrollArea>

                        <div className="space-y-4 rounded-lg border p-4">
                          <div className="space-y-2">
                            <Label>Nome do parceiro</Label>
                            <Input value={assetName} onChange={(event) => setAssetName(event.target.value)} placeholder="Ex.: Surrai" />
                          </div>
                          <div className="space-y-2">
                            <Label>Arquivo PNG/WebP transparente</Label>
                            <Input
                              type="file"
                              accept=".png,.webp,image/png,image/webp"
                              onChange={(event) => setAssetFile(event.target.files?.[0] || null)}
                            />
                          </div>
                          <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                            <div>
                              <p className="text-sm font-medium">Salvar na biblioteca</p>
                              <p className="text-xs text-muted-foreground">Reutilizar em outros posts</p>
                            </div>
                            <Switch
                              checked={saveToLibrary}
                              onCheckedChange={setSaveToLibrary}
                              disabled={!libraryPersistenceAvailable}
                            />
                          </div>
                          {!libraryPersistenceAvailable && (
                            <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                              A biblioteca de logos ainda não foi provisionada neste ambiente. Você pode continuar adicionando logos diretamente ao slide.
                            </div>
                          )}
                          <Button className="w-full" onClick={handlePartnerUpload} disabled={uploadingAsset || !assetFile}>
                            <Plus className="mr-2 h-4 w-4" />
                            {uploadingAsset ? "Enviando..." : "Adicionar ao slide"}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {partnerOverlays.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    Nenhuma logo parceira neste slide ainda.
                  </div>
                ) : (
                  partnerOverlays.map((overlay) => (
                    <div
                      key={overlay.id}
                      className={cn(
                        "rounded-lg border p-3",
                        selectedLayer?.kind === "overlay" && selectedLayer.id === overlay.id && "border-primary bg-primary/5",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{overlay.label || "Parceiro"}</p>
                          <p className="text-xs text-muted-foreground">Slide {selectedSlide + 1}</p>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setSelectedLayer({ kind: "overlay", id: overlay.id })}
                          >
                            <Move className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => removeOverlay(overlay.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Regulatório (SUSEP / ANS)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Notas regulatórias do post</Label>
                  <Textarea
                    value={regulatoryNotes}
                    onChange={(event) => onRegulatoryNotesChange(event.target.value)}
                    placeholder="Ex.: SUSEP 15414.900123/2026-14 • Produto sujeito à análise de elegibilidade."
                    rows={3}
                    disabled={disabled}
                  />
                </div>
                <Button variant="outline" className="w-full" onClick={insertRegulatoryBlock} disabled={disabled}>
                  <SquareDashedMousePointer className="mr-2 h-4 w-4" />
                  Inserir bloco no slide
                </Button>
                {currentSlide?.regulatory && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <Label>Texto do slide atual</Label>
                      <Textarea
                        value={currentSlide.regulatory.text}
                        onChange={(event) =>
                          setCurrentRegulatory((regulatory) => ({
                            ...(regulatory || {
                              x: 0.04,
                              y: 0.78,
                              width: 0.92,
                              height: 0.16,
                              anchor: "footer-center",
                              visible: true,
                            }),
                            text: event.target.value,
                          }))
                        }
                        rows={4}
                        disabled={disabled}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Tamanho da fonte</Label>
                      <Slider
                        value={[currentSlide.regulatory.fontSize ?? 0.025]}
                        min={0.008}
                        max={0.06}
                        step={0.001}
                        onValueChange={([value]) =>
                          setCurrentRegulatory((regulatory) => (regulatory ? { ...regulatory, fontSize: value } : regulatory))
                        }
                        disabled={disabled}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Cor do texto</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant={(currentSlide.regulatory.color ?? "white") === "white" ? "default" : "outline"}
                          size="sm"
                          onClick={() =>
                            setCurrentRegulatory((regulatory) => (regulatory ? { ...regulatory, color: "white" } : regulatory))
                          }
                          disabled={disabled}
                        >
                          Branco
                        </Button>
                        <Button
                          variant={currentSlide.regulatory.color === "black" ? "default" : "outline"}
                          size="sm"
                          onClick={() =>
                            setCurrentRegulatory((regulatory) => (regulatory ? { ...regulatory, color: "black" } : regulatory))
                          }
                          disabled={disabled}
                        >
                          Preto
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Sentido do texto</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant={(currentSlide.regulatory.orientation ?? "horizontal") === "horizontal" ? "default" : "outline"}
                          size="sm"
                          onClick={() =>
                            setCurrentRegulatory((regulatory) =>
                              regulatory ? { ...regulatory, orientation: "horizontal" } : regulatory,
                            )
                          }
                          disabled={disabled}
                        >
                          Horizontal
                        </Button>
                        <Button
                          variant={currentSlide.regulatory.orientation === "vertical" ? "default" : "outline"}
                          size="sm"
                          onClick={() =>
                            setCurrentRegulatory((regulatory) =>
                              regulatory ? { ...regulatory, orientation: "vertical" } : regulatory,
                            )
                          }
                          disabled={disabled}
                        >
                          Vertical
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Posição rápida</Label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {REGULATORY_POSITION_PRESETS.map((preset) => (
                          <Button
                            key={preset.id}
                            variant={currentSlide.regulatory.anchor === preset.id ? "default" : "outline"}
                            size="sm"
                            className="text-xs"
                            onClick={() => {
                              const pos = getRegulatoryPresetPosition(
                                preset.id,
                                currentSlide.regulatory.width ?? 0.92,
                                currentSlide.regulatory.height ?? 0.16,
                              );
                              setCurrentRegulatory((r) =>
                                r ? { ...r, anchor: preset.id, x: pos.x, y: pos.y } : r,
                              );
                            }}
                            disabled={disabled}
                          >
                            {preset.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                      <div>
                        <p className="text-sm font-medium">Exibir no slide</p>
                        <p className="text-xs text-muted-foreground">Mantém o bloco na arte renderizada</p>
                      </div>
                      <Switch
                        checked={currentSlide.regulatory.visible !== false}
                        onCheckedChange={(checked) =>
                          setCurrentRegulatory((regulatory) => (regulatory ? { ...regulatory, visible: checked } : regulatory))
                        }
                        disabled={disabled}
                      />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Metadados da arte</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Badge variant="outline">Slides: {slides.length}</Badge>
                <Badge variant="outline">Parceiras no slide: {partnerOverlays.length}</Badge>
                <Badge variant="outline">
                  {currentSlide?.regulatory?.text?.trim() ? "Regulatório presente" : "Sem bloco regulatório"}
                </Badge>
              </CardContent>
            </Card>

            {selectedOverlay && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Camada selecionada</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Opacidade</Label>
                    <Slider
                      value={[selectedOverlay.opacity]}
                      min={0.2}
                      max={1}
                      step={0.05}
                      onValueChange={([value]) => setOverlay(selectedOverlay.id, (overlay) => ({ ...overlay, opacity: value }))}
                      disabled={disabled}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Posição rápida</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {POSITION_PRESETS.map((preset) => (
                        <Button
                          key={preset.id}
                          variant={selectedOverlay.anchor === preset.id ? "default" : "outline"}
                          size="sm"
                          onClick={() => applyPreset(selectedOverlay.id, preset.id)}
                          disabled={disabled}
                        >
                          {preset.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </CardContent>
    </Card>

    <Dialog open={expandOpen} onOpenChange={setExpandOpen}>
      <DialogContent className="max-w-[96vw] w-[96vw] max-h-[94vh] h-[94vh] flex flex-col p-0 overflow-hidden gap-0">
        <DialogHeader className="px-5 py-3 border-b border-border shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-sm font-semibold">Posicionar logo e regulatório</DialogTitle>
            <p className="text-xs text-muted-foreground">Arraste para mover · alça inferior direita para redimensionar</p>
          </div>
        </DialogHeader>
        {/* items-center + h-full/w-auto (em vez de w-full) faz a imagem
            caber inteira na área disponível usando a altura do modal como
            referência, não a largura — antes ela sempre ocupava a largura
            máxima e podia ficar mais alta que a tela, exigindo rolagem pra
            ver a imagem inteira. overflow-hidden porque a imagem já cabe por
            construção, não deveria precisar de scroll. */}
        <div className="flex-1 overflow-hidden p-6 bg-muted/20 flex items-center justify-center">
          {renderCanvas(expandedPreviewRef, "h-full w-auto max-w-full max-h-full")}
        </div>
        {onSaveComposition && (
          <div className="shrink-0 border-t px-5 py-3 flex items-center justify-between bg-background gap-3">
            <p className="text-xs text-muted-foreground">O posicionamento é salvo apenas para este post.</p>
            <Button
              size="sm"
              className="gap-2"
              onClick={handleSaveComposition}
              disabled={savingComposition || disabled}
            >
              {savingComposition
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Save className="h-4 w-4" />}
              Salvar posicionamento
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}
