import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PageTransition } from "@/components/ui/page-transition";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Save, Send, RotateCcw, Wand2, Sparkles, Loader2, Layers, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ChannelSelector } from "@/components/marketing/ChannelSelector";
import { MediaUploader } from "@/components/marketing/MediaUploader";
import { StatusBadge } from "@/components/marketing/StatusBadge";
import { AIAssistantPanel } from "@/components/marketing/AIAssistantPanel";
import { AISuggestionButton } from "@/components/marketing/AISuggestionButton";
import { ABTestEditor } from "@/components/marketing/ABTestEditor";
import { ABTestResults } from "@/components/marketing/ABTestResults";
import { CompanySelector } from "@/components/marketing/CompanySelector";
import { TagsInput } from "@/components/marketing/TagsInput";
import { ImageFeedbackDialog } from "@/components/marketing/ImageFeedbackDialog";
import { BrandCompositionEditor } from "@/components/marketing/BrandCompositionEditor";
import { RejectionReasonsAlert } from "@/components/marketing/RejectionReasonsAlert";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useSocialConnections } from "@/hooks/useSocialConnections";
import { api } from "@/services/api";
import { usePostVariants, useABTestResults, useSaveVariants } from "@/hooks/useABTest";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_MAIN_LOGO_ID, normalizeComposition, renderAndUploadComposition } from "@/lib/brandComposition";
import { toast } from "sonner";
import type { MediaComposition, SocialChannel, SocialPost, PostVariant, PostCompany } from "@/types/marketing";

