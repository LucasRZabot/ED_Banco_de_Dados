import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

export default function LoginPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Entrar</CardTitle>
        <CardDescription>
          Acesso restrito à TI, à coordenação financeira e às chefias de setor.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Suspense>
          <LoginForm />
        </Suspense>
        <p className="mt-4 text-xs text-muted-foreground">
          Não tem acesso ou esqueceu a senha? Fale com o Faturamento/Compras.
        </p>
      </CardContent>
    </Card>
  );
}
