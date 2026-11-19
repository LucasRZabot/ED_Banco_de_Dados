import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Paperclip } from "lucide-react";
import { DeadlineBadge } from "@/components/shared/deadline-badge";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { QuoteFiltersBar } from "@/features/quotes/components/quote-filters";
import { QuoteStatusBadge } from "@/features/quotes/components/status-badge";
import { listPurchaseTicketsForQuotes, listQuotes, listSuppliersForQuotes } from "@/features/quotes/queries";
import { quoteFiltersSchema } from "@/features/quotes/schemas";
import { requireFinance } from "@/lib/dal";
import { todayInTz } from "@/lib/dates";
import { formatBRL, formatDateOnly, ticketCode } from "@/lib/format";

export const metadata: Metadata = { title: "Orçamentos" };

export default function QuotesPage({ searchParams }: PageProps<"/orcamentos">) {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <QuotesContent searchParams={searchParams} />
    </Suspense>
  );
}

async function QuotesContent({ searchParams }: { searchParams: PageProps<"/orcamentos">["searchParams"] }) {
  const user = await requireFinance();
  const raw = await searchParams;
  const parsed = quoteFiltersSchema.safeParse({
    status: str(raw.status) || undefined,
    supplierId: str(raw.supplierId) || undefined,
    ticketId: str(raw.ticketId) || undefined,
    from: str(raw.from) || undefined,
    to: str(raw.to) || undefined,
    q: str(raw.q) || undefined,
  });
  const filters = parsed.success ? parsed.data : {};
  const [quotes, suppliers, tickets] = await Promise.all([
    listQuotes(user, filters),
    listSuppliersForQuotes(),
    listPurchaseTicketsForQuotes(),
  ]);
  const today = todayInTz();
  const comparing = Boolean(filters.ticketId);
  const compareQuotes = comparing ? [...quotes].sort((a, b) => Number(a.amount) - Number(b.amount)) : [];

  return (
    <>
      <PageHeader
        title="Orçamentos"
        description="Cadastre propostas, compare no mesmo chamado, aprove ou reprove e converta a aprovada em lançamento."
        actions={
          <Button nativeButton={false} render={<Link href="/orcamentos/novo" />}>
            Novo orçamento
          </Button>
        }
      />
      <QuoteFiltersBar filters={filters} suppliers={suppliers} tickets={tickets} />

      {comparing && compareQuotes.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Comparativo do chamado</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {compareQuotes.map((q) => (
              <Link
                key={q.id}
                href={`/orcamentos/${q.id}`}
                className="grid gap-1 rounded-lg border p-3 text-sm hover:bg-muted/40"
              >
                <p className="font-medium">{q.supplier.legalName}</p>
                <p className="text-xl font-semibold tabular-nums">{formatBRL(q.amount)}</p>
                <QuoteStatusBadge status={q.status} />
                <p className="text-xs text-muted-foreground">Válido até {formatDateOnly(q.validUntil)}</p>
              </Link>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fornecedor</TableHead>
              <TableHead className="text-right">Valor cotado</TableHead>
              <TableHead>Validade</TableHead>
              <TableHead>Chamado</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {quotes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  Nenhum orçamento encontrado.
                </TableCell>
              </TableRow>
            ) : (
              quotes.map((q) => {
                const hasFile = q.attachments.length > 0;
                return (
                  <TableRow key={q.id}>
                    <TableCell>
                      <Link href={`/orcamentos/${q.id}`} className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline">
                        <span>{q.supplier.legalName}</span>
                        {hasFile ? <Paperclip className="size-3.5 shrink-0 text-muted-foreground" aria-label="Com anexo" /> : null}
                      </Link>
                      {q.description ? (
                        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{q.description}</p>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatBRL(q.amount)}</TableCell>
                    <TableCell>
                      <div className="grid gap-1">
                        <span className="tabular-nums">{formatDateOnly(q.validUntil)}</span>
                        {q.status === "PENDING" ? <DeadlineBadge dueDate={q.validUntil} today={today} /> : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      {q.ticket ? (
                        <Link href={`/chamados/${q.ticket.id}`} className="text-primary hover:underline">
                          {ticketCode(q.ticket.code)} {q.ticket.title}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <QuoteStatusBadge status={q.status} />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}

function str(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
