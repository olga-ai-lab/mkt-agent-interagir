import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";

import { PageTransition } from "@/components/ui/page-transition";
import { scaleInVariants } from "@/components/ui/animated-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { LivoniusLogo } from "@/components/LivoniusLogo";

export default function AdminResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasRecoverySession, setHasRecoverySession] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!cancelled) setHasRecoverySession(!!data.session);
      })
      .catch(() => {
        if (!cancelled) setHasRecoverySession(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password || password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("As senhas não conferem");
      return;
    }

    setIsLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setIsLoading(false);

    if (error) {
      toast.error("Não foi possível redefinir a senha");
      return;
    }

    toast.success("Senha redefinida! Faça login novamente.");
    await supabase.auth.signOut();
    navigate("/admin/login", { replace: true });
  };

  return (
    <PageTransition>
      <div className="flex min-h-screen items-center justify-center bg-primary p-4">
        <motion.div variants={scaleInVariants} initial="hidden" animate="visible">
          <Card className="w-full max-w-[640px] border-border/50 bg-card">
            <CardHeader className="text-center">
              <motion.div 
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2, duration: 0.4 }}
                className="mb-6 flex justify-center"
              >
                <LivoniusLogo variant="color" className="h-12 w-auto" />
              </motion.div>
              <CardTitle className="text-3xl text-foreground">Redefinir senha</CardTitle>
              <CardDescription>
                {hasRecoverySession === false
                  ? "Abra o link enviado por email para continuar."
                  : "Crie uma nova senha para sua conta."}
              </CardDescription>
            </CardHeader>

            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="new-password">Nova senha</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                    disabled={hasRecoverySession === false}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirmar senha</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                    disabled={hasRecoverySession === false}
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading || hasRecoverySession === false}
                >
                  {isLoading ? "Salvando..." : "Salvar nova senha"}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate("/admin/login")}
                >
                  Voltar para login
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </PageTransition>
  );
}
