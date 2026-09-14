import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/services/api";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Save, Loader2, Building2 } from "lucide-react";

export default function WorkspaceSettings() {
  const { currentWorkspace, refreshWorkspaces } = useWorkspace();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    logo_url: "",
  });

  useEffect(() => {
    if (currentWorkspace) {
      setFormData({
        name: currentWorkspace.name || "",
        logo_url: currentWorkspace.logo_url || "",
      });
    }
  }, [currentWorkspace]);

  const handleSave = async () => {
    if (!currentWorkspace?.id) return;
    
    if (!formData.name.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "O workspace precisa ter um nome.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      await api.updateWorkspace(currentWorkspace.id, formData);
      await refreshWorkspaces();
      toast({
        title: "Workspace atualizado",
        description: "As configurações do workspace foram salvas.",
      });
    } catch (error) {
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível atualizar o workspace.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Informações do Workspace</CardTitle>
          <CardDescription>
            Configure o nome e a identidade visual do seu workspace.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Logo Preview */}
          <div className="flex items-center gap-6">
            <Avatar className="h-20 w-20">
              <AvatarImage src={formData.logo_url} alt={formData.name} />
              <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                {formData.name ? getInitials(formData.name) : <Building2 className="h-8 w-8" />}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h3 className="font-medium mb-1">Logo do Workspace</h3>
              <p className="text-sm text-muted-foreground">
                Insira uma URL de imagem para o logo do seu workspace.
              </p>
            </div>
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="workspace-name">Nome do Workspace</Label>
              <Input
                id="workspace-name"
                placeholder="Minha Empresa"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="workspace-logo">URL do Logo</Label>
              <Input
                id="workspace-logo"
                placeholder="https://exemplo.com/logo.png"
                value={formData.logo_url}
                onChange={(e) => setFormData(prev => ({ ...prev, logo_url: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Recomendado: imagem quadrada com pelo menos 200x200 pixels.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Workspace Info */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhes do Workspace</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="space-y-3">
            <div className="flex justify-between py-2 border-b">
              <dt className="text-muted-foreground">ID do Workspace</dt>
              <dd className="font-mono text-sm">{currentWorkspace?.id || "—"}</dd>
            </div>
            <div className="flex justify-between py-2 border-b">
              <dt className="text-muted-foreground">Criado em</dt>
              <dd>
                {currentWorkspace?.created_at 
                  ? new Date(currentWorkspace.created_at).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                    })
                  : "—"
                }
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Salvar Configurações
        </Button>
      </div>
    </div>
  );
}
