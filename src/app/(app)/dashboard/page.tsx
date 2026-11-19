import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Banknote, CalendarClock, ClipboardList, FileSignature } from "lucide-react";
import { DeadlineBadge, deadlineCardClass } from "@/components/shared/deadline-badge";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getDashboardSnapshot } from "@/features/dashboard/queries";
import { effectiveBillStatus } from "@/features/bills/queries";
import { requireFinance } from "@/lib/dal";
import { addDays, toDateInputValue } from "@/lib/dates";
import { formatBRL, formatDateOnly } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <DashboardContent />
    </Suspense>
  );
}

async function DashboardContent() {
  await requireFinance();
  const snap = await getDashboardSnapshot();
  const today = toDateInputValue(snap.today);
  const tomorrow = toDateInputValue(addDays(snap.today, 1));
  const in7 = toDateInputValue(addDays(snap.today, 7));

  const cards = [
    {
      title: "Vencem hoje",
      href: `/boletos?status=TO_PAY&from=${today}&to=${today}`,
      count: snap.dueToday._count,
      amount: snap.dueToday._sum.amount,
      icon: AlertTriangle,
      level: "danger" as const,
    },
    {
      title: "Vencem em 7 dias",
      href: `/boletos?status=TO_PAY&from=${tomorrow}&to=${in7}`,
      count: snap.dueSoon._count,
      amount: snap.dueSoon._sum.amount,
      icon: CalendarClock,
      level: "warning" as const,
    },
    {
      title: "Atrasados",
      href: "/boletos?status=OVERDUE",
      count: snap.overdue._count,
      amount: snap.overdue._sum.amount,
      icon: Banknote,
      level: "danger" as const,
    },
    {
      title: "Pago no mês",
      href: "/boletos?status=PAID",
      count: snap.paidThisMonth._count,
      amount: snap.paidThisMonth._sum.paidAmount,
      icon: Banknote,
      level: "ok" as const,
    },
    {
      title: "Chamados pendentes",
      href: "/chamados?status=OPEN",
      count: snap.pendingTickets,
      amount: null,
      extra: `${snap.openTickets} abertos · ${snap.inProgressTickets} em processamento`,
      icon: ClipboardList,
      level: snap.openTickets > 0 ? ("warning" as const) : ("ok" as const),
    },
    {
      title: "Contratos próximos",
      href: "/contratos",
      count: snap.expiringContracts,
      amount: null,
      extra: "Lista de contratos entra na Etapa 7",
      icon: FileSignature,
      level: snap.expiringContracts > 0 ? ("warning" as const) : ("ok" as const),
      placeholder: true,
    },
  ];

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Vencimentos no fuso America/Sao_Paulo. Verde: em dia (mais de 5 dias). Amarelo: até 5 dias. Vermelho: hoje ou atrasado."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((c) => (
          <Link key={c.title} href={c.placeholder ? "/dashboard" : c.href} className="block">
            <Card className={cn("h-full transition-colors hover:bg-muted/40", deadlineCardClass(c.level))}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardDescription>{c.title}</CardDescription>
                <c.icon className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="grid gap-1">
                <CardTitle className="text-3xl tabular-nums">{c.count}</CardTitle>
                {c.amount != null ? (
                  <p className="text-sm font-medium tabular-nums">{formatBRL(c.amount)}</p>
                ) : null}
                {c.extra ? <p className="text-xs text-muted-foreground">{c.extra}</p> : null}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="py-0">
        <CardHeader className="py-4">
          <CardTitle>Alertas de vencimento</CardTitle>
          <CardDescription>Boletos a pagar que vencem hoje, nos próximos 7 dias ou já atrasados.</CardDescription>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vencimento</TableHead>
              <TableHead>Fornecedor</TableHead>
              <TableHead>Setor</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Prazo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {snap.alertBills.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  Nenhum boleto urgente no momento.
                </TableCell>
              </TableRow>
            ) : (
              snap.alertBills.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="tabular-nums">
                    <Link href={`/boletos/${b.id}`} className="text-primary hover:underline">
                      {formatDateOnly(b.dueDate)}
                    </Link>
                  </TableCell>
                  <TableCell>{b.supplier.legalName}</TableCell>
                  <TableCell>
                    {b.sector.name}
                    <span className="ml-1 text-xs text-muted-foreground">{b.sector.costCenter}</span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatBRL(b.amount)}</TableCell>
                  <TableCell>
                    <DeadlineBadge
                      dueDate={b.dueDate}
                      paid={effectiveBillStatus(b, snap.today) === "PAID"}
                      today={snap.today}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
