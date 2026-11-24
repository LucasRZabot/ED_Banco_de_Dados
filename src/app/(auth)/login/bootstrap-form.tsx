"use client";

import { useActionState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/shared/field-error";
import { useHardRedirect } from "@/hooks/use-hard-redirect";
import { bootstrapFirstAdmin } from "../actions";

export function BootstrapAdminForm() {
  const [state, action, pending] = useActionState(bootstrapFirstAdmin, undefined);
  useHardRedirect(state?.redirectTo);

  return (
    <form action={action} className="grid gap-4">
      {state?.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="grid gap-2">
        <Label htmlFor="name">Nome</Label>
        <Input id="name" name="name" autoComplete="name" required autoFocus />
        <FieldError messages={state?.fieldErrors?.name} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" name="email" type="email" autoComplete="username" required />
        <FieldError messages={state?.fieldErrors?.email} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="password">Senha</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" required />
        <FieldError messages={state?.fieldErrors?.password} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="confirmPassword">Confirmar senha</Label>
        <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required />
        <FieldError messages={state?.fieldErrors?.confirmPassword} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="setupSecret">Código de setup (TI)</Label>
        <Input
          id="setupSecret"
          name="setupSecret"
          type="password"
          autoComplete="off"
          required
        />
        <FieldError messages={state?.fieldErrors?.setupSecret} />
      </div>
      <Button type="submit" disabled={pending || !!state?.redirectTo} className="w-full">
        {pending || state?.redirectTo ? "Criando…" : "Criar administrador de TI"}
      </Button>
    </form>
  );
}
