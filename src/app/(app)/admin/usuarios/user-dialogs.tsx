"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Copy, KeyRound, MoreHorizontal, Pencil, Power, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { FieldError } from "@/components/shared/field-error";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { ROLE_LABELS, ROLES, type AppRole } from "@/lib/roles";
import { createUser, resetUserPassword, setUserActive, updateUser } from "./actions";

export type SectorOption = { id: string; name: string; costCenter: string };
export type UserRow = {
  id: string;
  name: string | null;
  email: string;
  role: AppRole;
  sectorId: string | null;
  active: boolean;
};

function TemporaryPassword({ email, password }: { email: string; password: string }) {
  return (
    <Alert>
      <KeyRound />
      <AlertTitle>Senha provisória de {email}</AlertTitle>
      <AlertDescription className="grid gap-2">
        <div className="flex items-center gap-2">
          <code className="rounded bg-muted px-2 py-1 font-mono text-sm text-foreground">{password}</code>
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            aria-label="Copiar senha"
            onClick={() => navigator.clipboard.writeText(password).then(() => toast.success("Senha copiada."))}
          >
            <Copy />
          </Button>
        </div>
        <span>
          Ela não será exibida novamente. Entregue-a à pessoa por um canal seguro. Não entre com esta
          conta: a TI não acessa lançamentos. A pessoa será obrigada a trocar a senha no primeiro acesso.
        </span>
      </AlertDescription>
    </Alert>
  );
}

function UserForm({
  user,
  sectors,
  onDone,
}: {
  user?: UserRow;
  sectors: SectorOption[];
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(user ? updateUser : createUser, undefined);
  const [role, setRole] = useState<AppRole>(user?.role ?? "REQUESTER");
  const errors = state?.fieldErrors;

  useEffect(() => {
    if (state?.ok && user) {
      toast.success("Usuário atualizado.");
      onDone();
    }
    if (state?.ok && !user) toast.success("Usuário criado.");
  }, [state, user, onDone]);

  if (state?.ok && state.temporaryPassword && state.email) {
    return (
      <div className="grid gap-4">
        <TemporaryPassword email={state.email} password={state.temporaryPassword} />
        <DialogFooter>
          <Button onClick={onDone}>Concluir</Button>
        </DialogFooter>
      </div>
    );
  }

  return (
    <form action={action} className="grid gap-4">
      {user ? <input type="hidden" name="id" value={user.id} /> : null}
      {state?.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="grid gap-2">
        <Label htmlFor="name">Nome</Label>
        <Input id="name" name="name" defaultValue={user?.name ?? ""} required />
        <FieldError messages={errors?.name} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" name="email" type="email" defaultValue={user?.email ?? ""} required />
        <FieldError messages={errors?.email} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="role">Perfil</Label>
        <NativeSelect
          id="role"
          name="role"
          className="w-full"
          value={role}
          onChange={(e) => setRole(e.target.value as AppRole)}
        >
          {ROLES.map((r) => (
            <NativeSelectOption key={r} value={r}>
              {ROLE_LABELS[r]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="sectorId">Setor {role === "REQUESTER" ? "(obrigatório para chefia)" : "(opcional)"}</Label>
        <NativeSelect
          id="sectorId"
          name="sectorId"
          className="w-full"
          defaultValue={user?.sectorId ?? ""}
          required={role === "REQUESTER"}
        >
          <NativeSelectOption value="">Selecione…</NativeSelectOption>
          {sectors.map((s) => (
            <NativeSelectOption key={s.id} value={s.id}>
              {s.name} ({s.costCenter})
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <FieldError messages={errors?.sectorId} />
      </div>
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando…" : user ? "Salvar alterações" : "Criar usuário"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function UserFormDialog({
  open,
  onOpenChange,
  user,
  sectors,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: UserRow;
  sectors: SectorOption[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{user ? "Editar usuário" : "Novo usuário"}</DialogTitle>
          <DialogDescription>
            {user
              ? "Alterações de perfil e setor valem a partir da próxima requisição do usuário."
              : "Uma senha provisória será gerada. Envie-a ao usuário por um canal seguro."}
          </DialogDescription>
        </DialogHeader>
        {/* Remonta a cada abertura para limpar o estado do formulário. */}
        {open ? <UserForm user={user} sectors={sectors} onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

export function CreateUserButton({ sectors }: { sectors: SectorOption[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <UserPlus />
        Novo usuário
      </Button>
      <UserFormDialog open={open} onOpenChange={setOpen} sectors={sectors} />
    </>
  );
}

export function UserRowActions({ user, sectors, isSelf }: { user: UserRow; sectors: SectorOption[]; isSelf: boolean }) {
  const [editOpen, setEditOpen] = useState(false);
  const [reset, setReset] = useState<{ email: string; password: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const toggleActive = () =>
    startTransition(async () => {
      const res = await setUserActive(user.id, !user.active);
      if (res?.error) toast.error(res.error);
      else toast.success(user.active ? "Usuário desativado." : "Usuário reativado.");
    });

  const resetPassword = () =>
    startTransition(async () => {
      const res = await resetUserPassword(user.id);
      if (res?.temporaryPassword && res.email) setReset({ email: res.email, password: res.temporaryPassword });
    });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon-sm" aria-label={`Ações para ${user.email}`} disabled={pending} />}
        >
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44">
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            <Pencil />
            Editar
          </DropdownMenuItem>
          <DropdownMenuItem onClick={resetPassword}>
            <KeyRound />
            Redefinir senha
          </DropdownMenuItem>
          {!isSelf ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant={user.active ? "destructive" : "default"} onClick={toggleActive}>
                <Power />
                {user.active ? "Desativar" : "Reativar"}
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <UserFormDialog open={editOpen} onOpenChange={setEditOpen} user={user} sectors={sectors} />

      <Dialog open={!!reset} onOpenChange={(o) => !o && setReset(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Senha redefinida</DialogTitle>
          </DialogHeader>
          {reset ? <TemporaryPassword email={reset.email} password={reset.password} /> : null}
          <DialogFooter>
            <Button onClick={() => setReset(null)}>Concluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
