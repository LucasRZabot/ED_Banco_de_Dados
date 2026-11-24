import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { configuredBootstrapSecret } from "@/lib/bootstrap-secret";
import { db } from "@/lib/db";
import { BootstrapAdminForm } from "./bootstrap-form";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

export default function LoginPage() {
  return (
    <Suspense fallback={<Skeleton className="h-80" />}>
      <LoginCard />
    </Suspense>
  );
}

async function LoginCard() {
  let emptyUsers = false;
  try {
    emptyUsers = (await db.user.count()) === 0;
  } catch {
    emptyUsers = false;
  }
  const setupReady = Boolean(configuredBootstrapSecret());
  const needsBootstrap = emptyUsers && setupReady;
  const setupBlocked = emptyUsers && !setupReady;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{needsBootstrap ? "Primeiro acesso (TI)" : "Entrar"}</CardTitle>
        <CardDescription>
          {setupBlocked
            ? "Banco vazio. A TI precisa configurar BOOTSTRAP_SECRET no host antes de criar o primeiro ADMIN."
            : needsBootstrap
              ? "Nenhuma conta no banco. A TI completa o setup com o código de uma vez; depois cadastre as demais pessoas em Administração → Usuários."
              : "Acesso restrito à TI, à coordenação financeira e às chefias de setor."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {needsBootstrap ? (
          <BootstrapAdminForm />
        ) : setupBlocked ? null : (
          <Suspense>
            <LoginForm />
          </Suspense>
        )}
        {needsBootstrap || setupBlocked ? null : (
          <p className="mt-4 text-xs text-muted-foreground">
            Não tem acesso ou esqueceu a senha? Fale com a TI (ADMIN), que cria a conta e redefine a senha.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
