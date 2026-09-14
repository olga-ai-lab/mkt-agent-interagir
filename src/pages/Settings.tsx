import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plug, Building2, LayoutTemplate } from "lucide-react";
import { PageTransition } from "@/components/ui/page-transition";
import IntegrationsSettings from "@/components/settings/IntegrationsSettings";
import WorkspaceSettings from "@/components/settings/WorkspaceSettings";
import { TemplateManager } from "@/components/marketing/TemplateManager";
import { useWorkspace } from "@/contexts/WorkspaceContext";

export default function Settings() {
  const { currentWorkspace } = useWorkspace();

  return (
    <PageTransition>
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">
          Gerencie integrações, templates e preferências do workspace
        </p>
      </div>

      <Tabs defaultValue="integrations" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
          <TabsTrigger value="integrations" className="gap-2">
            <Plug className="h-4 w-4" />
            <span className="hidden sm:inline">Integrações</span>
            <span className="sm:hidden">Integrações</span>
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-2">
            <LayoutTemplate className="h-4 w-4" />
            <span className="hidden sm:inline">Templates</span>
            <span className="sm:hidden">Templates</span>
          </TabsTrigger>
          <TabsTrigger value="workspace" className="gap-2">
            <Building2 className="h-4 w-4" />
            <span className="hidden sm:inline">Workspace</span>
            <span className="sm:hidden">Workspace</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="integrations">
          <IntegrationsSettings />
        </TabsContent>

        <TabsContent value="templates">
          {currentWorkspace ? (
            <TemplateManager workspaceId={currentWorkspace.id} />
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Carregando workspace...
            </div>
          )}
        </TabsContent>

        <TabsContent value="workspace">
          <WorkspaceSettings />
        </TabsContent>
      </Tabs>
    </div>
    </PageTransition>
  );
}
