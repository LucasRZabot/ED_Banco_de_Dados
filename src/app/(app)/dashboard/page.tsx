import type { Metadata } from "next";
import { ClipboardList, Loader, Receipt } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireFinance } from "@/lib/dal";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  await requireFinance();
  const [openTickets, inProgress, pendingInvoices] = await Promise.all([
    db.ticket.count({ where: { status: "OPEN" } }),
    db.ticket.count({ where: { status: "IN_PROGRESS" } }),
    db.invoice.count({ where: { status: "PENDING" } }),
  ]);

  const cards = [
    { title: "Chamados aguardando avaliação", value: openTickets, icon: ClipboardList },
    { title: "Chamados em processamento", value: inProgress, icon: Loader },
    { title: "Notas aguardando lançamento", value: pendingInvoices, icon: Receipt },
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
