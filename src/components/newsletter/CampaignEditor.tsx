import { useState, useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNewsletterSegments } from "@/hooks/useNewsletterSegments";
import { useNewsletterSubscribers } from "@/hooks/useNewsletter";
import {
  useCreateCampaign,
  useUpdateCampaign,
  useSendCampaign,
  useSendTestEmail,
  NewsletterCampaign,
} from "@/hooks/useNewsletterCampaigns";
import { toast } from "sonner";
import {
  Save, Send, Loader2, ArrowLeft, Info,
  Layout, Newspaper, FileText, Bell, Palette,
  ChevronRight, CheckCircle2, Circle, RotateCcw, Sparkles,
} from "lucide-react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useEmailProfiles } from "@/hooks/useEmailProfiles";
import { cn } from "@/lib/utils";
import { BlockEmailEditor } from "./BlockEmailEditor";
import { AINewsletterAssistant } from "./AINewsletterAssistant";
import { defaultBlocksFor, renderBlocksToHtml, blocksFromHtml, type EmailBlock } from "@/lib/emailBlocks";
import type { EmailGenerationSettings } from "@/lib/emailTemplates";

type TemplateId = "none" | "custom" | "circular-grupo" | "circular-livonius" | "informe";
type Step = "new" | "editor" | "review";

interface TemplateOption {
  id: TemplateId;
  label: string;
  hint: string;
  icon: React.ElementType;
  brands: string[];
  blocks: "blank" | "circular" | "informe";
}

const TEMPLATE_OPTIONS: TemplateOption[] = [
  { id: "none",               label: "Em branco",         hint: "Comece do zero",                icon: Layout,    brands: [],                    blocks: "blank"    },
  { id: "circular-livonius",  label: "Circular Livonius", hint: "Apenas Livonius",               icon: FileText,  brands: ["Livonius"],          blocks: "circular" },
  { id: "circular-grupo",     label: "Circular Grupo",    hint: "Livo + Livonius",               icon: Newspaper, brands: ["Livo", "Livonius"],  blocks: "circular" },
  { id: "informe",            label: "Informe",           hint: "Avisos e comunicados",          icon: Bell,      brands: ["Livonius", "Livo"],  blocks: "informe"  },
  { id: "custom",             label: "Modelo Custom",     hint: "Use seu modelo de branding",    icon: Palette,   brands: [],                    blocks: "blank"    },
];

interface CampaignEditorProps {
  campaign?: NewsletterCampaign | null;
  onBack: () => void;
  onSaved?: () => void;
}

