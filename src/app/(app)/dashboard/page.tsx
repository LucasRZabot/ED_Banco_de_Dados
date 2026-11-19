import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  AlertTriangle,
  Banknote,
  CalendarClock,
  ClipboardList,
  FileSearch,
  FileSignature,
  FileText,
  Receipt,
} from "lucide-react";
import { DeadlineBadge, deadlineCardClass } from "@/components/shared/deadline-badge";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listSectorsForBills, listSuppliersForBills, effectiveBillStatus } from "@/features/bills/queries";
import { DashboardFiltersBar } from "@/features/dashboard/components/dashboard-filters";
import { DashboardNotifications } from "@/features/dashboard/components/dashboard-notifications";
import { clampYmdRange, parseDashboardFilters, relevantLists, withQuery } from "@/features/dashboard/filters";
import { getDashboardSnapshot } from "@/features/dashboard/queries";
import { InvoiceStatusBadge } from "@/features/invoices/components/status-badge";
import { listNotifications } from "@/features/notifications/queries";
import { QuoteStatusBadge } from "@/features/quotes/components/status-badge";
import { TicketStatusBadge } from "@/features/tickets/components/status-badge";
import { URGENCY_LABELS } from "@/features/tickets/labels";
import { requireFinance } from "@/lib/dal";
import { addDays, toDateInputValue } from "@/lib/dates";
import type { DeadlineLevel } from "@/lib/deadlines";
import { formatBRL, formatDateOnly, ticketCode } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <DashboardContent searchParams={searchParams} />
    </Suspense>
  );
}

