import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { PageTransition } from "@/components/ui/page-transition";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { scaleInVariants } from "@/components/ui/animated-card";
import { supabase } from "@/integrations/supabase/client";
import { Clock } from "lucide-react";
import { LivoniusLogo } from "@/components/LivoniusLogo";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [pendingApproval, setPendingApproval] = useState(false);
  const { signIn, resetPassword, signOut } = useAuth();
  const navigate = useNavigate();

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      toast.error("Informe seu email para receber o link de redefinição");
      return;
    }

    const { error } = await resetPassword(email.trim());
    if (error) {
      toast.error("Não foi possível enviar o email de redefinição");
      return;
    }

    toast.success("Enviamos um link de redefinição para seu email");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setPendingApproval(false);

    const { error } = await signIn(email, password);
    
    if (error) {
      toast.error("Email ou senha inválidos");
      setIsLoading(false);
      return;
    }

    // Verificar se tem role admin
    const { data: session } = await supabase.auth.getSession();
    if (!session.session?.user) {
      toast.error("Erro ao verificar sessão");
      setIsLoading(false);
      return;
    }

    const { data: hasAdmin } = await (supabase as any).rpc("mkt_has_role", {
      _user_id: session.session.user.id,
      _role: "admin",
    });

    if (hasAdmin) {
      toast.success("Login realizado com sucesso!");
      navigate("/app");
    } else {
      // Verificar se tem perfil pendente
      const { data: profile } = await supabase
        .from("mkt_profiles")
        .select("is_approved")
        .eq("user_id", session.session.user.id)
        .single();

      if (profile && !profile.is_approved) {
        setPendingApproval(true);
        await signOut();
      } else if (!profile) {
        // Criar perfil se não existir
        await supabase.from("mkt_profiles").insert({
          user_id: session.session.user.id,
          full_name: session.session.user.user_metadata?.full_name || email,
          is_approved: false
        });
        setPendingApproval(true);
        await signOut();
      } else {
        // Perfil aprovado mas sem role - situação anômala
        toast.error("Conta sem permissões. Contate o administrador.");
        await signOut();
      }
    }
    
    setIsLoading(false);
  };

  return (
    <PageTransition>
    <div className="flex min-h-screen items-center justify-center bg-primary p-4">
      <motion.div
        variants={scaleInVariants}
        initial="hidden"
        animate="visible"
        className="w-full max-w-[880px]"
      >
        <Card className="w-full max-w-3xl border-border/50 bg-card">
          <CardHeader className="p-10 text-center">
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              className="mb-6 flex justify-center"
            >
              <LivoniusLogo variant="color" className="h-16 w-auto" />
            </motion.div>
            <CardTitle className="text-4xl text-foreground">Entrar</CardTitle>
            <CardDescription>Acesse sua conta para gerenciar seus conteúdos</CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-10 pt-2 sm:px-12">
            {pendingApproval && (
              <Alert className="mb-6 border-livonius-yellow/50 bg-livonius-yellow/10">
                <Clock className="h-4 w-4 text-livonius-yellow" />
                <AlertDescription className="text-foreground">
                  Sua conta está aguardando aprovação de um administrador. Você receberá acesso assim que for aprovado.
                </AlertDescription>
              </Alert>
            )}
            <form onSubmit={handleSubmit} className="w-full space-y-8">
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3, duration: 0.4 }}
                className="space-y-2"
              >
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                  className="h-12 px-4 text-base"
                />
              </motion.div>
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4, duration: 0.4 }}
                className="space-y-2"
              >
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-12 px-4 text-base"
                />
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto p-0"
                    onClick={handleForgotPassword}
                    disabled={isLoading}
                  >
                    Esqueci minha senha
                  </Button>
                </div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.4 }}
                className="space-y-4"
              >
                <Button type="submit" className="h-12 w-full text-base" disabled={isLoading}>
                  {isLoading ? "Entrando..." : "Entrar"}
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                  Não tem uma conta?{" "}
                  <Link to="/admin/register" className="text-primary hover:underline">
                    Criar conta
                  </Link>
                </p>
              </motion.div>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
    </PageTransition>
  );
}
