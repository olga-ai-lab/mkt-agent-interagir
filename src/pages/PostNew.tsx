import { useState } from "react";
import { PageTransition } from "@/components/ui/page-transition";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Save, Send, BookOpen, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ChannelSelector } from "@/components/marketing/ChannelSelector";
import { MediaUploader } from "@/components/marketing/MediaUploader";
import { AIAssistantPanel } from "@/components/marketing/AIAssistantPanel";
import { AISuggestionButton } from "@/components/marketing/AISuggestionButton";
import { ABTestEditor } from "@/components/marketing/ABTestEditor";
import { TemplateSelector } from "@/components/marketing/TemplateSelector";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useSocialConnections } from "@/hooks/useSocialConnections";
import { useTrendPlaybook } from "@/hooks/useAIInsights";
import { api } from "@/services/api";
import { useSaveVariants } from "@/hooks/useABTest";
import { toast } from "sonner";
import { CompanySelector } from "@/components/marketing/CompanySelector";
import { FileToPostUploader } from "@/components/marketing/FileToPostUploader";
import type { SocialChannel, PostVariant, PostTemplate, PostCompany } from "@/types/marketing";

export default function PostNew() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fromPlaybook = searchParams.get('from_playbook') === 'true';
  
  const { currentWorkspace, loading: workspaceLoading } = useWorkspace();
  const { connections } = useSocialConnections(currentWorkspace?.id);
  const [saving, setSaving] = useState(false);
  const saveVariants = useSaveVariants();
  
  // Fetch playbook when in playbook mode
  const { data: playbook } = useTrendPlaybook(currentWorkspace?.id);
  
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [channels, setChannels] = useState<SocialChannel[]>([]);
  const [selectedConnectionIds, setSelectedConnectionIds] = useState<string[]>([]);
  const [variants, setVariants] = useState<PostVariant[]>([]);
  const [company, setCompany] = useState<PostCompany>("livonius");

  const handleApplyTemplate = (template: PostTemplate) => {
    setTitle(template.name);
    setContent(template.content || "");
    setExcerpt(template.excerpt || "");
    setChannels(template.channels);
    setMediaUrls(template.media_urls || []);
    toast.success("Template aplicado!");
  };

  const handleSave = async (sendToReview: boolean = false) => {
    if (!currentWorkspace) {
      toast.error("Nenhum workspace selecionado");
      return;
    }

    if (!title.trim()) {
      toast.error("Título é obrigatório");
      return;
    }

    setSaving(true);
    try {
      const post = await api.createPost({
        workspace_id: currentWorkspace.id,
        title: title.trim(),
        content: content.trim(),
        excerpt: excerpt.trim(),
        media_urls: mediaUrls,
        channels,
        company,
        connection_ids: selectedConnectionIds,
      });

      // Save A/B test variants if any
      if (variants.length > 0) {
        await saveVariants.mutateAsync({ postId: post.id, variants });
      }

      if (sendToReview) {
        await api.sendToApproval(post.id, "internal");
        toast.success("Post criado e enviado para aprovação!");
      } else {
        toast.success("Post salvo como rascunho!");
      }

      navigate("/app/posts");
    } catch (error) {
      console.error("Error creating post:", error);
      toast.error("Erro ao criar post");
    } finally {
      setSaving(false);
    }
  };

  if (workspaceLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!currentWorkspace) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <h3 className="text-lg font-semibold text-foreground">
          Nenhum workspace disponível
        </h3>
        <p className="mt-2 text-muted-foreground">
          Não foi possível carregar o workspace.
        </p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/app/posts")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
      </div>
    );
  }

  return (
    <PageTransition>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/app/posts")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Novo Post</h1>
            <p className="text-muted-foreground">
              Crie um novo post para suas redes sociais
            </p>
          </div>
        </div>
        {currentWorkspace && (
          <TemplateSelector
            workspaceId={currentWorkspace.id}
            onSelectTemplate={handleApplyTemplate}
          />
        )}
      </div>

      {/* Playbook Mode Banner */}
      {fromPlaybook && playbook && (
        <Alert className="border-primary/50 bg-primary/5">
          <BookOpen className="h-4 w-4" />
          <AlertTitle className="flex items-center gap-2">
            Modo Playbook Ativo
          </AlertTitle>
          <AlertDescription className="space-y-2">
            <p className="text-sm text-muted-foreground">
              O AI Assistant está configurado com sua direção estratégica.
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              {playbook.do_list?.slice(0, 3).map((item, i) => (
                <Badge key={`do-${i}`} variant="outline" className="text-green-600 border-green-200 bg-green-50 dark:bg-green-950/30">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  {item}
                </Badge>
              ))}
              {playbook.dont_list?.slice(0, 3).map((item, i) => (
                <Badge key={`dont-${i}`} variant="outline" className="text-red-600 border-red-200 bg-red-50 dark:bg-red-950/30">
                  <XCircle className="h-3 w-3 mr-1" />
                  {item}
                </Badge>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Form */}
        <div className="lg:col-span-2 space-y-6">
          <FileToPostUploader
            onProcessingStarted={() => navigate("/app/posts")}
          />
          <Card>
            <CardHeader>
              <CardTitle>Conteúdo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="title">Título *</Label>
                  <AISuggestionButton
                    type="title"
                    currentContent={content}
                    channel={channels[0]}
                    onApply={(suggestion) => setTitle(suggestion)}
                  />
                </div>
                <Input
                  id="title"
                  placeholder="Digite o título do post..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="excerpt">Resumo</Label>
                  <AISuggestionButton
                    type="excerpt"
                    currentContent={content}
                    onApply={(suggestion) => setExcerpt(suggestion)}
                  />
                </div>
                <Input
                  id="excerpt"
                  placeholder="Breve descrição do post..."
                  value={excerpt}
                  onChange={(e) => setExcerpt(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="content">Legenda / Conteúdo</Label>
                  <AISuggestionButton
                    type="caption"
                    currentContent={title || excerpt}
                    channel={channels[0]}
                    onApply={(suggestion) => setContent(prev => prev ? `${prev}\n\n${suggestion}` : suggestion)}
                  />
                </div>
                <Textarea
                  id="content"
                  placeholder="Digite a legenda ou conteúdo completo..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={6}
                />
              </div>
            </CardContent>
          </Card>

          {/* Media Upload Card */}
          <Card>
            <CardHeader>
              <CardTitle>Mídia</CardTitle>
            </CardHeader>
            <CardContent>
              <MediaUploader
                value={mediaUrls}
                onChange={setMediaUrls}
                maxFiles={5}
                disabled={saving}
              />
            </CardContent>
          </Card>

          {/* A/B Test Editor */}
          <ABTestEditor
            variants={variants}
            onVariantsChange={setVariants}
            baseContent={content}
            channel={channels[0]}
            disabled={saving}
          />

          {/* AI Assistant */}
          <AIAssistantPanel
            currentContent={content}
            currentChannel={channels[0]}
            onApplyCaption={(caption) => setContent(caption)}
            playbookMode={fromPlaybook}
            playbook={playbook ? {
              prompt_master: playbook.prompt_master || undefined,
              do_list: playbook.do_list || [],
              dont_list: playbook.dont_list || [],
            } : undefined}
          />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Empresa</CardTitle>
            </CardHeader>
            <CardContent>
              <CompanySelector
                value={company}
                onChange={setCompany}
                disabled={saving}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Canais</CardTitle>
            </CardHeader>
            <CardContent>
              <ChannelSelector
                connections={connections}
                selectedConnectionIds={selectedConnectionIds}
                onConnectionsChange={setSelectedConnectionIds}
                includeBlog={false}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => handleSave(false)}
                disabled={saving}
              >
                <Save className="mr-2 h-4 w-4" />
                Salvar Rascunho
              </Button>
              <Button
                className="w-full"
                onClick={() => handleSave(true)}
                disabled={saving}
              >
                <Send className="mr-2 h-4 w-4" />
                Enviar para Aprovação
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
    </PageTransition>
  );
}
