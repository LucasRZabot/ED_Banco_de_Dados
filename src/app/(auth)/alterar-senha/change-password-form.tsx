"use client";

import { useActionState } from "react";
import { FieldError } from "@/components/shared/field-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { hardNavigate, logoutAndReload, useHardRedirect } from "@/hooks/use-hard-redirect";
import { changePassword, logout } from "../actions";

export function ChangePasswordForm({ canCancel }: { canCancel: boolean }) {
  const [state, action, pending] = useActionState(changePassword, undefined);
  useHardRedirect(state?.redirectTo);
  const errors = state?.fieldErrors;

  return (
    <div className="grid gap-4">
      <form action={action} className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="currentPassword">Senha atual</Label>
          <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required />
          <FieldError messages={errors?.currentPassword} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="newPassword">Nova senha</Label>
          <Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" required />
          <p className="text-xs text-muted-foreground">Mínimo de 10 caracteres, com letras e números.</p>
          <FieldError messages={errors?.newPassword} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
          <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required />
          <FieldError messages={errors?.confirmPassword} />
        </div>
        <Button type="submit" disabled={pending || !!state?.redirectTo}>
          {pending || state?.redirectTo ? "Salvando…" : "Salvar nova senha"}
        </Button>
      </form>
      {canCancel ? (
        <Button variant="ghost" onClick={() => hardNavigate("/")}>
          Voltar
        </Button>
      ) : (
        <Button variant="ghost" className="w-full" onClick={() => logoutAndReload(logout)}>
          Sair
        </Button>
      )}
    </div>
  );
}
