import { useState } from "react";
import { FileText, Settings } from "lucide-react";
import { usePautas } from "@/hooks/usePautas";
import { useAutomationSchedules } from "@/hooks/useAutomationSchedules";
import { PautasList } from "@/components/marketing/agenda-editorial/PautasList";
import { NovaPautaModal } from "@/components/marketing/agenda-editorial/NovaPautaModal";
import { PautaDetailModal } from "@/components/marketing/agenda-editorial/PautaDetailModal";
import { AutomacaoTab } from "@/components/marketing/agenda-editorial/AutomacaoTab";
import { ImportExportButtons } from "@/components/marketing/agenda-editorial/ImportExportButtons";
import { useToast } from "@/hooks/use-toast";
import type { Pauta } from "@/hooks/usePautas";

export default function AgendaEditorial() {
  const [activeTab, setActiveTab] = useState<"pautas" | "automacao">("pautas");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPauta, setSelectedPauta] = useState<Pauta | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [generatingPautaId, setGeneratingPautaId] = useState<number | null>(null);
  const { toast } = useToast();

  const { pautas, loading: pautasLoading, createPauta, updatePauta, deletePauta, importPautas, triggerPautaGeneration } = usePautas();
  const { schedules, loading: schedulesLoading, updateSchedule } = useAutomationSchedules();

  const handleCreatePauta = async (form: { titulo: string; briefing: string; link_referencia?: string; observacoes?: string; data_prevista?: string; plataforma?: string; marca?: "livo" | "livonius" }) => {
    try {
      await createPauta(form);
      toast({ title: "Pauta criada", description: "A pauta foi adicionada com sucesso." });
    } catch {
      toast({ title: "Erro", description: "Não foi possível criar a pauta.", variant: "destructive" });
      throw new Error();
    }
  };

  const handleUpdatePauta = async (form: { id: number; titulo: string; briefing: string; link_referencia?: string; observacoes?: string; data_prevista?: string; plataforma?: string; marca?: "livo" | "livonius" }) => {
    try {
      await updatePauta(form);
      toast({ title: "Pauta atualizada", description: "As alterações foram salvas." });
    } catch {
      toast({ title: "Erro", description: "Não foi possível salvar.", variant: "destructive" });
      throw new Error();
    }
  };

  const handleDeletePauta = async (pauta: Pauta) => {
    try {
      await deletePauta(pauta.id);
      toast({ title: "Excluída", description: "Pauta removida com sucesso." });
    } catch {
      toast({ title: "Erro", description: "Não foi possível excluir.", variant: "destructive" });
    }
  };

  const handleToggleSchedule = async (workflowName: string, isActive: boolean) => {
    await updateSchedule(workflowName, { is_active: isActive });
  };

  const handleUpdateInterval = async (workflowName: string, value: number, unit: string) => {
    await updateSchedule(workflowName, { interval_value: value, interval_unit: unit });
  };

  const handleGeneratePauta = async (pauta: Pauta) => {
    setGeneratingPautaId(pauta.id);
    try {
      await triggerPautaGeneration(pauta.id);
      toast({ title: "Geração iniciada", description: `A pauta "${pauta.titulo}" foi enviada para geração.` });
    } catch (error) {
      const description = error instanceof Error ? error.message : "Não foi possível disparar a geração da pauta.";
      toast({ title: "Erro ao gerar pauta", description, variant: "destructive" });
    } finally {
      setGeneratingPautaId(null);
    }
  };

  const tabs = [
    { key: "pautas" as const, label: "Pautas", icon: FileText },
    { key: "automacao" as const, label: "Automação", icon: Settings },
  ];

  return (
    <div className="space-y-0">
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-foreground font-display">Agenda Editorial</h1>
        <p className="text-muted-foreground mt-1">Gerencie pautas e automações de conteúdo</p>
      </div>

      <div className="border-b border-border mb-4">
        <div className="flex items-center justify-between">
          <div className="flex gap-6">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 py-3 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.key
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
          {activeTab === "pautas" && (
            <div className="flex gap-2">
              <ImportExportButtons pautas={pautas} onImport={importPautas} />
            </div>
          )}
        </div>
      </div>

      {activeTab === "pautas" && (
        <PautasList
          pautas={pautas}
          loading={pautasLoading}
          onCreateClick={() => setModalOpen(true)}
          onPautaClick={(pauta) => {
            setSelectedPauta(pauta);
            setDetailModalOpen(true);
          }}
          onDeleteClick={handleDeletePauta}
          onGenerateClick={handleGeneratePauta}
          generatingPautaId={generatingPautaId}
        />
      )}

      {activeTab === "automacao" && (
        <AutomacaoTab
          schedules={schedules}
          loading={schedulesLoading}
          onToggle={handleToggleSchedule}
          onUpdateInterval={handleUpdateInterval}
        />
      )}

      <NovaPautaModal isOpen={modalOpen} onClose={() => setModalOpen(false)} onSave={handleCreatePauta} />
      <PautaDetailModal
        pauta={selectedPauta}
        isOpen={detailModalOpen}
        onClose={() => { setDetailModalOpen(false); setSelectedPauta(null); }}
        onSave={handleUpdatePauta}
        onGenerateClick={handleGeneratePauta}
        generating={selectedPauta ? generatingPautaId === selectedPauta.id : false}
      />
    </div>
  );
}
