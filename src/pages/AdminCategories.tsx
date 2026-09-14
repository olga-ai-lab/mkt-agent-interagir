import { useState } from "react";
import { PageTransition } from "@/components/ui/page-transition";
import { useCategories, useCreateCategory, useDeleteCategory } from "@/hooks/useCategories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function AdminCategories() {
  const [name, setName] = useState("");
  const { data: categories, isLoading } = useCategories();
  const createCategory = useCreateCategory();
  const deleteCategory = useDeleteCategory();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    try {
      await createCategory.mutateAsync({ name, slug });
      toast.success("Categoria criada!");
      setName("");
    } catch {
      toast.error("Erro ao criar categoria");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza?")) return;
    try {
      await deleteCategory.mutateAsync(id);
      toast.success("Categoria excluída!");
    } catch {
      toast.error("Erro ao excluir");
    }
  };

  return (
    <PageTransition>
    <div>
      <h1 className="mb-8 text-3xl font-bold text-foreground">Categorias</h1>
      <form onSubmit={handleCreate} className="mb-8 flex gap-2">
        <Input placeholder="Nome da categoria" value={name} onChange={(e) => setName(e.target.value)} className="max-w-sm" />
        <Button type="submit" disabled={createCategory.isPending}><Plus className="mr-2 h-4 w-4" />Adicionar</Button>
      </form>
      {isLoading ? <div className="h-32 animate-pulse rounded bg-muted" /> : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories?.map((cat) => (
              <TableRow key={cat.id}>
                <TableCell className="font-medium">{cat.name}</TableCell>
                <TableCell className="text-muted-foreground">{cat.slug}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(cat.id)}>
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
