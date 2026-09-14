import { useState } from "react";
import { Link } from "react-router-dom";
import { PageTransition } from "@/components/ui/page-transition";
import { useAllArticles, useDeleteArticle } from "@/hooks/useArticles";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export default function AdminArticles() {
  const { data: articles, isLoading } = useAllArticles();
  const deleteArticle = useDeleteArticle();

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este artigo?")) return;
    try {
      await deleteArticle.mutateAsync(id);
      toast.success("Artigo excluído!");
    } catch {
      toast.error("Erro ao excluir artigo");
    }
  };

  return (
    <PageTransition>
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">Artigos</h1>
        <Link to="/admin/articles/new">
          <Button><Plus className="mr-2 h-4 w-4" /> Novo Artigo</Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="animate-pulse space-y-4">
          {[...Array(5)].map((_, i) => <div key={i} className="h-16 rounded bg-muted" />)}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Título</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Views</TableHead>
              <TableHead>Data</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {articles?.map((article) => (
              <TableRow key={article.id}>
                <TableCell className="font-medium">{article.title}</TableCell>
                <TableCell>
                  <Badge variant={article.status === "published" ? "default" : "secondary"}>
                    {article.status === "published" ? "Publicado" : "Rascunho"}
                  </Badge>
                </TableCell>
                <TableCell>{article.categories?.name || "-"}</TableCell>
                <TableCell>{article.view_count}</TableCell>
                <TableCell>{format(new Date(article.created_at), "dd/MM/yyyy")}</TableCell>
                <TableCell className="text-right">
                  <Link to={`/admin/articles/${article.id}`}>
                    <Button variant="ghost" size="icon"><Pencil className="h-4 w-4" /></Button>
                  </Link>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(article.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
    </PageTransition>
  );
}