async function DashboardContent({ searchParams }: { searchParams: PageProps<"/dashboard">["searchParams"] }) {
  const user = await requireFinance();
  const raw = await searchParams;
  const filters = parseDashboardFilters(raw);
  const [snap, notifications, sectors, suppliers] = await Promise.all([
    getDashboardSnapshot(filters),
    listNotifications(user, 8),
    listSectorsForBills(),
    listSuppliersForBills(),
  ]);

  const today = toDateInputValue(snap.today);
  const tomorrow = toDateInputValue(addDays(snap.today, 1));
  const in7 = toDateInputValue(addDays(snap.today, 7));
  const lists = relevantLists(filters.status);
  const scope = { supplierId: filters.supplierId, sectorId: filters.sectorId };
  const todayRange = clampYmdRange(today, today, filters.from, filters.to);
  const soonRange = clampYmdRange(tomorrow, in7, filters.from, filters.to);

  const cards: {
    title: string;
    href: string;
    count: number;
    amount: { toString(): string } | string | number | null;
    extra?: string;
    icon: typeof AlertTriangle;
    level: DeadlineLevel;
  }[] = [
    {
      title: "Vencem hoje",
      href: withQuery("/boletos", { status: "TO_PAY", from: todayRange?.from ?? today, to: todayRange?.to ?? today, ...scope }),
      count: snap.dueToday._count,
      amount: snap.dueToday._sum.amount,
      icon: AlertTriangle,
      level: snap.dueToday._count > 0 ? "danger" : "ok",
    },
    {
      title: "Vencem em 7 dias",
      href: withQuery("/boletos", { status: "TO_PAY", from: soonRange?.from ?? tomorrow, to: soonRange?.to ?? in7, ...scope }),
      count: snap.dueSoon._count,
      amount: snap.dueSoon._sum.amount,
      icon: CalendarClock,
      level: snap.dueSoon._count > 0 ? "warning" : "ok",
    },
    {
      title: "Atrasados",
      href: withQuery("/boletos", { status: "OVERDUE", from: filters.from, to: filters.to, ...scope }),
      count: snap.overdue._count,
      amount: snap.overdue._sum.amount,
      icon: Banknote,
      level: snap.overdue._count > 0 ? "danger" : "ok",
    },
    {
      title: "Contratos próximos",
      href: withQuery("/contratos", { expiring: filters.from || filters.to ? undefined : "1", status: "ACTIVE", from: filters.from, to: filters.to, ...scope }),
      count: snap.expiringContracts,
      amount: null,
      extra:
        snap.expiringContracts === 0
          ? "Nenhum vence ou renova no recorte"
          : snap.expiringContractItems
              .slice(0, 2)
              .map((c) => c.supplier.legalName)
              .join(" · "),
      icon: FileSignature,
      level: snap.expiringContracts > 0 ? "warning" : "ok",
    },
    {
      title: "Chamados pendentes",
      href: withQuery("/chamados", { status: "OPEN", from: filters.from, to: filters.to, sectorId: filters.sectorId }),
      count: snap.pendingTickets,
      amount: null,
      extra: `${snap.openTickets} abertos · ${snap.inProgressTickets} em processamento${
        snap.criticalTickets || snap.highTickets
          ? ` · ${snap.criticalTickets} críticos · ${snap.highTickets} alta`
          : ""
      }`,
      icon: ClipboardList,
      level: snap.criticalTickets > 0 ? "danger" : snap.pendingTickets > 0 ? "warning" : "ok",
    },
    {
      title: "NFs pendentes",
      href: withQuery("/notas-fiscais", { status: "PENDING", from: filters.from, to: filters.to, ...scope }),
      count: snap.pendingInvoices,
      amount: snap.pendingInvoiceAmount,
      extra: "Aguardando lançamento",
      icon: FileText,
      level: snap.pendingInvoices > 0 ? "warning" : "ok",
    },
    {
      title: "Orçamentos pendentes",
      href: withQuery("/orcamentos", { status: "PENDING", from: filters.from, to: filters.to, supplierId: filters.supplierId }),
      count: snap.pendingQuotes,
      amount: snap.pendingQuoteAmount,
      icon: FileSearch,
      level: snap.pendingQuotes > 0 ? "warning" : "ok",
    },
    {
      title: "NFs lançadas no mês",
      href: withQuery("/notas-fiscais", { status: "POSTED", from: filters.from, to: filters.to, ...scope }),
      count: snap.postedThisMonth,
      amount: snap.postedThisMonthAmount,
      extra: filters.from || filters.to ? "No período filtrado" : "Mês civil em America/Sao_Paulo",
      icon: Receipt,
      level: "ok",
    },
  ];

  const showBills = lists.has("bills") && filters.status !== "BILL_PAID";
  const showPaid = lists.has("bills") && (filters.status === "BILL_PAID" || !filters.status);
  const showInvoices = lists.has("invoices");
  const showContracts = lists.has("contracts");
  const showTickets = lists.has("tickets");
  const showQuotes = lists.has("quotes");

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Coordenação financeira. Verde: em dia. Amarelo: atenção (até 5 dias). Vermelho: hoje, atrasado ou crítico. Chefia e TI não acessam esta tela."
      />

      <DashboardNotifications items={notifications} />
      <DashboardFiltersBar filters={filters} sectors={sectors} suppliers={suppliers} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.title} href={c.href} className="block">
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

      {showBills ? (
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
                    Nenhum boleto urgente no recorte.
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
      ) : null}

      {showPaid && filters.status === "BILL_PAID" ? (
        <Card className="py-0">
          <CardHeader className="py-4">
            <CardTitle>Boletos pagos</CardTitle>
            <CardDescription>Baixas no período filtrado (ou no mês corrente).</CardDescription>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pagamento</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Setor</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {snap.paidBillItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                    Nenhum boleto pago no recorte.
                  </TableCell>
                </TableRow>
              ) : (
                snap.paidBillItems.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="tabular-nums">
                      <Link href={`/boletos/${b.id}`} className="text-primary hover:underline">
                        {formatDateOnly(b.paidAt)}
                      </Link>
                    </TableCell>
                    <TableCell>{b.supplier.legalName}</TableCell>
                    <TableCell>
                      {b.sector.name}
                      <span className="ml-1 text-xs text-muted-foreground">{b.sector.costCenter}</span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatBRL(b.paidAmount ?? b.amount)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {showInvoices ? (
          <Card className="py-0">
            <CardHeader className="py-4">
              <CardTitle>NFs pendentes de lançamento</CardTitle>
              <CardDescription>Notas enviadas pela chefia ainda sem lançamento.</CardDescription>
            </CardHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Setor</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {snap.pendingInvoiceItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                      Nenhuma NF pendente no recorte.
                    </TableCell>
                  </TableRow>
                ) : (
                  snap.pendingInvoiceItems.map((n) => (
                    <TableRow key={n.id}>
                      <TableCell>
                        <Link href={`/notas-fiscais/${n.id}`} className="text-primary hover:underline">
                          {n.description}
                        </Link>
                        <p className="text-xs text-muted-foreground">{n.supplier?.legalName ?? "Sem fornecedor"}</p>
                      </TableCell>
                      <TableCell>
                        {n.sector.name}
                        <span className="ml-1 text-xs text-muted-foreground">{n.sector.costCenter}</span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatBRL(n.amount)}</TableCell>
                      <TableCell>
                        <InvoiceStatusBadge status="PENDING" />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        ) : null}

        {showContracts ? (
          <Card className="py-0">
            <CardHeader className="py-4">
              <CardTitle>Contratos próximos de vencimento</CardTitle>
              <CardDescription>Término ou renovação no recorte (padrão: 30 dias).</CardDescription>
            </CardHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contrato</TableHead>
                  <TableHead>Setor</TableHead>
                  <TableHead>Prazo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {snap.expiringContractItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                      Nenhum contrato vence ou renova no recorte.
                    </TableCell>
                  </TableRow>
                ) : (
                  snap.expiringContractItems.map((c) => {
                    const due = c.renewalDate && (!c.endDate || c.renewalDate <= c.endDate) ? c.renewalDate : c.endDate;
                    return (
                      <TableRow key={c.id}>
                        <TableCell>
                          <Link href={`/contratos/${c.id}`} className="text-primary hover:underline">
                            {c.supplier.legalName}
                          </Link>
                          <p className="text-xs text-muted-foreground">{c.object}</p>
                        </TableCell>
                        <TableCell>
                          {c.sector.name}
                          <span className="ml-1 text-xs text-muted-foreground">{c.sector.costCenter}</span>
                        </TableCell>
                        <TableCell>{due ? <DeadlineBadge dueDate={due} today={snap.today} warningDays={30} /> : "—"}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Card>
        ) : null}

        {showTickets ? (
          <Card className="py-0">
            <CardHeader className="py-4">
              <CardTitle>Chamados pendentes</CardTitle>
              <CardDescription>Abertos ou em processamento, com urgência.</CardDescription>
            </CardHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Chamado</TableHead>
                  <TableHead>Urgência</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {snap.pendingTicketItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                      Nenhum chamado pendente no recorte.
                    </TableCell>
                  </TableRow>
                ) : (
                  snap.pendingTicketItems.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>
                        <Link href={`/chamados/${t.id}`} className="text-primary hover:underline">
                          {ticketCode(t.code)} {t.title}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {t.sector.name} · {t.sector.costCenter}
                        </p>
                      </TableCell>
                      <TableCell>{URGENCY_LABELS[t.urgency]}</TableCell>
                      <TableCell>
                        <TicketStatusBadge status={t.status} />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        ) : null}

        {showQuotes ? (
          <Card className="py-0">
            <CardHeader className="py-4">
              <CardTitle>Orçamentos pendentes</CardTitle>
              <CardDescription>Aguardando decisão da coordenação.</CardDescription>
            </CardHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Validade</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {snap.pendingQuoteItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                      Nenhum orçamento pendente no recorte.
                    </TableCell>
                  </TableRow>
                ) : (
                  snap.pendingQuoteItems.map((q) => (
                    <TableRow key={q.id}>
                      <TableCell>
                        <Link href={`/orcamentos/${q.id}`} className="text-primary hover:underline">
                          {q.supplier.legalName}
                        </Link>
                        <p className="text-xs text-muted-foreground">{q.ticket?.title ?? q.description ?? "—"}</p>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatBRL(q.amount)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-2">
                          <QuoteStatusBadge status="PENDING" />
                          <DeadlineBadge dueDate={q.validUntil} today={snap.today} />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        ) : null}
      </div>
    </>
  );
}
