"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useHardRedirect } from "@/hooks/use-hard-redirect";
import { login } from "../actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);
  useHardRedirect(state?.redirectTo);
  const searchParams = useSearchParams();
  const expired = searchParams.get("expirada") === "1";

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="callbackUrl" value={searchParams.get("callbackUrl") ?? ""} />
      {state?.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : expired ? (
        <Alert>
          <AlertDescription>Sua sessão expirou ou a conta foi alterada. Entre novamente.</AlertDescription>
        </Alert>
      ) : null}
      <div className="grid gap-2">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" name="email" type="email" autoComplete="username" required autoFocus />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="password">Senha</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      <Button type="submit" disabled={pending || !!state?.redirectTo} className="w-full">
        {pending || state?.redirectTo ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}
