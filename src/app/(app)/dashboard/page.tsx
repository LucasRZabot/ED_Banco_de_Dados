import type { Metadata } from "next";
import { Building, ShieldCheck, UserRound } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdmin } from "@/lib/dal";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  await requireAdmin();
  const [admins, requesters, sectors] = await Promise.all([
    db.user.count({ where: { role: "ADMIN", active: true } }),
    db.user.count({ where: { role: "REQUESTER", active: true } }),
    db.sector.count({ where: { active: true } }),
  ]);

  const cards = [
    { title: "Administradores ativos", value: admins, icon: ShieldCheck },
    { title: "Chefias ativas", value: requesters, icon: UserRound },
    { title: "Setores ativos", value: sectors, icon: Building },
  ];

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Os cards de boletos, contratos e chamados com alertas de vencimento entram na Etapa 4."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Card key={c.title}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardDescription>{c.title}</CardDescription>
              <c.icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <CardTitle className="text-3xl tabular-nums">{c.value}</CardTitle>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
