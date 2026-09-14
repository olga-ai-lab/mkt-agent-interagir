import { useState } from 'react';
import { Plus, LayoutTemplate, Pencil, Trash2, Sparkles, Calendar, Gift, Megaphone, Building2, Star } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ChannelSelector } from './ChannelSelector';
import { ChannelIcons } from './ChannelIcons';
import { usePostTemplates, useCreateTemplate, useUpdateTemplate, useDeleteTemplate } from '@/hooks/usePostTemplates';
import { TEMPLATE_CATEGORIES, type PostTemplate, type SocialChannel, type TemplateCategory } from '@/types/marketing';

interface TemplateManagerProps {
  workspaceId: string;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  lancamento: <Sparkles className="h-4 w-4" />,
  promocao: <Gift className="h-4 w-4" />,
  data_comemorativa: <Calendar className="h-4 w-4" />,
  engajamento: <Megaphone className="h-4 w-4" />,
  institucional: <Building2 className="h-4 w-4" />,
  outro: <Star className="h-4 w-4" />,
};

export function TemplateManager({ workspaceId }: TemplateManagerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PostTemplate | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [channels, setChannels] = useState<SocialChannel[]>([]);
  const [category, setCategory] = useState<string>('');

  const { data: templates = [], isLoading } = usePostTemplates(workspaceId);
  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate();
  const deleteTemplate = useDeleteTemplate();

  const resetForm = () => {
    setName('');
    setDescription('');
    setContent('');
    setExcerpt('');
    setChannels([]);
    setCategory('');
    setEditingTemplate(null);
  };

  const handleOpenDialog = (template?: PostTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setName(template.name);
      setDescription(template.description || '');
      setContent(template.content || '');
      setExcerpt(template.excerpt || '');
      setChannels(template.channels);
      setCategory(template.category || '');
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    resetForm();
  };

  const handleSave = async () => {
    if (!name.trim()) return;

    const templateData = {
      workspace_id: workspaceId,
      name: name.trim(),
      description: description.trim() || null,
      content: content.trim() || null,
      excerpt: excerpt.trim() || null,
      channels,
      category: category || null,
    };

    if (editingTemplate) {
      await updateTemplate.mutateAsync({ id: editingTemplate.id, ...templateData });
    } else {
      await createTemplate.mutateAsync(templateData);
    }

    handleCloseDialog();
  };

  const handleDelete = async (id: string) => {
    await deleteTemplate.mutateAsync({ id, workspaceId });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <LayoutTemplate className="h-5 w-5" />
            Templates de Posts
          </CardTitle>
          <CardDescription>
            Crie modelos reutilizáveis para agilizar a criação de posts
          </CardDescription>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()} className="gap-2">
              <Plus className="h-4 w-4" />
              Novo Template
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>
                {editingTemplate ? 'Editar Template' : 'Novo Template'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do Template *</Label>
                <Input
                  id="name"
                  placeholder="Ex: Lançamento de Produto"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Input
                  id="description"
                  placeholder="Breve descrição do template..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {TEMPLATE_CATEGORIES.map(cat => (
                        <SelectItem key={cat.value} value={cat.value}>
                          <span className="flex items-center gap-2">
                            {CATEGORY_ICONS[cat.value]}
                            {cat.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Canais</Label>
                  <ChannelSelector
                    selectedChannels={channels}
                    onChange={setChannels}
                    includeBlog={false}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="excerpt">Resumo</Label>
                <Input
                  id="excerpt"
                  placeholder="Texto padrão do resumo..."
                  value={excerpt}
                  onChange={(e) => setExcerpt(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="content">Conteúdo / Legenda</Label>
                <Textarea
                  id="content"
                  placeholder="Conteúdo padrão do template..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={5}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleCloseDialog}>
                Cancelar
              </Button>
              <Button 
                onClick={handleSave} 
                disabled={!name.trim() || createTemplate.isPending || updateTemplate.isPending}
              >
                {editingTemplate ? 'Salvar' : 'Criar Template'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <LayoutTemplate className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Nenhum template criado</p>
            <p className="text-sm">Crie seu primeiro template para começar</p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {templates.map(template => (
              <div
                key={template.id}
                className="p-4 rounded-lg border bg-card hover:border-primary/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    {template.category && CATEGORY_ICONS[template.category]}
                    <h4 className="font-medium text-sm">{template.name}</h4>
                  </div>
                  <ChannelIcons channels={template.channels} size="xs" />
                </div>

                {template.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                    {template.description}
                  </p>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    {template.category && (
                      <Badge variant="outline" className="text-xs">
                        {TEMPLATE_CATEGORIES.find(c => c.value === template.category)?.label}
                      </Badge>
                    )}
                    {template.usage_count && template.usage_count > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {template.usage_count}x
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleOpenDialog(template)}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir template?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação não pode ser desfeita. O template "{template.name}" será excluído permanentemente.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => handleDelete(template.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
