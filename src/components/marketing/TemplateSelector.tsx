import { useState } from 'react';
import { LayoutTemplate, Search, Sparkles, Calendar, Gift, Megaphone, Building2, Star } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePostTemplates, useUseTemplate } from '@/hooks/usePostTemplates';
import { ChannelIcons } from './ChannelIcons';
import type { PostTemplate, SocialChannel } from '@/types/marketing';
import { cn } from '@/lib/utils';

interface TemplateSelectorProps {
  workspaceId: string;
  onSelectTemplate: (template: PostTemplate) => void;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  lancamento: <Sparkles className="h-4 w-4" />,
  promocao: <Gift className="h-4 w-4" />,
  data_comemorativa: <Calendar className="h-4 w-4" />,
  engajamento: <Megaphone className="h-4 w-4" />,
  institucional: <Building2 className="h-4 w-4" />,
  outro: <Star className="h-4 w-4" />,
};

const CATEGORY_LABELS: Record<string, string> = {
  lancamento: 'Lançamento',
  promocao: 'Promoção',
  data_comemorativa: 'Data Comemorativa',
  engajamento: 'Engajamento',
  institucional: 'Institucional',
  outro: 'Outro',
};

export function TemplateSelector({ workspaceId, onSelectTemplate }: TemplateSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const { data: templates = [], isLoading } = usePostTemplates(workspaceId);
  const useTemplate = useUseTemplate();

  // Filter templates
  const filteredTemplates = templates.filter(template => {
    const matchesSearch = !search || 
      template.name.toLowerCase().includes(search.toLowerCase()) ||
      template.description?.toLowerCase().includes(search.toLowerCase());
    
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  // Get unique categories from templates
  const categories = [...new Set(templates.map(t => t.category).filter(Boolean))] as string[];

  const handleSelect = async (template: PostTemplate) => {
    await useTemplate.mutateAsync(template.id);
    onSelectTemplate(template);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <LayoutTemplate className="h-4 w-4" />
          Usar Template
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LayoutTemplate className="h-5 w-5" />
            Biblioteca de Templates
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar templates..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Category Tabs */}
          <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
            <TabsList className="flex-wrap h-auto gap-1 bg-transparent p-0">
              <TabsTrigger
                value="all"
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                Todos
              </TabsTrigger>
              {categories.map(category => (
                <TabsTrigger
                  key={category}
                  value={category}
                  className="gap-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  {CATEGORY_ICONS[category]}
                  {CATEGORY_LABELS[category] || category}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {/* Templates Grid */}
          <ScrollArea className="h-[400px]">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <LayoutTemplate className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Nenhum template encontrado</p>
                <p className="text-sm">Crie templates para agilizar a criação de posts</p>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {filteredTemplates.map(template => (
                  <button
                    key={template.id}
                    onClick={() => handleSelect(template)}
                    className={cn(
                      "text-left p-4 rounded-lg border bg-card transition-all",
                      "hover:border-primary hover:shadow-md hover:scale-[1.02]"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        {template.category && CATEGORY_ICONS[template.category]}
                        <h4 className="font-medium">{template.name}</h4>
                      </div>
                      <ChannelIcons channels={template.channels} size="sm" />
                    </div>
                    
                    {template.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                        {template.description}
                      </p>
                    )}
                    
                    <div className="flex items-center gap-2 flex-wrap">
                      {template.category && (
                        <Badge variant="outline" className="text-xs">
                          {CATEGORY_LABELS[template.category] || template.category}
                        </Badge>
                      )}
                      {template.usage_count && template.usage_count > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          Usado {template.usage_count}x
                        </Badge>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
