import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useSubscribeNewsletter } from "@/hooks/useNewsletter";
import { toast } from "sonner";
import { Mail } from "lucide-react";

export function NewsletterForm() {
  const [email, setEmail] = useState("");
  const subscribe = useSubscribeNewsletter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    try {
      await subscribe.mutateAsync(email);
      toast.success("Inscrição realizada com sucesso!");
      setEmail("");
    } catch (error: any) {
      toast.error(error.message || "Erro ao se inscrever. Tente novamente.");
    }
  };

  return (
    <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 p-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20">
          <Mail className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">Newsletter</h3>
          <p className="text-sm text-muted-foreground">Receba novidades sobre IA e seguros</p>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          type="email"
          placeholder="seu@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1 border-border/50 bg-background"
          required
        />
        <Button type="submit" disabled={subscribe.isPending}>
          {subscribe.isPending ? "..." : "Inscrever"}
        </Button>
      </form>
    </div>
  );
}
