import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, SUPABASE_URL } from "@/integrations/supabase/client";
import { PageTransition } from "@/components/ui/page-transition";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Check, X, Clock, Users, UserCheck, Loader2, KeyRound, ShieldCheck, UserPlus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string | null;
  is_approved: boolean;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
}

const ALL_ROLES = ["admin", "moderator", "user"] as const;

export default function AdminUsers() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedTab, setSelectedTab] = useState("pending");
  const [passwordDialog, setPasswordDialog] = useState<{ userId: string; name: string } | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSettingPassword, setIsSettingPassword] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRoles, setNewUserRoles] = useState<string[]>(["user"]);
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  const { data: profiles, isLoading } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Profile[];
    },
  });

  // Fetch roles for all approved users
  const approvedUserIds = profiles?.filter((p) => p.is_approved).map((p) => p.user_id) || [];
  const { data: userRolesMap = {} } = useQuery({
    queryKey: ["admin-user-roles", approvedUserIds],
    enabled: approvedUserIds.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", approvedUserIds);
      if (error) throw error;
      const map: Record<string, string[]> = {};
      for (const row of data || []) {
        if (!map[row.user_id]) map[row.user_id] = [];
        map[row.user_id].push(row.role);
      }
      return map;
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ profileId, userId }: { profileId: string; userId: string }) => {
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          is_approved: true,
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", profileId);
      if (profileError) throw profileError;

      const { error: roleError } = await (supabase as any)
        .from("user_roles")
        .insert({ user_id: userId, role: "admin" });
      if (roleError && !roleError.message.includes("duplicate")) throw roleError;
    },
    onSuccess: () => {
      toast.success("Usuário aprovado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["admin-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["admin-user-roles"] });
    },
    onError: (error) => toast.error("Erro ao aprovar usuário: " + error.message),
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ userId }: { userId: string }) => {
      const { error } = await supabase.auth.admin.deleteUser(userId);
      if (error) {
        const { error: profileError } = await supabase
          .from("profiles")
          .delete()
          .eq("user_id", userId);
        if (profileError) throw profileError;
      }
    },
    onSuccess: () => {
      toast.success("Usuário rejeitado e removido");
      queryClient.invalidateQueries({ queryKey: ["admin-profiles"] });
    },
    onError: (error) => toast.error("Erro ao rejeitar usuário: " + error.message),
  });

  const revokeMutation = useMutation({
    mutationFn: async ({ profileId, userId }: { profileId: string; userId: string }) => {
      const { error: roleError } = await (supabase as any)
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", "admin");
      if (roleError) throw roleError;

      const { error: profileError } = await supabase
        .from("profiles")
        .update({ is_approved: false, approved_by: null, approved_at: null })
        .eq("id", profileId);
      if (profileError) throw profileError;
    },
    onSuccess: () => {
      toast.success("Acesso revogado");
      queryClient.invalidateQueries({ queryKey: ["admin-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["admin-user-roles"] });
    },
    onError: (error) => toast.error("Erro ao revogar acesso: " + error.message),
  });

  const toggleRoleMutation = useMutation({
    mutationFn: async ({ userId, role, action }: { userId: string; role: string; action: "add" | "remove" }) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/mkt-admin-user-roles`,
        {
          method: action === "add" ? "POST" : "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ user_id: userId, role }),
        }
      );
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Erro ao alterar role");
      }
    },
    onSuccess: () => {
      toast.success("Role atualizada!");
      queryClient.invalidateQueries({ queryKey: ["admin-user-roles"] });
    },
    onError: (error) => toast.error(error.message),
  });

  const handleSetPassword = async () => {
    if (!passwordDialog) return;
    if (newPassword.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }

    setIsSettingPassword(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/mkt-admin-set-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            user_id: passwordDialog.userId,
            new_password: newPassword,
          }),
        }
      );
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Erro ao redefinir senha");
      }
      toast.success("Senha redefinida com sucesso!");
      setPasswordDialog(null);
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSettingPassword(false);
    }
  };

  const handleAddUser = async () => {
    if (!newUserEmail) { toast.error("Email é obrigatório"); return; }
    if (newUserPassword.length < 6) { toast.error("A senha deve ter pelo menos 6 caracteres"); return; }
    if (newUserRoles.length === 0) { toast.error("Selecione ao menos uma role"); return; }

    setIsCreatingUser(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/mkt-admin-create-user`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            email: newUserEmail,
            password: newUserPassword,
            full_name: newUserName || null,
            roles: newUserRoles,
          }),
        }
      );
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Erro ao criar usuário");
      }
      toast.success("Usuário criado com sucesso!");
      setShowAddUser(false);
      setNewUserEmail("");
      setNewUserName("");
      setNewUserPassword("");
      setNewUserRoles(["user"]);
      queryClient.invalidateQueries({ queryKey: ["admin-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["admin-user-roles"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsCreatingUser(false);
    }
  };

  const pendingUsers = profiles?.filter((p) => !p.is_approved) || [];
  const approvedUsers = profiles?.filter((p) => p.is_approved) || [];

  const getInitials = (name: string | null) => {
    if (!name) return "??";
    return name.slice(0, 2).toUpperCase();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <PageTransition>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Gerenciar Usuários</h1>
            <p className="text-muted-foreground">
              Aprove novos usuários e gerencie acessos existentes
            </p>
          </div>
          <Button onClick={() => setShowAddUser(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Adicionar Usuário
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <div className="flex flex-row items-center justify-between space-y-0 p-6 pb-2">
              <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
            <CardContent>
              <div className="text-2xl font-bold">{pendingUsers.length}</div>
              <p className="text-xs text-muted-foreground">usuários aguardando aprovação</p>
            </CardContent>
          </Card>
          <Card>
            <div className="flex flex-row items-center justify-between space-y-0 p-6 pb-2">
              <CardTitle className="text-sm font-medium">Aprovados</CardTitle>
              <UserCheck className="h-4 w-4 text-muted-foreground" />
            </div>
            <CardContent>
              <div className="text-2xl font-bold">{approvedUsers.length}</div>
              <p className="text-xs text-muted-foreground">usuários com acesso ativo</p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList>
            <TabsTrigger value="pending" className="gap-2">
              <Clock className="h-4 w-4" />
              Pendentes
              {pendingUsers.length > 0 && (
                <Badge variant="destructive" className="ml-1">{pendingUsers.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="approved" className="gap-2">
              <Users className="h-4 w-4" />
              Aprovados
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-4">
            {pendingUsers.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Clock className="h-12 w-12 text-muted-foreground/50" />
                  <h3 className="mt-4 text-lg font-semibold">Nenhum usuário pendente</h3>
                  <p className="text-muted-foreground">Todos os cadastros foram processados</p>
                </CardContent>
              </Card>
            ) : (
              pendingUsers.map((profile) => (
                <Card key={profile.id}>
                  <CardContent className="flex items-center justify-between p-6">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={profile.avatar_url || undefined} />
                        <AvatarFallback>{getInitials(profile.full_name)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="font-semibold">{profile.full_name || "Sem nome"}</h3>
                        <p className="text-sm text-muted-foreground">
                          Cadastrado em {formatDate(profile.created_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => approveMutation.mutate({ profileId: profile.id, userId: profile.user_id })}
                        disabled={approveMutation.isPending}
                      >
                        <Check className="mr-1 h-4 w-4" />
                        Aprovar
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="destructive" disabled={rejectMutation.isPending}>
                            <X className="mr-1 h-4 w-4" />
                            Rejeitar
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Rejeitar usuário?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta ação irá remover permanentemente o cadastro de{" "}
                              <strong>{profile.full_name}</strong>. Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => rejectMutation.mutate({ userId: profile.user_id })}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Rejeitar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="approved" className="space-y-4">
            {approvedUsers.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Users className="h-12 w-12 text-muted-foreground/50" />
                  <h3 className="mt-4 text-lg font-semibold">Nenhum usuário aprovado</h3>
                  <p className="text-muted-foreground">Aprove usuários pendentes para vê-los aqui</p>
                </CardContent>
              </Card>
            ) : (
              approvedUsers.map((profile) => {
                const roles = userRolesMap[profile.user_id] || [];
                return (
                  <Card key={profile.id}>
                    <CardContent className="flex items-center justify-between p-6">
                      <div className="flex items-center gap-4">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={profile.avatar_url || undefined} />
                          <AvatarFallback>{getInitials(profile.full_name)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold">{profile.full_name || "Sem nome"}</h3>
                            {roles.map((r) => (
                              <Badge key={r} variant="secondary" className="text-xs">
                                {r}
                              </Badge>
                            ))}
                          </div>
                          {profile.approved_at && (
                            <p className="text-sm text-muted-foreground">
                              Aprovado em {formatDate(profile.approved_at)}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {/* Role management */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="outline">
                              <ShieldCheck className="mr-1 h-4 w-4" />
                              Roles
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            {ALL_ROLES.map((role) => {
                              const hasRole = roles.includes(role);
                              return (
                                <DropdownMenuItem
                                  key={role}
                                  onClick={() =>
                                    toggleRoleMutation.mutate({
                                      userId: profile.user_id,
                                      role,
                                      action: hasRole ? "remove" : "add",
                                    })
                                  }
                                >
                                  <span className={hasRole ? "font-semibold" : ""}>
                                    {hasRole ? "✓ " : "  "}{role}
                                  </span>
                                </DropdownMenuItem>
                              );
                            })}
                          </DropdownMenuContent>
                        </DropdownMenu>

                        {/* Reset password */}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setPasswordDialog({
                              userId: profile.user_id,
                              name: profile.full_name || "usuário",
                            })
                          }
                        >
                          <KeyRound className="mr-1 h-4 w-4" />
                          Senha
                        </Button>

                        {/* Revoke access */}
                        {profile.user_id !== user?.id && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="outline" disabled={revokeMutation.isPending}>
                                Revogar
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Revogar acesso?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  <strong>{profile.full_name}</strong> perderá o acesso ao painel administrativo.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() =>
                                    revokeMutation.mutate({ profileId: profile.id, userId: profile.user_id })
                                  }
                                >
                                  Revogar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Add User Dialog */}
      <Dialog open={showAddUser} onOpenChange={(open) => { if (!open) { setShowAddUser(false); setNewUserEmail(""); setNewUserName(""); setNewUserPassword(""); setNewUserRoles(["user"]); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Usuário</DialogTitle>
            <DialogDescription>
              Crie um novo usuário manualmente com acesso imediato.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="add-email">Email *</Label>
              <Input
                id="add-email"
                type="email"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                placeholder="usuario@exemplo.com"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="add-name">Nome completo</Label>
              <Input
                id="add-name"
                type="text"
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                placeholder="Nome do usuário (opcional)"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="add-password">Senha *</Label>
              <Input
                id="add-password"
                type="password"
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Roles *</Label>
              <div className="flex gap-3 mt-2 flex-wrap">
                {ALL_ROLES.map((role) => {
                  const checked = newUserRoles.includes(role);
                  return (
                    <label key={role} className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setNewUserRoles((prev) =>
                            checked ? prev.filter((r) => r !== role) : [...prev, role]
                          )
                        }
                        className="accent-primary"
                      />
                      <Badge variant={checked ? "default" : "secondary"} className="text-xs">
                        {role}
                      </Badge>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddUser(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddUser} disabled={isCreatingUser}>
              {isCreatingUser && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar Usuário
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password Reset Dialog */}
      <Dialog open={!!passwordDialog} onOpenChange={(open) => !open && setPasswordDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redefinir Senha</DialogTitle>
            <DialogDescription>
              Definir nova senha para <strong>{passwordDialog?.name}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="admin-new-pw">Nova Senha</Label>
              <Input
                id="admin-new-pw"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="admin-confirm-pw">Confirmar Senha</Label>
              <Input
                id="admin-confirm-pw"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a nova senha"
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordDialog(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSetPassword} disabled={isSettingPassword}>
              {isSettingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Redefinir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
}
