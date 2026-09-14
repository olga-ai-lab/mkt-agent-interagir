import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { api, Approver } from "@/services/api";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Plus, Trash2, Loader2, UserCheck, UserX } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function ApproversSettings() {
  const { currentWorkspace } = useWorkspace();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [approvers, setApprovers] = useState<Approver[]>([]);
  const [newApprover, setNewApprover] = useState({
    name: "",
    email: "",
    type: "internal" as "internal" | "external",
  });
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    loadApprovers();
  }, [currentWorkspace?.id]);

  async function loadApprovers() {
    if (!currentWorkspace?.id) return;
    
    try {
      const data = await api.getApprovers(currentWorkspace.id);
      setApprovers(data);
    } catch (error) {
      console.error("Error loading approvers:", error);
    } finally {
      setLoading(false);
    }
  }

  const handleAddApprover = async () => {
    if (!currentWorkspace?.id || !newApprover.name || !newApprover.email) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha nome e email do aprovador.",
        variant: "destructive",
      });
      return;
    }

    setAdding(true);
    try {
      const approver = await api.addApprover({
        workspace_id: currentWorkspace.id,
        ...newApprover,
      });
      setApprovers(prev => [approver, ...prev]);
      setNewApprover({ name: "", email: "", type: "internal" });
      toast({
        title: "Aprovador adicionado",
        description: `${approver.name} foi adicionado como aprovador.`,
      });
    } catch (error) {
      toast({
        title: "Erro ao adicionar",
        description: "Não foi possível adicionar o aprovador.",
        variant: "destructive",
      });
    } finally {
      setAdding(false);
    }
  };

  const handleToggleActive = async (approver: Approver) => {
    try {
      const updated = await api.updateApprover(approver.id, {
        is_active: !approver.is_active,
      });
      if (updated) {
        setApprovers(prev => prev.map(a => a.id === approver.id ? updated : a));
        toast({
          title: updated.is_active ? "Aprovador ativado" : "Aprovador desativado",
          description: `${updated.name} foi ${updated.is_active ? "ativado" : "desativado"}.`,
        });
      }
    } catch (error) {
      toast({
        title: "Erro ao atualizar",
        description: "Não foi possível atualizar o status do aprovador.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteApprover = async (id: string) => {
    try {
      const success = await api.deleteApprover(id);
      if (success) {
        setApprovers(prev => prev.filter(a => a.id !== id));
        toast({
          title: "Aprovador removido",
          description: "O aprovador foi removido com sucesso.",
        });
      }
    } catch (error) {
      toast({
        title: "Erro ao remover",
        description: "Não foi possível remover o aprovador.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Add new approver */}
      <Card>
        <CardHeader>
          <CardTitle>Adicionar Aprovador</CardTitle>
          <CardDescription>
            Adicione pessoas que podem aprovar posts antes da publicação.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              placeholder="Nome"
              value={newApprover.name}
              onChange={(e) => setNewApprover(prev => ({ ...prev, name: e.target.value }))}
              className="flex-1"
            />
            <Input
              placeholder="Email"
              type="email"
              value={newApprover.email}
              onChange={(e) => setNewApprover(prev => ({ ...prev, email: e.target.value }))}
              className="flex-1"
            />
            <Select
              value={newApprover.type}
              onValueChange={(value: "internal" | "external") => 
                setNewApprover(prev => ({ ...prev, type: value }))
              }
            >
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="internal">Interno</SelectItem>
                <SelectItem value="external">Externo</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleAddApprover} disabled={adding} className="gap-2">
              {adding ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Adicionar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Approvers list */}
      <Card>
        <CardHeader>
          <CardTitle>Aprovadores ({approvers.length})</CardTitle>
          <CardDescription>
            Gerencie os aprovadores do seu workspace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {approvers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <UserX className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nenhum aprovador cadastrado.</p>
              <p className="text-sm">Adicione aprovadores usando o formulário acima.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-center">Ativo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {approvers.map((approver) => (
                  <TableRow key={approver.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <UserCheck className="h-4 w-4 text-muted-foreground" />
                        {approver.name}
                      </div>
                    </TableCell>
                    <TableCell>{approver.email}</TableCell>
                    <TableCell>
                      <Badge variant={approver.type === "internal" ? "default" : "secondary"}>
                        {approver.type === "internal" ? "Interno" : "Externo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={approver.is_active}
                        onCheckedChange={() => handleToggleActive(approver)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remover aprovador?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Tem certeza que deseja remover {approver.name}? Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteApprover(approver.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Remover
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
