import { useState, useMemo } from "react";
import { usePersistedTab } from "@/hooks/usePersistedTab";
import { PageTransition } from "@/components/ui/page-transition";
import { useNewsletterSubscribers, useDeleteSubscriber } from "@/hooks/useNewsletter";
import {
  useNewsletterSegments,
  useCreateSegment,
  useUpdateSegment,
  useDeleteSegment,
  useUpdateSubscriberSegments,
} from "@/hooks/useNewsletterSegments";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trash2, Download, Upload, Users, Mail, Send, Search, Palette } from "lucide-react";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { toast } from "sonner";
import { SegmentManager } from "@/components/newsletter/SegmentManager";
import { SegmentFilter } from "@/components/newsletter/SegmentFilter";
import { SubscriberSegmentEditor } from "@/components/newsletter/SubscriberSegmentEditor";
import { CampaignsList } from "@/components/newsletter/CampaignsList";
import { CampaignEditor } from "@/components/newsletter/CampaignEditor";
import { CsvImportModal } from "@/components/newsletter/CsvImportModal";
import { EmailProfilesList } from "@/components/newsletter/EmailProfilesList";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NewsletterCampaign } from "@/hooks/useNewsletterCampaigns";
import { useWorkspace } from "@/contexts/WorkspaceContext";

