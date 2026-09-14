import { useState } from "react";
import { motion } from "framer-motion";
import { Send, CheckCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function BlogCTA() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsLoading(true);
    try {
      const { error } = await supabase.from("mkt_newsletter_subscribers").insert({
        email,
        source: "blog_cta",
      });

      if (error) {
        if (error.code === "23505") {
          toast.info("Este e-mail já está cadastrado!");
        } else {
          throw error;
        }
      } else {
        setIsSubscribed(true);
        toast.success("Inscrição realizada com sucesso!");
        setEmail("");
      }
    } catch (error) {
      console.error("Newsletter subscription error:", error);
      toast.error("Erro ao realizar inscrição. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.section
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="bg-gradient-to-r from-primary to-sky-600 py-16"
    >
      <div className="container max-w-6xl text-center">
        <h2 className="mb-3 text-2xl font-bold text-white md:text-3xl">
          Quer receber nossos artigos por e-mail?
        </h2>
        <p className="mx-auto mb-8 max-w-lg text-sm text-white/80 md:text-base">
          Inscreva-se em nossa newsletter e fique atualizado com as tendências do mercado de seguros.
        </p>

        {isSubscribed ? (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex items-center justify-center gap-2 text-white"
          >
            <CheckCircle className="h-5 w-5" />
            <span className="font-medium">Obrigado! Você está inscrito.</span>
          </motion.div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="mx-auto flex max-w-md flex-col gap-3 sm:flex-row"
          >
            <Input
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="border-white/20 bg-white/10 text-white placeholder:text-white/60 focus-visible:ring-white"
            />
            <Button
              type="submit"
              disabled={isLoading}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {isLoading ? (
                "Inscrevendo..."
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Inscrever
                </>
              )}
            </Button>
          </form>
        )}
      </div>
    </motion.section>
  );
}
