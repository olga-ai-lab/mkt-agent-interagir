import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/services/api";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Instagram, Linkedin, Mail, Save, TestTube, Loader2, CheckCircle2, XCircle } from "lucide-react";

interface WebhookConfig {
  instagram_webhook: string;
  linkedin_webhook: string;
  newsletter_webhook: string;
}

export default function WebhooksSettings() {
  const { currentWorkspace } = useWorkspace();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [integrationId, setIntegrationId] = useState<string | null>(null);
  const [webhooks, setWebhooks] = useState<WebhookConfig>({
    instagram_webhook: "",
    linkedin_webhook: "",
    newsletter_webhook: "",
  });
  const [testResults, setTestResults] = useState<Record<string, boolean | null>>({
    instagram: null,
    linkedin: null,
    newsletter: null,
  });

  useEffect(() => {
    async function loadWebhooks() {
      if (!currentWorkspace?.id) return;
      
      try {
        const integrations = await api.getIntegrations(currentWorkspace.id);
        const n8nIntegration = integrations.find(i => i.type === 'n8n');
        
        if (n8nIntegration) {
          setIntegrationId(n8nIntegration.id);
          const config = n8nIntegration.config as Record<string, unknown>;
          setWebhooks({
            instagram_webhook: (config?.instagram_webhook as string) || "",
            linkedin_webhook: (config?.linkedin_webhook as string) || "",
            newsletter_webhook: (config?.newsletter_webhook as string) || "",
          });
        }
      } catch (error) {
        console.error("Error loading webhooks:", error);
      } finally {
        setLoading(false);
      }
    }

    loadWebhooks();
  }, [currentWorkspace?.id]);

  const handleSave = async () => {
    if (!currentWorkspace?.id) return;
    
    setSaving(true);
    try {
      if (integrationId) {
        await api.updateIntegration(integrationId, {
          config: webhooks as unknown as Record<string, unknown>,
        });
      } else {
        const newIntegration = await api.createIntegration({
          workspace_id: currentWorkspace.id,
          type: 'n8n',
          is_active: true,
          config: webhooks as unknown as Record<string, unknown>,
        });
        setIntegrationId(newIntegration.id);
      }
      
      toast({
        title: "Webhooks salvos",
        description: "As configurações de webhook foram atualizadas com sucesso.",
      });
    } catch (error) {
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar as configurações de webhook.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (type: 'instagram' | 'linkedin' | 'newsletter') => {
    const urlMap = {
      instagram: webhooks.instagram_webhook,
      linkedin: webhooks.linkedin_webhook,
      newsletter: webhooks.newsletter_webhook,
    };
    const url = urlMap[type];
    
    if (!url) {
      toast({
        title: "URL não configurada",
        description: `Configure a URL do webhook ${type} antes de testar.`,
        variant: "destructive",
      });
      return;
    }

    setTesting(type);
    setTestResults(prev => ({ ...prev, [type]: null }));

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          test: true,
          channel: type,
          timestamp: new Date().toISOString(),
        }),
      });

      const success = response.ok;
      setTestResults(prev => ({ ...prev, [type]: success }));
      
      toast({
        title: success ? "Teste bem-sucedido" : "Teste falhou",
        description: success 
          ? `O webhook ${type} respondeu corretamente.`
          : `O webhook ${type} não respondeu como esperado.`,
        variant: success ? "default" : "destructive",
      });
    } catch (error) {
      setTestResults(prev => ({ ...prev, [type]: false }));
      toast({
        title: "Erro no teste",
        description: `Não foi possível conectar ao webhook ${type}. Verifique a URL.`,
        variant: "destructive",
      });
    } finally {
      setTesting(null);
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
      <Card>
        <CardHeader>
          <CardTitle>Webhooks n8n</CardTitle>
          <CardDescription>
            Configure as URLs dos webhooks n8n para publicação automática em cada canal.
            Esses endpoints serão chamados quando um post for aprovado e publicado.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Instagram Webhook */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="instagram-webhook" className="flex items-center gap-2">
                <Instagram className="h-4 w-4" />
                Instagram Webhook
              </Label>
              {testResults.instagram !== null && (
                <Badge variant={testResults.instagram ? "default" : "destructive"} className="gap-1">
                  {testResults.instagram ? (
                    <>
                      <CheckCircle2 className="h-3 w-3" />
                      Conectado
                    </>
                  ) : (
                    <>
                      <XCircle className="h-3 w-3" />
                      Falhou
                    </>
                  )}
                </Badge>
              )}
            </div>
            <div className="flex gap-2">
              <Input
                id="instagram-webhook"
                placeholder="https://n8n.example.com/webhook/instagram"
                value={webhooks.instagram_webhook}
                onChange={(e) => setWebhooks(prev => ({ ...prev, instagram_webhook: e.target.value }))}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleTest('instagram')}
                disabled={testing !== null}
              >
                {testing === 'instagram' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <TestTube className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* LinkedIn Webhook */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="linkedin-webhook" className="flex items-center gap-2">
                <Linkedin className="h-4 w-4" />
                LinkedIn Webhook
              </Label>
              {testResults.linkedin !== null && (
                <Badge variant={testResults.linkedin ? "default" : "destructive"} className="gap-1">
                  {testResults.linkedin ? (
                    <>
                      <CheckCircle2 className="h-3 w-3" />
                      Conectado
                    </>
                  ) : (
                    <>
                      <XCircle className="h-3 w-3" />
                      Falhou
                    </>
                  )}
                </Badge>
              )}
            </div>
            <div className="flex gap-2">
              <Input
                id="linkedin-webhook"
                placeholder="https://n8n.example.com/webhook/linkedin"
                value={webhooks.linkedin_webhook}
                onChange={(e) => setWebhooks(prev => ({ ...prev, linkedin_webhook: e.target.value }))}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleTest('linkedin')}
                disabled={testing !== null}
              >
                {testing === 'linkedin' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <TestTube className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Newsletter Webhook */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="newsletter-webhook" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Newsletter Webhook
              </Label>
              {testResults.newsletter !== null && (
                <Badge variant={testResults.newsletter ? "default" : "destructive"} className="gap-1">
                  {testResults.newsletter ? (
                    <>
                      <CheckCircle2 className="h-3 w-3" />
                      Conectado
                    </>
                  ) : (
                    <>
                      <XCircle className="h-3 w-3" />
                      Falhou
                    </>
                  )}
                </Badge>
              )}
            </div>
            <div className="flex gap-2">
              <Input
                id="newsletter-webhook"
                placeholder="https://n8n.example.com/webhook/newsletter/send"
                value={webhooks.newsletter_webhook}
                onChange={(e) => setWebhooks(prev => ({ ...prev, newsletter_webhook: e.target.value }))}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleTest('newsletter')}
                disabled={testing !== null}
              >
                {testing === 'newsletter' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <TestTube className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Este webhook será usado para enviar campanhas de email via n8n.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Salvar Webhooks
        </Button>
      </div>
    </div>
  );
}
