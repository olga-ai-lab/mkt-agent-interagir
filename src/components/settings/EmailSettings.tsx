import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import {
  useWorkspaceEmailSettings,
  useUpdateWorkspaceEmailSettings,
  WorkspaceEmailSettings,
} from "@/hooks/useWorkspaceEmailSettings";
import { Save, Loader2, Mail, Building2, Share2, Image } from "lucide-react";

export default function EmailSettings() {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;
  const { toast } = useToast();

  const { data: savedSettings, isLoading } = useWorkspaceEmailSettings(workspaceId);
  const updateSettings = useUpdateWorkspaceEmailSettings();

  const [form, setForm] = useState<WorkspaceEmailSettings>({
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
  });

  useEffect(() => {
    if (savedSettings) setForm(savedSettings);
  }, [savedSettings]);

  const set = (key: keyof WorkspaceEmailSettings) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSave = async () => {
    if (!workspaceId) return;
    try {
      await updateSettings.mutateAsync({ workspaceId, settings: form });
      toast({ title: "Configurações salvas", description: "As configurações de email foram atualizadas." });
    } catch {
      toast({ title: "Erro ao salvar", description: "Não foi possível salvar as configurações.", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Identidade Visual */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Image className="h-5 w-5" />
            Identidade Visual
          </CardTitle>
          <CardDescription>
            Logos e foto de cabeçalho usados nos templates de email. Insira as URLs das imagens hospedadas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="logo-livonius">Logo Livonius (URL)</Label>
              <Input
                id="logo-livonius"
                placeholder="https://..."
                value={form.logo_livonius_url}
                onChange={set("logo_livonius_url")}
              />
              <p className="text-xs text-muted-foreground">Aparece no cabeçalho e rodapé do email.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="logo-livo">Logo Livo (URL)</Label>
              <Input
                id="logo-livo"
                placeholder="https://..."
                value={form.logo_livo_url}
                onChange={set("logo_livo_url")}
              />
              <p className="text-xs text-muted-foreground">Exibida nos templates de Grupo e Informe.</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="header-photo">Foto de Fundo do Cabeçalho (URL)</Label>
            <Input
              id="header-photo"
              placeholder="https://..."
              value={form.header_photo_url}
              onChange={set("header_photo_url")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="primary-color">Cor Principal</Label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                id="primary-color-picker"
                value={form.primary_color}
                onChange={set("primary_color")}
                className="h-10 w-14 cursor-pointer rounded border border-input bg-transparent p-1"
              />
              <Input
                id="primary-color"
                placeholder="#1a6b5a"
                value={form.primary_color}
                onChange={set("primary_color")}
                className="max-w-[140px] font-mono"
              />
            </div>
            <p className="text-xs text-muted-foreground">Usada no bloco do cabeçalho e no rodapé.</p>
          </div>
        </CardContent>
      </Card>

      {/* Informações da Empresa */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Informações da Empresa
          </CardTitle>
          <CardDescription>
            Dados exibidos no rodapé dos emails enviados.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="company-name">Nome da Empresa</Label>
            <Input
              id="company-name"
              placeholder="Livonius MGA"
              value={form.company_name}
              onChange={set("company_name")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Endereço</Label>
            <Input
              id="address"
              placeholder="Av. Loureiro da Silva, 1940 - 12º andar - CEP 90050-240 - Porto Alegre/RS"
              value={form.address}
              onChange={set("address")}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                placeholder="(51) 3224.8555"
                value={form.phone}
                onChange={set("phone")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="site">Site</Label>
              <Input
                id="site"
                placeholder="livomga.com.br"
                value={form.site_url}
                onChange={set("site_url")}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Redes Sociais */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Redes Sociais
          </CardTitle>
          <CardDescription>
            Links exibidos nos ícones de redes sociais no rodapé dos emails.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="instagram">Instagram</Label>
            <Input
              id="instagram"
              placeholder="https://www.instagram.com/livoniusmga"
              value={form.instagram_url}
              onChange={set("instagram_url")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="facebook">Facebook</Label>
            <Input
              id="facebook"
              placeholder="https://www.facebook.com/livoniusmga"
              value={form.facebook_url}
              onChange={set("facebook_url")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="linkedin">LinkedIn</Label>
            <Input
              id="linkedin"
              placeholder="https://www.linkedin.com/company/livonius"
              value={form.linkedin_url}
              onChange={set("linkedin_url")}
            />
          </div>
        </CardContent>
      </Card>

      <Separator />

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateSettings.isPending} className="gap-2">
          {updateSettings.isPending ? (
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