export default function PostEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentWorkspace, loading: workspaceLoading } = useWorkspace();
  const { connections } = useSocialConnections(currentWorkspace?.id);
  const queryClient = useQueryClient();

  const [post, setPost] = useState<SocialPost | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [baseMediaUrls, setBaseMediaUrls] = useState<string[]>([]);
  const [renderedMediaUrls, setRenderedMediaUrls] = useState<string[]>([]);
  const [mediaComposition, setMediaComposition] = useState<MediaComposition>({ slides: [] });
  const [regulatoryNotes, setRegulatoryNotes] = useState("");
  const [channels, setChannels] = useState<SocialChannel[]>([]);
  const [selectedConnectionIds, setSelectedConnectionIds] = useState<string[]>([]);
  const [blogSelected, setBlogSelected] = useState(false);
  const [company, setCompany] = useState<PostCompany>("livonius");
  const [tags, setTags] = useState<string[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [variants, setVariants] = useState<PostVariant[]>([]);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [generatedBaseImageUrl, setGeneratedBaseImageUrl] = useState<string | null>(null);
  const [showImageFeedback, setShowImageFeedback] = useState(false);
  const [editorUsesRenderedFallback, setEditorUsesRenderedFallback] = useState(false);
  const [openDrawer, setOpenDrawer] = useState<"media" | "brand" | "ai" | null>(null);
  const [previewChannel, setPreviewChannel] = useState<"instagram" | "linkedin" | "facebook" | "blog">("instagram");

  const { data: existingVariants } = usePostVariants(id || "");
  const { data: abTestResults } = useABTestResults(id || "");
  const saveVariants = useSaveVariants();

  const suppressPrimaryOverlayIfFallback = (compositionToAdjust: MediaComposition, shouldSuppress: boolean) => {
    if (!shouldSuppress) return compositionToAdjust;

    return {
      slides: compositionToAdjust.slides.map((slide) => ({
        ...slide,
        overlays: slide.overlays.map((overlay) =>
          overlay.assetId === DEFAULT_MAIN_LOGO_ID
            ? { ...overlay, visible: false }
            : overlay
        ),
      })),
    };
  };

  useEffect(() => {
    const loadPost = async () => {
      if (!id) return;
      
      try {
        const postData = await api.getPost(id);
        if (postData) {
          const hasDedicatedBaseMedia = Boolean(postData.base_media_urls?.length);
          const initialBaseMedia = hasDedicatedBaseMedia
            ? postData.base_media_urls
            : postData.media_urls || [];
          const usesRenderedFallback = !hasDedicatedBaseMedia && (postData.media_urls?.length || 0) > 0;
          const nextComposition = suppressPrimaryOverlayIfFallback(
            normalizeComposition(initialBaseMedia, postData.media_composition, (postData.company as PostCompany) || "livonius"),
            usesRenderedFallback,
          );
          setPost(postData);
          setTitle(postData.title || "");
          setContent(postData.content || "");
          setExcerpt(postData.excerpt || "");
          setBaseMediaUrls(initialBaseMedia);
          setRenderedMediaUrls(postData.rendered_media_urls?.length ? postData.rendered_media_urls : postData.media_urls || []);
          setMediaComposition(nextComposition);
          setRegulatoryNotes(postData.regulatory_notes || "");
          setEditorUsesRenderedFallback(usesRenderedFallback);
          setChannels(postData.channels || []);
          setCompany((postData.company as PostCompany) || "livonius");
          setTags(postData.tags || []);
          setImageUrls(postData.image_urls || []);
          setThumbnailUrl(postData.thumbnail_url || null);
        }
      } catch (error) {
        console.error("Error loading post:", error);
        toast.error("Erro ao carregar post");
      } finally {
        setIsLoading(false);
      }
    };

    loadPost();
  }, [id]);

  // Initialize connection IDs from post channels once connections are loaded
  useEffect(() => {
    if (!post || connections.length === 0) return;
    const ids = connections
      .filter(c => c.is_active && post.channels?.includes(c.provider as SocialChannel))
      .map(c => c.id);
    setSelectedConnectionIds(ids);
    setBlogSelected(post.channels?.includes('blog' as SocialChannel) ?? false);
  }, [post, connections]);

  // Load existing variants when they're fetched
  useEffect(() => {
    if (existingVariants) {
      setVariants(existingVariants);
    }
  }, [existingVariants]);

  const prepareRenderedMedia = async () => {
    if (!id) {
      return {
        finalMediaUrls: [] as string[],
        nextComposition: mediaComposition,
      };
    }

    const normalizedComposition = normalizeComposition(baseMediaUrls, mediaComposition, company);

    if (baseMediaUrls.length === 0) {
      return {
        finalMediaUrls: [] as string[],
        nextComposition: normalizedComposition,
      };
    }

    const uploaded = await renderAndUploadComposition({
      postId: id,
      company,
      composition: normalizedComposition,
    });

    const finalMediaUrls = uploaded.map((item) => item.publicUrl);
    const nextComposition = {
      slides: normalizedComposition.slides.map((slide, index) => ({
        ...slide,
        outputUrl: finalMediaUrls[index] || slide.outputUrl || null,
      })),
    };

    setMediaComposition(nextComposition);
    setRenderedMediaUrls(finalMediaUrls);

    return {
      finalMediaUrls,
      nextComposition,
    };
  };

  const resolveThumbnailForRenderedMedia = (finalMediaUrls: string[]) => {
    if (!thumbnailUrl) return undefined;
    const baseIndex = baseMediaUrls.indexOf(thumbnailUrl);
    if (baseIndex >= 0) {
      return finalMediaUrls[baseIndex] || thumbnailUrl;
    }
    const renderedIndex = renderedMediaUrls.indexOf(thumbnailUrl);
    if (renderedIndex >= 0) {
      return finalMediaUrls[renderedIndex] || thumbnailUrl;
    }
    // Thumbnail órfão: aponta para um render antigo (composed/<postId>/...) que
    // não está mais em base nem em rendered, porque cada render sobe num caminho
    // novo. Reaponta para a arte atual. Só para artes compostas — um thumbnail
    // escolhido manualmente fora desse caminho é preservado.
    if (/\/composed\//.test(thumbnailUrl) && finalMediaUrls.length > 0) {
      return finalMediaUrls[0];
    }
    return thumbnailUrl;
  };

  const handleSaveComposition = async () => {
    if (!id) throw new Error("Post não encontrado");
    // Re-render the images so the new logo/susep position is baked into the PNGs
    const { finalMediaUrls, nextComposition } = await prepareRenderedMedia();
    // thumbnail_url tem prioridade sobre media_urls no PostPreview (aba de
    // aprovação e post aberto). Sem reapontá-lo aqui, essas telas continuavam
    // mostrando a arte anterior enquanto só o editor refletia a nova — o
    // mesmo remapeamento que handleSave já fazia.
    const thumbnailToSave = resolveThumbnailForRenderedMedia(finalMediaUrls);
    const updated = await api.updatePost(id, {
      media_composition: nextComposition,
      regulatory_notes: regulatoryNotes.trim() || null,
      ...(finalMediaUrls.length > 0 && {
        media_urls: finalMediaUrls,
        rendered_media_urls: finalMediaUrls,
        ...(thumbnailToSave && { thumbnail_url: thumbnailToSave }),
      }),
    } as any);
    if (updated) {
      setRenderedMediaUrls(updated.rendered_media_urls || updated.media_urls || finalMediaUrls);
      setMediaComposition(updated.media_composition || nextComposition);
      setThumbnailUrl(updated.thumbnail_url || thumbnailToSave || null);
    }
    queryClient.invalidateQueries({ queryKey: ["posts"] });
  };

  const handleSave = async () => {
    if (!id || !post) {
      toast.error("Post não encontrado");
      return;
    }

    if (!title.trim()) {
      toast.error("Título é obrigatório");
      return;
    }

    // Derive channels from the selected connections + blog toggle so the UI
    // selection (selectedConnectionIds / blogSelected) is what actually gets saved.
    const channelsToSave: SocialChannel[] = [
      ...new Set([
        ...connections
          .filter(c => selectedConnectionIds.includes(c.id))
          .map(c => c.provider as SocialChannel),
        ...(blogSelected ? ['blog' as SocialChannel] : []),
      ]),
    ];

    setSaving(true);
    try {
      const { finalMediaUrls, nextComposition } = await prepareRenderedMedia();
      const thumbnailToSave = resolveThumbnailForRenderedMedia(finalMediaUrls);

      const updated = await api.updatePost(id, {
        title: title.trim(),
        content: content.trim(),
        excerpt: excerpt.trim(),
        media_urls: finalMediaUrls,
        base_media_urls: baseMediaUrls,
        rendered_media_urls: finalMediaUrls,
        media_composition: nextComposition,
        regulatory_notes: regulatoryNotes.trim() || null,
        channels: channelsToSave,
        company,
        tags,
        thumbnail_url: thumbnailToSave,
      });

      // Save A/B test variants
      await saveVariants.mutateAsync({ postId: id, variants });

      // Atualiza o post local para refletir os campos persistidos.
      // Preservamos o status efetivo atual porque updatePost retorna o status
      // bruto do banco (ex: IN_REVIEW_EXTERNAL), mas getPost já calculou o
      // status efetivo (ex: CHANGES_REQUESTED) via histórico de aprovações.
      if (updated) {
        setPost({ ...updated, status: post.status });
        setTitle(updated.title || "");
        setContent(updated.content || "");
        setExcerpt(updated.excerpt || "");
        setBaseMediaUrls(updated.base_media_urls || baseMediaUrls);
        setRenderedMediaUrls(updated.rendered_media_urls || updated.media_urls || []);
        setMediaComposition(updated.media_composition || nextComposition);
        setRegulatoryNotes(updated.regulatory_notes || "");
        setThumbnailUrl(updated.thumbnail_url || null);
        setEditorUsesRenderedFallback(Boolean(updated.media_urls?.length) && !updated.base_media_urls?.length);
        setTags(updated.tags || []);
        setChannels(channelsToSave);
      }
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      toast.success("Alterações salvas!");
    } catch (error: any) {
      console.error("Error updating post:", error);
      toast.error(error?.message || "Erro ao atualizar post");
    } finally {
      setSaving(false);
    }
  };

  const handleSendToReview = async () => {
    if (!id || !post) {
      toast.error("Post não encontrado");
      return;
    }

    if (!title.trim()) {
      toast.error("Título é obrigatório");
      return;
    }

    const channelsToSave: SocialChannel[] = [
      ...new Set([
        ...connections
          .filter(c => selectedConnectionIds.includes(c.id))
          .map(c => c.provider as SocialChannel),
        ...(blogSelected ? ['blog' as SocialChannel] : []),
      ]),
    ];

    setSaving(true);
    try {
      const { finalMediaUrls, nextComposition } = await prepareRenderedMedia();
      const thumbnailToSave = resolveThumbnailForRenderedMedia(finalMediaUrls);

      await api.updatePost(id, {
        title: title.trim(),
        content: content.trim(),
        excerpt: excerpt.trim(),
        media_urls: finalMediaUrls,
        base_media_urls: baseMediaUrls,
        rendered_media_urls: finalMediaUrls,
        media_composition: nextComposition,
        regulatory_notes: regulatoryNotes.trim() || null,
        channels: channelsToSave,
        company,
        tags,
        thumbnail_url: thumbnailToSave,
      });

      await api.sendToApproval(id, "internal");
      toast.success("Post atualizado e enviado para aprovação!");
      navigate("/app/posts");
    } catch (error: any) {
      console.error("Error sending to review:", error);
      toast.error(error?.message || "Erro ao enviar para aprovação");
    } finally {
      setSaving(false);
    }
  };

  const handleRevertToDraft = async () => {
    if (!id) return;
    
    setSaving(true);
    try {
      await api.updatePost(id, { status: "DRAFT" });
      toast.success("Post revertido para rascunho");
      // Reload post data
      const postData = await api.getPost(id);
      if (postData) setPost(postData);
    } catch (error) {
      console.error("Error reverting to draft:", error);
      toast.error("Erro ao reverter para rascunho");
    } finally {
    setSaving(false);
  }
};

const handleGenerateImage = async (feedback?: string) => {
  if (!title.trim()) {
    toast.error("Preencha o título primeiro");
    return;
  }
  
  setGeneratingImage(true);
  try {
    const response = await supabase.functions.invoke("interagir-generate-image-n8n", {
      body: { 
        post_id: id, 
        title, 
        content, 
        company,
        feedback: feedback || undefined,
        previous_attempt: !!feedback
      }
    });
    
    if (response.error) {
      throw new Error(response.error.message);
    }
    
    if (response.data?.image_url) {
      setGeneratedImageUrl(response.data.image_url);
      setGeneratedBaseImageUrl(response.data.base_image_url || response.data.raw_image_url || response.data.image_url);
      setShowImageFeedback(true);
    } else {
      toast.error("Erro: n8n não retornou URL da imagem");
    }
  } catch (error) {
    console.error("Error generating image:", error);
    toast.error("Erro ao gerar imagem");
  } finally {
    setGeneratingImage(false);
  }
};

const handleAcceptImage = () => {
  if (generatedImageUrl) {
    const nextBaseUrl = generatedBaseImageUrl || generatedImageUrl;
    const usesRenderedFallback = !generatedBaseImageUrl || generatedBaseImageUrl === generatedImageUrl;
    setBaseMediaUrls((prev) => [...prev, nextBaseUrl]);
    setEditorUsesRenderedFallback((prev) => prev || usesRenderedFallback);
    if (usesRenderedFallback) {
      toast.info("A imagem foi adicionada, mas esta geração ainda não trouxe a mídia-base sem carimbo.");
    }
    toast.success("Imagem adicionada!");
  }
  setShowImageFeedback(false);
  setGeneratedImageUrl(null);
  setGeneratedBaseImageUrl(null);
};

const handleRegenerateImage = (feedback: string) => {
  handleGenerateImage(feedback);
};

  if (isLoading || workspaceLoading) {
    return (
      <div className="space-y-4 p-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
        </div>
        <Skeleton className="h-64" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <h3 className="text-lg font-semibold text-foreground">Post não encontrado</h3>
        <p className="mt-2 text-muted-foreground">O post solicitado não existe ou foi removido.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/app/posts")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para Lista
        </Button>
      </div>
    );
  }

  const isDraft = post.status === "DRAFT";
  const canSendToReview = isDraft || post.status === "CHANGES_REQUESTED";

  const mainImage = renderedMediaUrls[0] || baseMediaUrls[0] || null;

  // Prefer the live connection data (account names/avatars) over the stale
  // connection_profiles snapshot stored on the post.
  const selectedConnections = connections.filter((c) => selectedConnectionIds.includes(c.id));
  const igConn = selectedConnections.find((c) => c.provider === "instagram")
    ?? connections.find((c) => c.provider === "instagram" && c.is_active);
  const liConn = selectedConnections.find((c) => c.provider === "linkedin")
    ?? connections.find((c) => c.provider === "linkedin" && c.is_active);
  const fbConn = selectedConnections.find((c) => c.provider === "facebook")
    ?? connections.find((c) => c.provider === "facebook" && c.is_active);

  const igName = igConn?.account_username || igConn?.account_name || igConn?.page_name || "seu_perfil";
  const igAvatar = igConn?.profile_picture_url ?? undefined;
  const liName = liConn?.page_name || liConn?.account_name || liConn?.account_username || "Livonius MGA";
  const liAvatar = liConn?.profile_picture_url ?? undefined;
  const fbName = fbConn?.page_name || fbConn?.account_name || fbConn?.account_username || liName;

  const CHANNEL_HINTS: Record<string, string> = {
    instagram: "Formato quadrado 1:1 — legenda com usuário destacado.",
    linkedin: "Card horizontal, tom institucional, legenda completa.",
    facebook: 'Paisagem com selo "Patrocinado" quando impulsionado.',
    blog: "Capa larga + título e resumo, como no artigo publicado.",
  };

  return (
    <PageTransition>
    <div className="flex flex-col" style={{ minHeight: "100%" }}>

      {/* ── Header ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background px-6 py-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/app/posts")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold leading-tight">Editar Post</p>
          <p className="text-xs text-muted-foreground">
            {company === "livonius" ? "Livonius" : "Livo"} · <span className="capitalize">{post.status?.toLowerCase().replace(/_/g, " ")}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Assistente IA drawer */}
          <Sheet open={openDrawer === "ai"} onOpenChange={(o) => setOpenDrawer(o ? "ai" : null)}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Assistente IA
              </Button>
            </SheetTrigger>
            <SheetContent className="w-full sm:w-[520px] overflow-y-auto">
              <SheetHeader className="mb-4">
                <SheetTitle>Assistente IA</SheetTitle>
              </SheetHeader>
              <AIAssistantPanel
                currentContent={content}
                currentChannel={channels[0]}
                onApplyCaption={(caption) => setContent(caption)}
              />
            </SheetContent>
          </Sheet>

          <Button variant="outline" size="sm" onClick={() => navigate(`/app/posts/${id}/review`)}>
            Ver Aprovação
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
            Salvar
          </Button>
        </div>
      </header>

      {/* ── Main content ───────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        <div className="mx-auto w-full max-w-[900px] px-6 py-6 space-y-6">

          <RejectionReasonsAlert postId={post.id} />

          {/* Content fields */}
          <div className="space-y-5">
            {/* Título */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">Título</span>
                <AISuggestionButton type="title" currentContent={content} channel={channels[0]} onApply={(v) => setTitle(v)} />
              </div>
              <Input
                placeholder="Digite o título do post…"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="border-0 border-b rounded-none px-0.5 text-xl font-semibold shadow-none focus-visible:ring-0 focus-visible:border-primary"
              />
            </div>

            {/* Resumo */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">Resumo</span>
                <AISuggestionButton type="excerpt" currentContent={content} onApply={(v) => setExcerpt(v)} />
              </div>
              <Input
                placeholder="Breve descrição do post…"
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                className="border-0 border-b rounded-none px-0.5 text-sm shadow-none focus-visible:ring-0 focus-visible:border-primary"
              />
            </div>

            {/* Legenda */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">Legenda</span>
                <AISuggestionButton type="caption" currentContent={title || excerpt} channel={channels[0]} onApply={(v) => setContent(v)} />
              </div>
              <Textarea
                placeholder="Digite a legenda ou conteúdo completo…"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={5}
              />
            </div>
          </div>

          {/* ── Preview section ─────────────────────────────── */}
          <div>
            {/* Tab bar + action buttons */}
            <div className="flex items-center gap-2 flex-wrap mb-3">
              <div className="flex gap-1 rounded-xl border border-border bg-muted p-1 text-xs">
                {(["instagram", "linkedin", "facebook", "blog"] as const).map((ch) => (
                  <button
                    key={ch}
                    type="button"
                    onClick={() => setPreviewChannel(ch)}
                    className={cn(
                      "rounded-lg px-3 py-1.5 font-medium transition-colors capitalize",
                      previewChannel === ch
                        ? "bg-background shadow-sm font-semibold text-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {ch === "blog" ? "Blog" : ch.charAt(0).toUpperCase() + ch.slice(1)}
                  </button>
                ))}
              </div>

              <div className="ml-auto flex gap-2">
                {/* Mídia drawer */}
                <Sheet open={openDrawer === "media"} onOpenChange={(o) => setOpenDrawer(o ? "media" : null)}>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1.5">
                      <ImageIcon className="h-3.5 w-3.5" />
                      Mídia
                    </Button>
                  </SheetTrigger>
                  <SheetContent className="w-[400px] overflow-y-auto">
                    <SheetHeader className="mb-4">
                      <SheetTitle>Mídia</SheetTitle>
                    </SheetHeader>
                    <div className="space-y-4">
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => handleGenerateImage()}
                        disabled={generatingImage || saving || !title.trim()}
                      >
                        <Wand2 className="mr-2 h-4 w-4" />
                        {generatingImage ? "Gerando…" : "Gerar com AI"}
                      </Button>
                      <MediaUploader
                        value={baseMediaUrls}
                        onChange={setBaseMediaUrls}
                        maxFiles={5}
                        disabled={saving}
                        generatedImages={imageUrls}
                        thumbnailUrl={thumbnailUrl}
                        onThumbnailChange={(url) => setThumbnailUrl(url)}
                        postId={id}
                      />
                    </div>
                  </SheetContent>
                </Sheet>

                {/* Marca & Regulatório drawer */}
                <Sheet open={openDrawer === "brand"} onOpenChange={(o) => setOpenDrawer(o ? "brand" : null)}>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1.5">
                      <Layers className="h-3.5 w-3.5" />
                      Marca &amp; Regulatório
                    </Button>
                  </SheetTrigger>
                  <SheetContent className="w-full sm:w-[640px] overflow-y-auto">
                    <SheetHeader className="mb-4">
                      <SheetTitle>Marca &amp; Regulatório</SheetTitle>
                    </SheetHeader>
                    {currentWorkspace && (
                      <div className="flex flex-col items-center">
                      <BrandCompositionEditor
                        workspaceId={currentWorkspace.id}
                        company={company}
                        baseMediaUrls={baseMediaUrls}
                        composition={mediaComposition}
                        regulatoryNotes={regulatoryNotes}
                        isBaseMediaDerived={editorUsesRenderedFallback}
                        onCompositionChange={setMediaComposition}
                        onRegulatoryNotesChange={setRegulatoryNotes}
                        onSaveComposition={handleSaveComposition}
                        disabled={saving}
                      />
                      </div>
                    )}
                  </SheetContent>
                </Sheet>
              </div>
            </div>

            {/* Channel preview canvas */}
            <div
              className="mx-auto rounded-2xl overflow-hidden bg-card border border-border shadow-md"
              style={{ width: previewChannel === "instagram" ? "320px" : "460px", maxWidth: "100%" }}
            >
              {previewChannel === "instagram" && (
                <>
                  <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
                    {igAvatar
                      ? <img src={igAvatar} alt={igName} className="h-6 w-6 rounded-full object-cover flex-shrink-0" />
                      : <div className="h-6 w-6 rounded-full bg-gradient-to-br from-pink-500 to-purple-500 flex-shrink-0" />}
                    <span className="text-xs font-semibold">{igName}</span>
                  </div>
                  <div className="aspect-square bg-muted flex items-center justify-center">
                    {mainImage
                      ? <img src={mainImage} alt="" className="h-full w-full object-cover" />
                      : <span className="text-xs text-muted-foreground">Mídia do post</span>}
                  </div>
                  <div className="px-3 py-2.5 text-xs leading-relaxed">
                    <span className="font-semibold">{igName}</span>{" "}
                    {content?.slice(0, 100)}{(content?.length ?? 0) > 100 && "…"}
                  </div>
                </>
              )}

              {previewChannel === "linkedin" && (
                <>
                  <div className="flex items-center gap-2.5 px-3 py-3 border-b border-border">
                    {liAvatar
                      ? <img src={liAvatar} alt={liName} className="h-9 w-9 rounded-full object-cover flex-shrink-0" />
                      : <div className="h-9 w-9 rounded-full bg-sky-500 flex-shrink-0" />}
                    <div>
                      <p className="text-xs font-semibold leading-tight">{liName}</p>
                      <p className="text-[10px] text-muted-foreground">1º grau · agora</p>
                    </div>
                  </div>
                  <div className="px-3 py-2.5 text-xs leading-relaxed line-clamp-4">{content}</div>
                  {mainImage && (
                    <div className="aspect-[1.91/1] bg-muted">
                      <img src={mainImage} alt="" className="h-full w-full object-cover" />
                    </div>
                  )}
                  {!mainImage && <div className="aspect-[1.91/1] bg-muted flex items-center justify-center text-xs text-muted-foreground">Mídia do post</div>}
                </>
              )}

              {previewChannel === "facebook" && (
                <>
                  <div className="flex items-center gap-2.5 px-3 py-3 border-b border-border">
                    {fbConn?.profile_picture_url
                      ? <img src={fbConn.profile_picture_url} alt={fbName} className="h-9 w-9 rounded-full object-cover flex-shrink-0" />
                      : <div className="h-9 w-9 rounded-full bg-[#3b5998] flex-shrink-0 flex items-center justify-center text-white text-xs font-bold">f</div>}
                    <div>
                      <p className="text-xs font-semibold leading-tight">{fbName}</p>
                      <p className="text-[10px] text-muted-foreground">Patrocinado · 🌐</p>
                    </div>
                  </div>
                  <div className="px-3 py-2.5 text-xs leading-relaxed line-clamp-4">{content}</div>
                  {mainImage
                    ? <div className="aspect-[1.91/1] bg-muted"><img src={mainImage} alt="" className="h-full w-full object-cover" /></div>
                    : <div className="aspect-[1.91/1] bg-muted flex items-center justify-center text-xs text-muted-foreground">Mídia do post</div>}
                </>
              )}

              {previewChannel === "blog" && (
                <>
                  {mainImage
                    ? <div className="aspect-[1.91/1] bg-muted"><img src={mainImage} alt="" className="h-full w-full object-cover" /></div>
                    : <div className="aspect-[1.91/1] bg-muted flex items-center justify-center text-xs text-muted-foreground">Mídia do post</div>}
                  <div className="px-4 py-4">
                    <p className="text-sm font-bold leading-tight mb-1.5 line-clamp-2">{title || "Título do post"}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{excerpt || content?.slice(0, 120)}</p>
                  </div>
                </>
              )}
            </div>

            <p className="text-xs text-muted-foreground mt-2 text-center">
              {CHANNEL_HINTS[previewChannel]}
            </p>
          </div>

          {/* ── Canais | Tags + restante ────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-6 pt-5 border-t border-border items-start">
            {/* Coluna esquerda — Canais */}
            <div className="flex flex-col gap-2">
              <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">Canais</p>
              <ChannelSelector
                connections={connections}
                selectedConnectionIds={selectedConnectionIds}
                onConnectionsChange={setSelectedConnectionIds}
                blogSelected={blogSelected}
                onBlogToggle={setBlogSelected}
                includeBlog={true}
              />
            </div>

            {/* Coluna direita — Tags + Empresa/Status + A/B + Ações */}
            <div className="flex flex-col gap-5 min-w-0">
              <div className="flex flex-col gap-2">
                <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">Tags</p>
                <TagsInput value={tags} onChange={setTags} placeholder="Adicionar tag…" disabled={saving} />
              </div>

              <div className="flex flex-wrap items-start gap-6">
                <div className="flex flex-col gap-2">
                  <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">Empresa</p>
                  <CompanySelector value={company} onChange={setCompany} disabled={saving} />
                </div>
                <div className="flex flex-col gap-2">
                  <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">Status</p>
                  <StatusBadge status={post.status} />
                </div>
              </div>

              <ABTestEditor
                variants={variants}
                onVariantsChange={setVariants}
                baseContent={content}
                channel={channels[0]}
                disabled={saving}
              />
              {post.status === "PUBLISHED" && variants.length > 0 && abTestResults && (
                <ABTestResults variants={variants} results={abTestResults} />
              )}

              <div className="flex items-center gap-3 pt-2 border-t border-border">
                <Button variant="outline" onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
                  Salvar Alterações
                </Button>
                {canSendToReview && (
                  <Button onClick={handleSendToReview} disabled={saving}>
                    <Send className="mr-1.5 h-4 w-4" />
                    Enviar para Aprovação
                  </Button>
                )}
                {!isDraft && (
                  <Button variant="secondary" onClick={handleRevertToDraft} disabled={saving}>
                    <RotateCcw className="mr-1.5 h-4 w-4" />
                    Voltar para Rascunho
                  </Button>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>

      <ImageFeedbackDialog
        open={showImageFeedback}
        onOpenChange={setShowImageFeedback}
        imageUrl={generatedImageUrl || ""}
        onAccept={handleAcceptImage}
        onRegenerate={handleRegenerateImage}
        isRegenerating={generatingImage}
      />
    </div>
    </PageTransition>
  );
}