export function CampaignEditor({ campaign, onBack, onSaved }: CampaignEditorProps) {
  const { currentWorkspace } = useWorkspace();
  const { data: emailProfiles = [] } = useEmailProfiles(currentWorkspace?.id);

  const [step, setStep] = useState<Step>(campaign ? "editor" : "new");
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateId>("circular-livonius");
  const [selectedProfileId, setSelectedProfileId] = useState<string>("default");
  const [subject, setSubject] = useState(campaign?.subject || "");
  const [selectedSegments, setSelectedSegments] = useState<string[]>(campaign?.segments || []);
  const [blocks, setBlocks] = useState<EmailBlock[]>(
    (campaign as any)?.content_blocks || defaultBlocksFor("blank"),
  );
  const [legacyHtml, setLegacyHtml] = useState<string | null>(null);
  const [settingsOverrides, setSettingsOverrides] = useState<EmailGenerationSettings>({});
  const [showAiAssistant, setShowAiAssistant] = useState(false);

  // Review extras
  const [sendMode, setSendMode] = useState<"now" | "later">("now");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [testEmail, setTestEmail] = useState("");

  const workspaceId = currentWorkspace?.id;
  const { data: segments = [] } = useNewsletterSegments();
  const { data: subscribers = [] } = useNewsletterSubscribers(
    selectedSegments.length > 0 ? selectedSegments : undefined
  );
  const { data: allSubscribers = [] } = useNewsletterSubscribers();

  const createCampaign = useCreateCampaign();
  const updateCampaign = useUpdateCampaign();
  const sendCampaign = useSendCampaign();
  const sendTestEmail = useSendTestEmail();

  const isSaving = createCampaign.isPending || updateCampaign.isPending;
  const isSending = sendCampaign.isPending;
  const isSendingTest = sendTestEmail.isPending;
  const isEditable = true; // always allow editing and re-sending

  const recipientCount = selectedSegments.length > 0
    ? subscribers.filter(s => s.is_active).length
    : allSubscribers.filter(s => s.is_active).length;

  const resolvedEmailSettings = useMemo(() => {
    const profileSettings = selectedProfileId === "default"
      ? undefined
      : emailProfiles.find(p => p.id === selectedProfileId)?.settings;
    const hasOverrides = Object.keys(settingsOverrides).length > 0;
    if (!hasOverrides) return profileSettings ?? {};
    return { ...(profileSettings ?? {}), ...settingsOverrides } as EmailGenerationSettings;
  }, [selectedProfileId, emailProfiles, settingsOverrides]);

  const blocksHtml = useMemo(
    () => renderBlocksToHtml(blocks, resolvedEmailSettings ?? {}, subject || "NEWSLETTER"),
    [blocks, resolvedEmailSettings, subject],
  );
  const resolvedContent = legacyHtml ?? blocksHtml;
  const contentBlocksPayload = legacyHtml ? null : blocks;

  useEffect(() => {
    if (campaign) {
      setSubject(campaign.subject);
      setSelectedSegments(campaign.segments || []);
      const savedBlocks = (campaign as any)?.content_blocks as EmailBlock[] | null;
      if (savedBlocks?.length) {
        setBlocks(savedBlocks);
        setLegacyHtml(null);
      } else if (campaign.content) {
        setLegacyHtml(campaign.content);
      }
    }
  }, [campaign]);

  const toggleSegment = (name: string) => {
    setSelectedSegments(prev =>
      prev.includes(name) ? prev.filter(s => s !== name) : [...prev, name]
    );
  };

  const goToEditor = () => {
    if (!legacyHtml) {
      // Try to load blocks from the selected email profile (model)
      const profileBlocks = selectedProfileId !== "default"
        ? (emailProfiles.find(p => p.id === selectedProfileId)?.settings as any)?.content_blocks as EmailBlock[] | undefined
        : undefined;
      if (profileBlocks?.length) {
        setBlocks(profileBlocks);
      } else {
        const tpl = TEMPLATE_OPTIONS.find(t => t.id === selectedTemplate);
        setBlocks(defaultBlocksFor(tpl?.blocks ?? "blank"));
      }
    }
    setStep("editor");
  };

  const applyAiSubject = (s: string) => {
    setSubject(s);
    toast.success("Assunto aplicado!");
  };

  const applyAiContent = (text: string) => {
    // O assistente de IA retorna HTML completo — substitui os blocos por um
    // único bloco HTML em vez de injetar/escapar dentro de um bloco de texto.
    setBlocks(blocksFromHtml(text));
    toast.success("Conteúdo aplicado");
  };

  const handleSave = async () => {
    if (!subject.trim()) { toast.error("O assunto é obrigatório"); return; }
    try {
      if (campaign) {
        await updateCampaign.mutateAsync({ id: campaign.id, data: { subject, content: resolvedContent, segments: selectedSegments, content_blocks: contentBlocksPayload } as any });
        toast.success("Campanha atualizada!");
      } else {
        await createCampaign.mutateAsync({ subject, content: resolvedContent, segments: selectedSegments, workspace_id: workspaceId, content_blocks: contentBlocksPayload } as any);
        toast.success("Campanha criada!");
      }
      onSaved?.();
      onBack();
    } catch { toast.error("Erro ao salvar campanha"); }
  };

  const handleSend = async () => {
    if (!subject.trim()) { toast.error("O assunto é obrigatório"); return; }
    if (!resolvedContent.trim()) { toast.error("O conteúdo do email é obrigatório"); return; }
    if (recipientCount === 0) { toast.error("Não há destinatários para esta campanha"); return; }

    let campaignId = campaign?.id;
    try {
      if (!campaignId) {
        const created = await createCampaign.mutateAsync({ subject, content: resolvedContent, segments: selectedSegments, workspace_id: workspaceId });
        campaignId = created.id;
      } else {
        await updateCampaign.mutateAsync({ id: campaignId, data: { subject, content: resolvedContent, segments: selectedSegments } });
      }
      const result = await sendCampaign.mutateAsync({ id: campaignId, subject, content: resolvedContent, segments: selectedSegments });
      const sentCount = typeof result?.sent_count === "number" ? result.sent_count : undefined;
      const failedCount = typeof result?.failed_count === "number" ? result.failed_count : 0;
      const base = sentCount ?? (typeof result?.recipient_count === "number" ? result.recipient_count : recipientCount);
      if (failedCount > 0) {
        toast.success(`Newsletter enviada: ${base} enviados, ${failedCount} falhas.`);
      } else {
        toast.success(`Newsletter enviada para ${base} destinatários!`);
      }
      onSaved?.();
      onBack();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao enviar newsletter");
    }
  };

  const handleSchedule = async () => {
    if (!subject.trim()) { toast.error("O assunto é obrigatório"); return; }
    if (!resolvedContent.trim()) { toast.error("O conteúdo do email é obrigatório"); return; }
    if (!scheduleDate || !scheduleTime) { toast.error("Selecione a data e hora do agendamento"); return; }

    const scheduled_at = new Date(`${scheduleDate}T${scheduleTime}:00`).toISOString();
    let campaignId = campaign?.id;
    try {
      if (!campaignId) {
        const created = await createCampaign.mutateAsync({ subject, content: resolvedContent, segments: selectedSegments, workspace_id: workspaceId });
        campaignId = created.id;
      }
      await updateCampaign.mutateAsync({ id: campaignId, data: { subject, content: resolvedContent, segments: selectedSegments, scheduled_at } });
      toast.success(`Campanha agendada para ${scheduleDate} às ${scheduleTime}!`);
      onSaved?.();
      onBack();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao agendar campanha");
    }
  };

  const checklist = [
    { ok: subject.trim().length > 0,      title: "Assunto definido",    detail: subject.trim() || "Nenhum assunto definido" },
    { ok: resolvedContent.trim().length > 0, title: "Conteúdo preenchido", detail: blocks.length > 0 ? `${blocks.length} bloco(s)` : "Sem conteúdo" },
    { ok: recipientCount > 0,             title: "Destinatários",        detail: `${recipientCount} inscrito(s) ativo(s)` },
    { ok: true,                            title: "Remetente",            detail: selectedProfileId === "default" ? "Padrão do sistema" : (emailProfiles.find(p => p.id === selectedProfileId)?.name ?? "Perfil selecionado") },
  ];
  const allChecksPassed = checklist.every(c => c.ok);

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 1 — NEW CAMPAIGN
  // ══════════════════════════════════════════════════════════════════════════
  if (step === "new") {
    return (
      <div className="flex flex-col" style={{ minHeight: "100%" }}>
        <div className="flex-1 overflow-auto">
          <section className="max-w-[1100px] mx-auto px-6 py-8 grid gap-6 lg:grid-cols-[1fr_300px] items-start">
            <div className="flex flex-col gap-6">
              <div className="flex items-center gap-3">
                <Button variant="outline" size="icon" onClick={onBack} className="shrink-0">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                  <h1 className="text-2xl font-bold">Nova Campanha</h1>
                  <p className="text-sm text-muted-foreground">Escolha o ponto de partida e quem vai receber</p>
                </div>
              </div>

              <div className="rounded-2xl border border-border p-6">
                <h2 className="text-lg font-semibold mb-1">Escolha um modelo</h2>
                <p className="text-sm text-muted-foreground mb-5">Todo modelo abre no editor visual — arraste blocos, edite inline, veja a prévia em tempo real.</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {TEMPLATE_OPTIONS.map(tpl => {
                    const Icon = tpl.icon;
                    const sel = selectedTemplate === tpl.id;
                    return (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => setSelectedTemplate(tpl.id)}
                        className={cn(
                          "flex flex-col gap-2 rounded-xl border p-4 text-left transition-colors",
                          sel ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/40 hover:bg-muted/30"
                        )}
                      >
                        <Icon className={cn("h-5 w-5", sel ? "text-primary" : "text-muted-foreground")} />
                        <span className={cn("text-sm font-semibold", sel && "text-primary")}>{tpl.label}</span>
                        <span className="text-xs text-muted-foreground leading-tight">{tpl.hint}</span>
                        {tpl.brands.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {tpl.brands.map(b => (
                              <Badge key={b} variant="outline" className="text-[10px] px-1 py-0 h-4">{b}</Badge>
                            ))}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-border p-6 flex flex-col gap-4">
                <h2 className="text-lg font-semibold">Assunto</h2>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">Assunto do email</Label>
                  <Input
                    placeholder="Ex: Circular Livonius 2026/07 — nova tabela de comissões"
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    className="text-sm"
                  />
                </div>

                {emailProfiles.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs text-muted-foreground">Modelo de branding</Label>
                    <Select value={selectedProfileId} onValueChange={setSelectedProfileId}>
                      <SelectTrigger className="w-full sm:w-64">
                        <SelectValue placeholder="Selecione um modelo..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">Padrão (valores hardcoded)</SelectItem>
                        {emailProfiles.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-4 lg:sticky lg:top-6">
              <div className="rounded-2xl border border-border p-5 flex flex-col gap-4">
                <div>
                  <h2 className="text-base font-semibold">Destinatários</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">Selecione segmentos ou envie para todos</p>
                </div>
                <div className="rounded-xl bg-primary/5 border border-primary/20 p-4">
                  <p className="text-2xl font-bold text-primary">{recipientCount}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {selectedSegments.length > 0 ? "inscritos nos segmentos" : "todos os inscritos ativos"}
                  </p>
                </div>
                {segments.length > 0 && (
                  <div className="flex flex-col gap-2">
                    {segments.map(seg => (
                      <button
                        key={seg.id}
                        type="button"
                        onClick={() => toggleSegment(seg.name)}
                        className={cn(
                          "flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm transition-colors text-left",
                          selectedSegments.includes(seg.name) ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"
                        )}
                      >
                        <span className={cn("flex h-4 w-4 items-center justify-center rounded border text-[10px]",
                          selectedSegments.includes(seg.name) ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"
                        )}>
                          {selectedSegments.includes(seg.name) && "✓"}
                        </span>
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
                        <span className="flex-1 font-medium">{seg.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <Button size="lg" className="w-full gap-2" onClick={goToEditor} disabled={!subject.trim()}>
                Continuar para o editor
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </section>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 2 — EDITOR
  // ══════════════════════════════════════════════════════════════════════════
  if (step === "editor") {
    return (
      <div className="flex flex-col" style={{ minHeight: "100%", height: "100%" }}>

        {/* Header */}
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background px-5 py-3 flex-wrap">
          <Button variant="outline" size="icon" onClick={() => setStep("new")} className="shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <Input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Assunto do email"
              className="border-0 border-b rounded-none px-0 text-sm font-semibold focus-visible:ring-0 shadow-none h-auto py-0.5 max-w-[380px]"
              disabled={!isEditable}
            />
            <p className="text-xs text-muted-foreground mt-0.5">Rascunho · {campaign ? "editando" : "nova campanha"} · {blocks.length} bloco(s)</p>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            {!legacyHtml && (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowAiAssistant((v) => !v)}>
                <Sparkles className="h-3.5 w-3.5" />
                Assistente IA
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
              Salvar
            </Button>
            <Button size="sm" className="gap-1.5" onClick={() => setStep("review")}>
              Revisar e enviar
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </header>

        {/* Editor body */}
        <div className="flex-1 min-h-0 overflow-auto">
          {showAiAssistant && !legacyHtml && (
            <div className="p-4 border-b border-border max-w-md">
              <AINewsletterAssistant
                campaignType="marketing"
                selectedSegments={selectedSegments}
                currentSubject={subject}
                currentContent={blocksHtml}
                onApplySubject={applyAiSubject}
                onApplyContent={applyAiContent}
              />
            </div>
          )}
          {legacyHtml ? (
            <div className="flex flex-col gap-3 p-6">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Esta campanha foi criada antes do editor de blocos. O conteúdo original está preservado abaixo.
                  Para editar visualmente, recomece no editor de blocos.
                </AlertDescription>
              </Alert>
              <iframe
                title="Conteúdo original"
                srcDoc={legacyHtml}
                sandbox="allow-same-origin"
                className="w-full rounded border bg-white"
                style={{ height: 500 }}
              />
              {isEditable && (
                <Button variant="outline" size="sm" className="gap-2 self-start" onClick={() => { setLegacyHtml(null); setBlocks(defaultBlocksFor("blank")); }}>
                  <RotateCcw className="h-4 w-4" /> Recomeçar no editor de blocos
                </Button>
              )}
            </div>
          ) : (
            <div className={cn("h-full", !isEditable && "pointer-events-none opacity-70")} style={{ minHeight: 560 }}>
              <BlockEmailEditor
                blocks={blocks}
                onChange={setBlocks}
                headerTitle={subject || "NEWSLETTER"}
                disabled={!isEditable}
                settings={resolvedEmailSettings}
                onSettingsChange={isEditable ? setSettingsOverrides : undefined}
              />
            </div>
          )}
        </div>

      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 3 — REVIEW & SEND
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="flex flex-col" style={{ minHeight: "100%" }}>
      <div className="flex-1 overflow-auto">
        <section className="max-w-[1000px] mx-auto px-6 py-8 grid gap-6 lg:grid-cols-[1fr_340px] items-start">

          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-3">
              <Button variant="outline" size="icon" onClick={() => setStep("editor")} className="shrink-0">
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold">Revisar e enviar</h1>
                <p className="text-sm text-muted-foreground truncate max-w-[360px]">{subject}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-border p-6">
              <h2 className="text-base font-semibold mb-4">Checklist de validação</h2>
              <div className="flex flex-col gap-3">
                {checklist.map((item, i) => (
                  <div key={i} className="flex items-start gap-3 text-sm">
                    {item.ok
                      ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                      : <Circle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />}
                    <div>
                      <p className={cn("font-medium", !item.ok && "text-destructive")}>{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border p-6 flex flex-col gap-4">
              <h2 className="text-base font-semibold">Quando enviar</h2>
              <div className="flex gap-2">
                <Button variant={sendMode === "now" ? "default" : "outline"} size="sm" onClick={() => setSendMode("now")}>Enviar agora</Button>
                <Button variant={sendMode === "later" ? "default" : "outline"} size="sm" onClick={() => setSendMode("later")}>Agendar</Button>
              </div>
              {sendMode === "later" && (
                <div className="flex gap-4 flex-wrap">
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs text-muted-foreground">Data</Label>
                    <Input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} className="w-44" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs text-muted-foreground">Hora</Label>
                    <Input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} className="w-36" />
                  </div>
                </div>
              )}
              <div className="flex items-end gap-2 flex-wrap">
                <div className="flex-1 min-w-[200px] flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">Enviar teste para</Label>
                  <Input type="email" placeholder="email@exemplo.com" value={testEmail} onChange={e => setTestEmail(e.target.value)} />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!testEmail.trim() || isSendingTest}
                  onClick={async () => {
                    if (!subject.trim() || !resolvedContent.trim()) {
                      toast.error("Preencha assunto e conteúdo antes de enviar o teste");
                      return;
                    }
                    try {
                      let cid = campaign?.id;
                      if (!cid) {
                        const created = await createCampaign.mutateAsync({ subject, content: resolvedContent, segments: selectedSegments, workspace_id: workspaceId, content_blocks: contentBlocksPayload } as any);
                        cid = created.id;
                      }
                      await sendTestEmail.mutateAsync({ campaign_id: cid, subject, content: resolvedContent, segments: selectedSegments, test_email: testEmail.trim() });
                      toast.success(`Teste enviado para ${testEmail}`);
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Erro ao enviar teste");
                    }
                  }}
                >
                  {isSendingTest ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Enviar teste"}
                </Button>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4 lg:sticky lg:top-6">
            <div className="rounded-2xl border border-border p-5 flex flex-col gap-3">
              <h2 className="text-base font-semibold">Resumo</h2>
              <div className="flex flex-col gap-2 text-sm">
                <div className="flex justify-between gap-3"><span className="text-muted-foreground">Destinatários</span><b>{recipientCount}</b></div>
                <div className="flex justify-between gap-3"><span className="text-muted-foreground">Segmentos</span><b>{selectedSegments.length > 0 ? selectedSegments.join(", ") : "Todos"}</b></div>
                <div className="flex justify-between gap-3"><span className="text-muted-foreground">Blocos</span><b>{blocks.length}</b></div>
                <div className="flex justify-between gap-3"><span className="text-muted-foreground">Envio</span><b>{sendMode === "now" ? "Imediato" : (scheduleDate && scheduleTime ? `${scheduleDate} ${scheduleTime}` : "Agendado")}</b></div>
              </div>
            </div>

            <Button variant="outline" className="w-full" onClick={() => setStep("editor")}>
              Voltar ao editor
            </Button>

            {campaign && campaign.status !== "draft" && (
              <div className="rounded-2xl border border-border p-5 flex flex-col gap-2 text-sm">
                <h2 className="text-base font-semibold">Métricas</h2>
                <div className="flex justify-between"><span className="text-muted-foreground">Destinatários</span><span>{campaign.recipient_count}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Enviados</span><span className="text-emerald-600">{campaign.sent_count}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Falhas</span><span className="text-destructive">{campaign.failed_count}</span></div>
                {campaign.sent_at && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Enviado em</span><span>{new Date(campaign.sent_at).toLocaleString("pt-BR")}</span></div>
                )}
              </div>
            )}

            {isEditable && (
              <Button variant="outline" className="w-full gap-2" onClick={handleSave} disabled={isSaving || isSending}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar Rascunho
              </Button>
            )}

            {isEditable && (
              <Button size="lg" className="w-full gap-2"
                onClick={sendMode === "now" ? handleSend : handleSchedule}
                disabled={isSaving || isSending || (sendMode === "now" && recipientCount === 0) || !allChecksPassed}>
                {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {sendMode === "now" ? "Enviar Agora" : "Agendar Envio"}
              </Button>
            )}

            {!allChecksPassed && (
              <p className="text-xs text-destructive text-center">Resolva os itens do checklist antes de enviar.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
