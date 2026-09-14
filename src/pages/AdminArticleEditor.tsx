import { useState, useEffect } from "react";
import { PageTransition } from "@/components/ui/page-transition";
import { useNavigate, useParams } from "react-router-dom";
import { useArticleBySlug, useCreateArticle, useUpdateArticle, useAllArticles } from "@/hooks/useArticles";
import { useCategories } from "@/hooks/useCategories";
import { useProfile } from "@/hooks/useProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";

export default function AdminArticleEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = !!id && id !== "new";
  
  const { data: articles } = useAllArticles();
  const existingArticle = articles?.find((a) => a.id === id);
  const { data: categories } = useCategories();
  const { data: profile } = useProfile();
  const createArticle = useCreateArticle();
  const updateArticle = useUpdateArticle();

  const [form, setForm] = useState({
    title: "",
    slug: "",
    excerpt: "",
    content: "",
    cover_image_url: "",
    category_id: "",
    status: "draft",
    tags: "",
    meta_description: "",
  });

  useEffect(() => {
    if (existingArticle) {
      setForm({
        title: existingArticle.title,
        slug: existingArticle.slug,
        excerpt: existingArticle.excerpt || "",
        content: existingArticle.content || "",
        cover_image_url: existingArticle.cover_image_url || "",
        category_id: existingArticle.category_id || "",
        status: existingArticle.status,
        tags: existingArticle.tags?.join(", ") || "",
        meta_description: existingArticle.meta_description || "",
      });
    }
  }, [existingArticle]);

  const generateSlug = (title: string) => {
    return title.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  };

  const handleTitleChange = (title: string) => {
    setForm((prev) => ({
      ...prev,
      title,
      slug: isEditing ? prev.slug : generateSlug(title),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const articleData = {
      title: form.title,
      slug: form.slug,
      excerpt: form.excerpt || null,
      content: form.content || null,
      cover_image_url: form.cover_image_url || null,
      category_id: form.category_id || null,
      author_id: profile?.id || null,
      status: form.status,
      tags: form.tags ? form.tags.split(",").map((t) => t.trim()) : null,
      meta_description: form.meta_description || null,
      published_at: form.status === "published" ? new Date().toISOString() : null,
    };

    try {
      if (isEditing) {
        await updateArticle.mutateAsync({ id, ...articleData });
        toast.success("Artigo atualizado!");
      } else {
        await createArticle.mutateAsync(articleData);
        toast.success("Artigo criado!");
      }
      navigate("/admin/articles");
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar artigo");
    }
  };

  return (
    <PageTransition>
    <div>
      <div className="mb-8 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/articles")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-3xl font-bold text-foreground">
          {isEditing ? "Editar Artigo" : "Novo Artigo"}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
        <div className="space-y-2">
          <Label htmlFor="title">Título</Label>
          <Input id="title" value={form.title} onChange={(e) => handleTitleChange(e.target.value)} required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="slug">Slug</Label>
          <Input id="slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="excerpt">Resumo</Label>
          <Textarea id="excerpt" value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} rows={2} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="content">Conteúdo (HTML)</Label>
          <Textarea id="content" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={15} className="font-mono text-sm" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="cover">URL da Imagem de Capa</Label>
          <Input id="cover" value={form.cover_image_url} onChange={(e) => setForm({ ...form, cover_image_url: e.target.value })} />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {categories?.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Rascunho</SelectItem>
                <SelectItem value="published">Publicado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="tags">Tags (separadas por vírgula)</Label>
          <Input id="tags" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="IA, Seguros, Automação" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="meta">Meta Description (SEO)</Label>
          <Textarea id="meta" value={form.meta_description} onChange={(e) => setForm({ ...form, meta_description: e.target.value })} rows={2} />
        </div>

        <Button type="submit" disabled={createArticle.isPending || updateArticle.isPending}>
          <Save className="mr-2 h-4 w-4" />
          {createArticle.isPending || updateArticle.isPending ? "Salvando..." : "Salvar"}
        </Button>
      </form>
    </div>
    </PageTransition>
  );
}
