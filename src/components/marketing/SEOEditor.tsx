import { useState, useEffect } from 'react';
import { Search, Image, Hash, AlertCircle, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

interface SEOEditorProps {
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string[];
  ogImageUrl: string;
  onSeoTitleChange: (value: string) => void;
  onSeoDescriptionChange: (value: string) => void;
  onSeoKeywordsChange: (value: string[]) => void;
  onOgImageUrlChange: (value: string) => void;
  defaultTitle?: string;
}

export function SEOEditor({
  seoTitle,
  seoDescription,
  seoKeywords,
  ogImageUrl,
  onSeoTitleChange,
  onSeoDescriptionChange,
  onSeoKeywordsChange,
  onOgImageUrlChange,
  defaultTitle = '',
}: SEOEditorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [keywordInput, setKeywordInput] = useState('');

  // SEO validation
  const titleLength = seoTitle.length;
  const descriptionLength = seoDescription.length;
  
  const titleStatus = titleLength === 0 ? 'empty' : titleLength <= 60 ? 'good' : 'warning';
  const descriptionStatus = descriptionLength === 0 ? 'empty' : descriptionLength <= 160 ? 'good' : 'warning';

  const handleAddKeyword = () => {
    const keyword = keywordInput.trim().toLowerCase();
    if (keyword && !seoKeywords.includes(keyword)) {
      onSeoKeywordsChange([...seoKeywords, keyword]);
      setKeywordInput('');
    }
  };

  const handleRemoveKeyword = (keyword: string) => {
    onSeoKeywordsChange(seoKeywords.filter(k => k !== keyword));
  };

  const handleKeywordInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddKeyword();
    }
  };

  // Calculate SEO score
  const calculateScore = () => {
    let score = 0;
    if (seoTitle.length > 0 && seoTitle.length <= 60) score += 25;
    if (seoDescription.length > 0 && seoDescription.length <= 160) score += 25;
    if (seoKeywords.length >= 3) score += 25;
    if (ogImageUrl) score += 25;
    return score;
  };

  const score = calculateScore();

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-dashed">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Search className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle className="text-base">SEO & Open Graph</CardTitle>
                  <CardDescription className="text-xs">
                    Otimize para buscadores e redes sociais
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge 
                  variant={score >= 75 ? 'default' : score >= 50 ? 'secondary' : 'outline'}
                  className={cn(
                    score >= 75 ? 'bg-green-500/20 text-green-500 border-green-500/30' :
                    score >= 50 ? 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30' :
                    'bg-muted'
                  )}
                >
                  {score}% otimizado
                </Badge>
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            {/* SEO Title */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="seo-title">Título SEO</Label>
                <span className={cn(
                  'text-xs',
                  titleStatus === 'good' ? 'text-green-500' : 
                  titleStatus === 'warning' ? 'text-yellow-500' : 'text-muted-foreground'
                )}>
                  {titleLength}/60 caracteres
                </span>
              </div>
              <Input
                id="seo-title"
                placeholder={defaultTitle || "Título otimizado para buscadores..."}
                value={seoTitle}
                onChange={(e) => onSeoTitleChange(e.target.value)}
                className={cn(
                  titleStatus === 'warning' && 'border-yellow-500'
                )}
              />
              {titleStatus === 'good' && titleLength > 0 && (
                <p className="text-xs text-green-500 flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  Título dentro do limite ideal
                </p>
              )}
            </div>

            {/* Meta Description */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="seo-description">Meta Descrição</Label>
                <span className={cn(
                  'text-xs',
                  descriptionStatus === 'good' ? 'text-green-500' : 
                  descriptionStatus === 'warning' ? 'text-yellow-500' : 'text-muted-foreground'
                )}>
                  {descriptionLength}/160 caracteres
                </span>
              </div>
              <Textarea
                id="seo-description"
                placeholder="Descrição do post para motores de busca e preview em redes sociais..."
                value={seoDescription}
                onChange={(e) => onSeoDescriptionChange(e.target.value)}
                rows={3}
                className={cn(
                  descriptionStatus === 'warning' && 'border-yellow-500'
                )}
              />
            </div>

            {/* Keywords */}
            <div className="space-y-2">
              <Label>Palavras-chave</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Adicionar palavra-chave..."
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  onKeyDown={handleKeywordInputKeyDown}
                />
                <Button type="button" variant="outline" size="icon" onClick={handleAddKeyword}>
                  <Hash className="h-4 w-4" />
                </Button>
              </div>
              {seoKeywords.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {seoKeywords.map((keyword) => (
                    <Badge
                      key={keyword}
                      variant="secondary"
                      className="cursor-pointer hover:bg-destructive/20"
                      onClick={() => handleRemoveKeyword(keyword)}
                    >
                      {keyword} ×
                    </Badge>
                  ))}
                </div>
              )}
              {seoKeywords.length < 3 && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Adicione pelo menos 3 palavras-chave para melhor SEO
                </p>
              )}
            </div>

            {/* OG Image */}
            <div className="space-y-2">
              <Label htmlFor="og-image">Imagem Open Graph</Label>
              <div className="flex gap-2">
                <Input
                  id="og-image"
                  placeholder="URL da imagem para redes sociais (1200x630 recomendado)"
                  value={ogImageUrl}
                  onChange={(e) => onOgImageUrlChange(e.target.value)}
                />
                <Button type="button" variant="outline" size="icon">
                  <Image className="h-4 w-4" />
                </Button>
              </div>
              {ogImageUrl && (
                <div className="mt-2 relative aspect-video w-full max-w-xs rounded-lg overflow-hidden border bg-muted">
                  <img
                    src={ogImageUrl}
                    alt="OG Preview"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>

            {/* Preview */}
            <div className="space-y-2 pt-4 border-t">
              <Label className="text-muted-foreground">Preview no Google</Label>
              <div className="p-3 bg-background rounded-lg border space-y-1">
                <p className="text-primary text-sm font-medium line-clamp-1">
                  {seoTitle || defaultTitle || 'Título do post'}
                </p>
                <p className="text-green-600 text-xs">
                  exemplo.com/posts/seu-post
                </p>
                <p className="text-muted-foreground text-xs line-clamp-2">
                  {seoDescription || 'A meta descrição aparecerá aqui nos resultados de busca...'}
                </p>
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
