import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
  let needsBootstrap = false;
  try {
    needsBootstrap = (await db.user.count()) === 0;
  } catch {
    needsBootstrap = false;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{needsBootstrap ? "Primeiro acesso (TI)" : "Entrar"}</CardTitle>
        <CardDescription>
          {needsBootstrap
            ? "Nenhuma conta no banco. Crie o administrador de TI; depois cadastre as demais pessoas em Administração → Usuários."
            : "Acesso restrito à TI, à coordenação financeira e às chefias de setor."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {needsBootstrap ? (
          <BootstrapAdminForm />
        ) : (
          <Suspense>
            <LoginForm />
          </Suspense>
        )}
        {needsBootstrap ? null : (
          <p className="mt-4 text-xs text-muted-foreground">
            Não tem acesso ou esqueceu a senha? Fale com a TI (ADMIN), que cria a conta e redefine a senha.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
