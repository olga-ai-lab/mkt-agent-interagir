import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  ChevronDown,
  ChevronUp,
  Edit2,
  Save,
  Loader2,
  Zap,
  ExternalLink,
  History,
  Sparkles,
  Building2,
  Sun,
} from 'lucide-react';
import { AgentPrompt, AgentCompany, AGENT_LABELS, useAgentPrompts, useUpdateAgentPrompt, useSeedAgentPrompts } from '@/hooks/useAgentPrompts';
import { usePromptAdjustments } from '@/hooks/useAIInsights';
import { PromptVersionHistory } from './PromptVersionHistory';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { SUPABASE_URL } from '@/integrations/supabase/client';

interface PromptsPanelProps {
  workspaceId: string;
}

const COMPANY_CONFIG: Record<AgentCompany, { label: string; icon: React.ReactNode; description: string }> = {
  livonius: {
    label: 'Livonius',
    icon: <Building2 className="h-4 w-4" />,
    description: 'Seguros empresariais e riscos complexos',
  },
  livo: {
    label: 'Livo',
    icon: <Sun className="h-4 w-4" />,
    description: 'Energia solar e sustentabilidade',
  },
};

export function PromptsPanel({ workspaceId }: PromptsPanelProps) {
  const { data: prompts, isLoading } = useAgentPrompts(workspaceId);
  const { data: adjustments } = usePromptAdjustments(workspaceId);
  const updatePrompt = useUpdateAgentPrompt();
  const seedPrompts = useSeedAgentPrompts();
  
  const [selectedCompany, setSelectedCompany] = useState<AgentCompany>('livonius');
  const [expandedAgents, setExpandedAgents] = useState<string[]>([]);
  const [editingPrompt, setEditingPrompt] = useState<AgentPrompt | null>(null);
  const [editContent, setEditContent] = useState('');
  const [historyPrompt, setHistoryPrompt] = useState<AgentPrompt | null>(null);

  const toggleExpanded = (agentType: string) => {
    setExpandedAgents(prev =>
      prev.includes(agentType)
        ? prev.filter(a => a !== agentType)
        : [...prev, agentType]
    );
  };

  const handleEdit = (prompt: AgentPrompt) => {
    setEditingPrompt(prompt);
    setEditContent(prompt.system_prompt);
  };

  const handleOpenHistory = (prompt: AgentPrompt) => {
    setHistoryPrompt(prompt);
  };

  const handleSave = async () => {
    if (!editingPrompt) return;

    try {
      await updatePrompt.mutateAsync({
        id: editingPrompt.id,
        system_prompt: editContent,
      });
      toast.success('Prompt atualizado com sucesso!');
      setEditingPrompt(null);
    } catch (error) {
      toast.error('Erro ao salvar prompt');
    }
  };

  const handleToggleActive = async (prompt: AgentPrompt) => {
    try {
      await updatePrompt.mutateAsync({
        id: prompt.id,
        is_active: !prompt.is_active,
      });
      toast.success(prompt.is_active ? 'Agente desativado' : 'Agente ativado');
    } catch (error) {
      toast.error('Erro ao atualizar status');
    }
  };

  const handleSeedPrompts = async () => {
    try {
      await seedPrompts.mutateAsync(workspaceId);
      toast.success('Prompts dos agentes criados com sucesso!');
    } catch (error) {
      toast.error('Erro ao criar prompts iniciais');
      console.error('Error seeding prompts:', error);
    }
  };

  // Count injected rules per agent type
  const getInjectedRulesCount = (agentType: string) => {
    if (!adjustments) return 0;
    
    if (agentType === 'redator' || agentType === 'revisor') {
      return (adjustments.caption_avoid_list?.length || 0) + 
             (adjustments.caption_prefer_list?.length || 0);
    }
    if (agentType === 'designer') {
      return (adjustments.image_avoid_list?.length || 0) + 
             (adjustments.image_prefer_list?.length || 0);
    }
    return 0;
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-1/3" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!prompts || prompts.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center">
          <Sparkles className="h-12 w-12 mx-auto text-primary/50 mb-4" />
          <h3 className="text-lg font-medium mb-2">Configure os prompts dos agentes</h3>
          <p className="text-sm text-muted-foreground mb-6">
            Inicialize os 8 agentes de IA (4 para cada marca) com prompts otimizados.
          </p>
          <Button onClick={handleSeedPrompts} disabled={seedPrompts.isPending}>
            {seedPrompts.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            Inicializar Prompts (Livonius + Livo)
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Filter prompts by selected company
  const filteredPrompts = prompts.filter((p) => (p.company || 'livonius') === selectedCompany);

  return (
    <>
      <div className="space-y-4">
        {/* Company Tabs */}
        <Tabs value={selectedCompany} onValueChange={(v) => setSelectedCompany(v as AgentCompany)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="livonius" className="gap-2">
              <Building2 className="h-4 w-4" />
              Livonius
            </TabsTrigger>
            <TabsTrigger value="livo" className="gap-2">
              <Sun className="h-4 w-4" />
              Livo
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Info banner */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="py-3 px-4">
            <div className="flex items-start gap-3">
              <Zap className="h-5 w-5 text-primary mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium">
                  Prompts: {COMPANY_CONFIG[selectedCompany].label}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {COMPANY_CONFIG[selectedCompany].description}. 
                  As regras de "evite/prefira" são injetadas automaticamente com base nas rejeições.
                </p>
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                className="shrink-0"
                onClick={() => {
                  const url = `${SUPABASE_URL}/functions/v1/mkt-get-prompt-adjustments?workspace_id=${workspaceId}`;
                  window.open(url, '_blank');
                }}
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                Ver API
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Agent prompt cards */}
        {filteredPrompts.map((prompt) => {
          const agentInfo = AGENT_LABELS[prompt.agent_type];
          const isExpanded = expandedAgents.includes(prompt.id);
          const injectedCount = getInjectedRulesCount(prompt.agent_type);
          
          return (
            <Card key={prompt.id} className={!prompt.is_active ? 'opacity-60' : ''}>
              <Collapsible open={isExpanded} onOpenChange={() => toggleExpanded(prompt.id)}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">{agentInfo.icon}</div>
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          {agentInfo.label}
                          {!prompt.is_active && (
                            <Badge variant="secondary" className="text-xs">
                              Inativo
                            </Badge>
                          )}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {agentInfo.description}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {injectedCount > 0 && (
                        <Badge variant="outline" className="text-xs bg-primary/10 border-primary/30">
                          <Zap className="h-3 w-3 mr-1" />
                          +{injectedCount} regras
                        </Badge>
                      )}
                      
                      <Switch
                        checked={prompt.is_active}
                        onCheckedChange={() => handleToggleActive(prompt)}
                      />

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenHistory(prompt)}
                        title="Ver histórico de versões"
                      >
                        <History className="h-4 w-4" />
                      </Button>
                      
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(prompt)}
                        title="Editar prompt"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="icon">
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                    </div>
                  </div>
                </CardHeader>
                
                <CollapsibleContent>
                  <CardContent className="pt-2">
                    <div className="bg-muted/50 rounded-lg p-4">
                      <pre className="text-xs whitespace-pre-wrap font-mono text-muted-foreground">
                        {prompt.system_prompt.slice(0, 500)}
                        {prompt.system_prompt.length > 500 && '...'}
                      </pre>
                    </div>
                    
                    <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                      <span>
                        Atualizado em {format(new Date(prompt.updated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </span>
                      {prompt.auto_updated_at && (
                        <Badge variant="secondary" className="text-xs">
                          Auto-atualizado
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          );
        })}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingPrompt} onOpenChange={() => setEditingPrompt(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingPrompt && AGENT_LABELS[editingPrompt.agent_type]?.icon}
              Editar Prompt - {editingPrompt && AGENT_LABELS[editingPrompt.agent_type]?.label}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              placeholder="Digite o prompt do agente..."
              className="min-h-[400px] font-mono text-sm"
            />
            
            <p className="text-xs text-muted-foreground">
              💡 Dica: As regras de "evite/prefira" são adicionadas automaticamente ao final do prompt 
              quando o n8n busca via API, com base nas análises de rejeições.
            </p>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPrompt(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={updatePrompt.isPending}>
              {updatePrompt.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-1" />
              )}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Version History Dialog */}
      {historyPrompt && (
        <PromptVersionHistory
          promptId={historyPrompt.id}
          agentType={historyPrompt.agent_type}
          agentLabel={AGENT_LABELS[historyPrompt.agent_type]?.label || historyPrompt.agent_type}
          open={!!historyPrompt}
          onOpenChange={(open) => !open && setHistoryPrompt(null)}
        />
      )}
    </>
  );
}
