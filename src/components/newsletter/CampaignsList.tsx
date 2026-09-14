import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  useNewsletterCampaigns, 
  useDeleteCampaign,
  NewsletterCampaign 
} from "@/hooks/useNewsletterCampaigns";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { 
  Plus, 
  MoreHorizontal, 
  Pencil, 
  Trash2, 
  Copy, 
  Mail,
  Loader2,
  Send,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle
} from "lucide-react";
import { useCreateCampaign } from "@/hooks/useNewsletterCampaigns";
import { useWorkspace } from "@/contexts/WorkspaceContext";

interface CampaignsListProps {
  onEdit: (campaign: NewsletterCampaign) => void;
  onNew: () => void;
}

const STATUS_CONFIG: Record<NewsletterCampaign["status"], { label: string; icon: React.ReactNode; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { 
    label: "Rascunho", 
    icon: <Pencil className="h-3 w-3" />,
    variant: "secondary" 
  },
  scheduled: { 
    label: "Agendado", 
    icon: <Clock className="h-3 w-3" />,
    variant: "outline" 
  },
  sending: { 
    label: "Enviando", 
    icon: <Loader2 className="h-3 w-3 animate-spin" />,
    variant: "default" 
  },
  sent: { 
    label: "Enviado", 
    icon: <CheckCircle2 className="h-3 w-3" />,
    variant: "default" 
  },
  sent_with_errors: { 
    label: "Enviado c/ erros", 
    icon: <AlertCircle className="h-3 w-3" />,
    variant: "outline" 
  },
  failed: { 
    label: "Falhou", 
    icon: <XCircle className="h-3 w-3" />,
    variant: "destructive" 
  },
};

export function CampaignsList({ onEdit, onNew }: CampaignsListProps) {
  const [statusFilter, setStatusFilter] = useState<NewsletterCampaign["status"] | "all">("all");
  
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;

  const { data: campaigns = [], isLoading } = useNewsletterCampaigns(workspaceId);
  const deleteCampaign = useDeleteCampaign();
  const createCampaign = useCreateCampaign();

  const filteredCampaigns = statusFilter === "all" 
    ? campaigns 
    : campaigns.filter(c => c.status === statusFilter);

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta campanha?")) return;
    
    try {
      await deleteCampaign.mutateAsync({ id, workspaceId });
      toast.success("Campanha excluída!");
    } catch {
      toast.error("Erro ao excluir campanha");
    }
  };

  const handleDuplicate = async (campaign: NewsletterCampaign) => {
    try {
      const created = await createCampaign.mutateAsync({
        subject: `${campaign.subject} (cópia)`,
        content: campaign.content ?? "",
        segments: campaign.segments,
        workspace_id: workspaceId,
      });
      toast.success("Campanha duplicada!");
      onEdit(created);
    } catch (error) {
      console.error("Error duplicating campaign:", error);
      const message = error instanceof Error ? error.message : "Erro ao duplicar campanha";
      toast.error(message);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Campanhas</CardTitle>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  {statusFilter === "all" ? "Todos os status" : STATUS_CONFIG[statusFilter].label}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setStatusFilter("all")}>
                  Todos
                </DropdownMenuItem>
                {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                  <DropdownMenuItem key={key} onClick={() => setStatusFilter(key as NewsletterCampaign["status"])}>
                    <span className="flex items-center gap-2">
                      {config.icon}
                      {config.label}
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button size="sm" onClick={onNew} className="gap-2">
              <Plus className="h-4 w-4" />
              Nova Campanha
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filteredCampaigns.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Mail className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">Nenhuma campanha encontrada</p>
            <p className="text-sm mt-1">
              {statusFilter !== "all" 
                ? "Tente remover o filtro de status" 
                : "Crie sua primeira campanha de newsletter"}
            </p>
            {statusFilter === "all" && (
              <Button className="mt-4" onClick={onNew}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Campanha
              </Button>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Assunto</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Segmentos</TableHead>
                <TableHead>Destinatários</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCampaigns.map((campaign) => {
                const statusConfig = STATUS_CONFIG[campaign.status];
                return (
                  <TableRow key={campaign.id}>
                    <TableCell className="font-medium max-w-[200px] truncate">
                      {campaign.subject}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusConfig.variant} className="gap-1">
                        {statusConfig.icon}
                        {statusConfig.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {campaign.segments.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {campaign.segments.slice(0, 2).map((seg) => (
                            <Badge key={seg} variant="outline" className="text-xs">
                              {seg}
                            </Badge>
                          ))}
                          {campaign.segments.length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{campaign.segments.length - 2}
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">Todos</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {campaign.status === "draft" ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <div className="text-sm">
                          <span className="text-emerald-600">{campaign.sent_count}</span>
                          {campaign.failed_count > 0 && (
                            <span className="text-destructive ml-1">
                              / {campaign.failed_count} falhas
                            </span>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(campaign.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onEdit(campaign)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            {campaign.status === "draft" ? "Editar" : "Visualizar"}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDuplicate(campaign)}>
                            <Copy className="h-4 w-4 mr-2" />
                            Duplicar
                          </DropdownMenuItem>
                          {campaign.status === "draft" && (
                            <DropdownMenuItem 
                              onClick={() => handleDelete(campaign.id)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
