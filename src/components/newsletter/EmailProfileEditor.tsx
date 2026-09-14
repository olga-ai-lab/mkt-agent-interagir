import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ArrowLeft, Save, Loader2, Sparkles } from "lucide-react";
import { EmailGenerationSettings } from "@/lib/emailTemplates";
import type { EmailProfile } from "@/hooks/useEmailProfiles";
import { BlockEmailEditor } from "./BlockEmailEditor";
import { AINewsletterAssistant } from "./AINewsletterAssistant";
import { defaultBlocksFor, blocksFromHtml, type EmailBlock } from "@/lib/emailBlocks";

const EMPTY_SETTINGS: EmailGenerationSettings = {
  logo_livonius_url: "",
  logo_livo_url: "",
  header_photo_url: "",
  primary_color: "#1a6b5a",
  company_name: "",
  address: "",
  phone: "",
  site_url: "",
  instagram_url: "",
  facebook_url: "",
  linkedin_url: "",
  header_title: "CIRCULARES",
  show_livo: true,
  gradient_color: "#1a6b5a",
  show_site: true,
  sender_name: "",
  greeting: "Prezado Parceiro, saudações:",
  closing: "Atenciosamente,",
};

interface EmailProfileEditorProps {
  profile?: EmailProfile | null;
  workspaceId: string;
  isSaving: boolean;
  onBack: () => void;
  onSave: (name: string, settings: EmailGenerationSettings) => void;
}

export function EmailProfileEditor({
  profile,
  isSaving,
  onBack,
  onSave,
}: EmailProfileEditorProps) {
  const [name, setName] = useState(profile?.name ?? "");
  const [settings, setSettings] = useState<EmailGenerationSettings>(
    profile?.settings ?? EMPTY_SETTINGS
  );
  const [blocks, setBlocks] = useState<EmailBlock[]>(
    () => (profile?.settings as any)?.content_blocks || defaultBlocksFor("circular")
  );

  const [aiOpen, setAiOpen] = useState(false);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave(name.trim(), { ...settings, content_blocks: blocks } as any);
  };

  const applyAiContent = (html: string) => {
    setBlocks(blocksFromHtml(html));
  };

  return (
    <div className="flex flex-col" style={{ height: "100%" }}>
      {/* Header */}
      <header className="flex items-center gap-3 border-b px-5 py-3 shrink-0 flex-wrap">
        <Button variant="outline" size="icon" onClick={onBack} className="shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome do modelo (ex: Circular Livonius)"
          className="flex-1 max-w-sm text-sm font-semibold border-0 border-b rounded-none px-0 focus-visible:ring-0 shadow-none h-auto py-0.5"
        />
        <p className="text-xs text-muted-foreground hidden sm:block">
          {profile ? "Editando modelo" : "Novo modelo"} · edite os blocos e configure o branding no painel direito
        </p>
        <Sheet open={aiOpen} onOpenChange={setAiOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="ml-auto gap-2 shrink-0">
              <Sparkles className="h-4 w-4" />
              Assistente IA
            </Button>
          </SheetTrigger>
          <SheetContent className="w-full sm:max-w-md overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Assistente IA</SheetTitle>
            </SheetHeader>
            <div className="mt-4">
              <AINewsletterAssistant
                campaignType="marketing"
                selectedSegments={[]}
                currentSubject={name}
                currentContent=""
                onApplySubject={() => {}}
                onApplyContent={(html) => { applyAiContent(html); setAiOpen(false); }}
              />
            </div>
          </SheetContent>
        </Sheet>
        <Button
          onClick={handleSave}
          disabled={isSaving || !name.trim()}
          size="sm"
          className="gap-2 shrink-0"
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {profile ? "Salvar" : "Criar Modelo"}
        </Button>
      </header>

      {/* Editor (full height) */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <BlockEmailEditor
          blocks={blocks}
          onChange={setBlocks}
          headerTitle={settings.header_title || "CIRCULARES"}
          settings={settings}
          onSettingsChange={setSettings}
        />
      </div>
    </div>
  );
}
