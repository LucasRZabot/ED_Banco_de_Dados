import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/dal";
import { ChangePasswordForm } from "./change-password-form";

export const metadata: Metadata = { title: "Alterar senha" };

export default function ChangePasswordPage() {
  return (
    <Card>
      <Suspense fallback={<Skeleton className="m-6 h-64" />}>
        <ChangePasswordCard />
      </Suspense>
    </Card>
  );
}

async function ChangePasswordCard() {
  const user = await requireUser({ allowPendingPassword: true });
  return (
    <>
      <CardHeader>
        <CardTitle>Alterar senha</CardTitle>
        <CardDescription>
          {user.mustChangePassword
            ? `Olá, ${user.name ?? user.email}. Defina uma senha pessoal para continuar.`
            : "Defina uma nova senha de acesso."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChangePasswordForm canCancel={!user.mustChangePassword} />
      </CardContent>
    </>
  );
}