export default function AdminNewsletter() {
  const { currentWorkspace } = useWorkspace();
  const [segmentFilter, setSegmentFilter] = useState<string[]>([]);
  const [activeTab, setActiveTab] = usePersistedTab("newsletter-active-tab", "subscribers");
  const [editingCampaign, setEditingCampaign] = useState<NewsletterCampaign | null>(null);
  const [showCampaignEditor, setShowCampaignEditor] = useState(false);
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  const { data: subscribers, isLoading: loadingSubscribers } = useNewsletterSubscribers(
    segmentFilter.length > 0 ? segmentFilter : undefined
  );
  const { data: segments = [], isLoading: loadingSegments } = useNewsletterSegments();
  
  const deleteSubscriber = useDeleteSubscriber();
  const createSegment = useCreateSegment();
  const updateSegment = useUpdateSegment();
  const deleteSegment = useDeleteSegment();
  const updateSubscriberSegments = useUpdateSubscriberSegments();

  const filteredSubscribers = useMemo(() => {
    if (!subscribers) return [];
    const q = searchQuery.toLowerCase().trim();
    if (!q) return subscribers;
    return subscribers.filter(
      (s) =>
        s.email.toLowerCase().includes(q) ||
        (s.name || "").toLowerCase().includes(q)
    );
  }, [subscribers, searchQuery]);

  const stats = useMemo(() => {
    if (!subscribers) return { total: 0, active: 0, inactive: 0 };
    return {
      total: subscribers.length,
      active: subscribers.filter((s) => s.is_active).length,
      inactive: subscribers.filter((s) => !s.is_active).length,
    };
  }, [subscribers]);

  const handleDelete = async (id: string) => {
    if (!confirm("Remover este inscrito?")) return;
    try {
      await deleteSubscriber.mutateAsync(id);
      toast.success("Inscrito removido!");
    } catch {
      toast.error("Erro ao remover");
    }
  };

  const handleCreateSegment = async (segment: { name: string; description: string; color: string }) => {
    await createSegment.mutateAsync(segment);
  };

  const handleUpdateSegment = async (id: string, data: { name?: string; description?: string; color?: string }) => {
    await updateSegment.mutateAsync({ id, data });
  };

  const handleDeleteSegment = async (id: string) => {
    await deleteSegment.mutateAsync(id);
  };

  const handleUpdateSubscriberSegments = async (subscriberId: string, newSegments: string[]) => {
    await updateSubscriberSegments.mutateAsync({ subscriberId, segments: newSegments });
  };

  const exportCSV = () => {
    if (!subscribers) return;
    const headers = "Email,Nome,Data de Inscrição,Status,Segmentos,Score de Engajamento\n";
    const rows = subscribers.map((s) => 
      `"${s.email}","${s.name || ""}","${s.subscribed_at}","${s.is_active ? "Ativo" : "Inativo"}","${(s.segments || []).join("; ")}","${s.engagement_score}"`
    ).join("\n");
    const csv = headers + rows;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "newsletter-subscribers.csv";
    a.click();
  };

  const handleEditCampaign = (campaign: NewsletterCampaign) => {
    setEditingCampaign(campaign);
    setShowCampaignEditor(true);
  };

  const handleNewCampaign = () => {
    setEditingCampaign(null);
    setShowCampaignEditor(true);
  };

  const handleBackFromEditor = () => {
    setShowCampaignEditor(false);
    setEditingCampaign(null);
  };

  const isLoading = loadingSubscribers || loadingSegments;

  // Show campaign editor if in edit mode
  if (showCampaignEditor) {
    return (
      <CampaignEditor 
        campaign={editingCampaign} 
        onBack={handleBackFromEditor}
        onSaved={() => {}}
      />
    );
  }

  return (
    <PageTransition>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Newsletter</h1>
          <p className="text-muted-foreground mt-1">Gerencie inscritos, segmentos e campanhas</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowCsvImport(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Importar CSV
          </Button>
          <Button variant="outline" onClick={exportCSV} disabled={!subscribers?.length}>
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Total de Inscritos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Mail className="h-4 w-4 text-emerald-500" />
              Ativos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-600">{stats.active}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              Inativos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-muted-foreground">{stats.inactive}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="subscribers" className="gap-2">
            <Users className="h-4 w-4" />
            Inscritos
          </TabsTrigger>
          <TabsTrigger value="segments" className="gap-2">
            <Badge variant="outline" className="h-4 px-1 text-xs">
              {segments.length}
            </Badge>
            Segmentos
          </TabsTrigger>
          <TabsTrigger value="campaigns" className="gap-2">
            <Send className="h-4 w-4" />
            Campanhas
          </TabsTrigger>
          <TabsTrigger value="models" className="gap-2">
            <Palette className="h-4 w-4" />
            Modelos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="subscribers" className="mt-6">
          {/* Subscribers Table */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-4">
                <CardTitle className="text-base shrink-0">Inscritos</CardTitle>
                <div className="flex items-center gap-2 flex-1">
                  <div className="relative flex-1 max-w-xs">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por email ou nome..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                  <SegmentFilter
                    segments={segments}
                    selectedSegments={segmentFilter}
                    onChange={setSegmentFilter}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-32 animate-pulse rounded bg-muted" />
              ) : !filteredSubscribers.length ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Mail className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-medium">Nenhum inscrito encontrado</p>
                  <p className="text-sm mt-1">
                    {searchQuery
                      ? "Nenhum inscrito encontrado para essa busca"
                      : segmentFilter.length > 0
                      ? "Tente remover os filtros de segmento"
                      : "Os inscritos aparecerão aqui"}
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Segmentos</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSubscribers.map((sub) => (
                      <TableRow key={sub.id}>
                        <TableCell className="font-medium">{sub.email}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {sub.name || "—"}
                        </TableCell>
                        <TableCell>
                          <SubscriberSegmentEditor
                            subscriberSegments={sub.segments || []}
                            availableSegments={segments}
                            onSave={(newSegments) => handleUpdateSubscriberSegments(sub.id, newSegments)}
                          />
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {sub.engagement_score}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(sub.subscribed_at), "dd/MM/yyyy")}
                        </TableCell>
                        <TableCell>
                          <Badge variant={sub.is_active ? "default" : "secondary"}>
                            {sub.is_active ? "Ativo" : "Inativo"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(sub.id)}
                            className="hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="segments" className="mt-6">
          <SegmentManager
            segments={segments}
            onCreateSegment={handleCreateSegment}
            onUpdateSegment={handleUpdateSegment}
            onDeleteSegment={handleDeleteSegment}
            loading={loadingSegments}
          />
        </TabsContent>

        <TabsContent value="campaigns" className="mt-6">
          <CampaignsList
            onEdit={handleEditCampaign}
            onNew={handleNewCampaign}
          />
        </TabsContent>

        <TabsContent value="models" className="mt-6">
          {currentWorkspace ? (
            <EmailProfilesList
              workspaceId={currentWorkspace.id}
              onNewCampaign={() => {
                setActiveTab("campaigns");
                handleNewCampaign();
              }}
            />
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Carregando workspace...
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>

    <CsvImportModal open={showCsvImport} onOpenChange={setShowCsvImport} />
    </PageTransition>
  );
}
