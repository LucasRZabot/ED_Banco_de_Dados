import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AttachmentLinks } from "@/components/shared/attachment-links";
import { DeadlineBadge } from "@/components/shared/deadline-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AttachQuoteForm } from "@/features/quotes/components/attach-form";
import { ConvertQuoteForm } from "@/features/quotes/components/convert-form";
import { DecideQuoteForm } from "@/features/quotes/components/decide-form";
import { QuoteForm } from "@/features/quotes/components/quote-form";
import { QuoteStatusBadge } from "@/features/quotes/components/status-badge";
import {
  getQuoteOrNotFound,
  listPurchaseTicketsForQuotes,
  listQuotesForTicket,
  listSectorsForQuotes,
  listSuppliersForQuotes,
} from "@/features/quotes/queries";
import { requireFinance } from "@/lib/dal";
import { todayInTz, toDateInputValue } from "@/lib/dates";
import { formatBRL, formatCnpjDisplay, formatDate, formatDateOnly, formatDateTime, ticketCode } from "@/lib/format";

export const metadata: Metadata = { title: "Orçamento" };

export default function QuoteDetailPage({ params }: PageProps<"/orcamentos/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <QuoteDetail params={params} />
    </Suspense>
  );
}

async function QuoteDetail({ params }: { params: PageProps<"/orcamentos/[id]">["params"] }) {
  const user = await requireFinance();
  const { id } = await params;
  if (!id) notFound();
  const quote = await getQuoteOrNotFound(user, id);
  const validUntil = toDateInputValue(quote.validUntil);
  const siblings = quote.ticketId ? await listQuotesForTicket(quote.ticketId) : [];
  const otherPending = siblings.filter((q) => q.id !== quote.id && q.status === "PENDING");
  const [suppliers, tickets, sectors] = await Promise.all([
    quote.status === "PENDING" ? listSuppliersForQuotes() : Promise.resolve([]),
    quote.status === "PENDING" ? listPurchaseTicketsForQuotes(quote.ticketId) : Promise.resolve([]),
    listSectorsForQuotes(),
  ]);
  const today = todayInTz();
  const invoiceId = quote.invoices[0]?.id;
  const defaultSectorId = quote.ticket?.sectorId ?? user.sectorId ?? undefined;
  const pdfs = quote.attachments.filter((a) => a.category === "QUOTE");

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid gap-1">
          <h2 className="text-2xl font-semibold tracking-tight">{quote.supplier.legalName}</h2>
          <div className="flex flex-wrap items-center gap-2">
            <QuoteStatusBadge status={quote.status} />
            {quote.status === "PENDING" ? <DeadlineBadge dueDate={quote.validUntil} today={today} /> : null}
            <p className="text-sm text-muted-foreground">{formatCnpjDisplay(quote.supplier.cnpj)}</p>
          </div>
        </div>
        <p className="text-3xl font-semibold tabular-nums">{formatBRL(quote.amount)}</p>
      </div>

      {quote.ticket?.type === "CONTRACT_INCLUSION" ? (
        <Alert>
          <AlertTitle>Inclusão de contrato — Etapa 7</AlertTitle>
          <AlertDescription>
            Este chamado é de inclusão de contrato. A conversão em contrato ainda não tem tela; o gancho fica para a
            Etapa 7.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Proposta</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Validade" value={formatDateOnly(quote.validUntil)} />
              <Field label="Cadastrado em" value={formatDate(quote.createdAt)} />
              <Field label="Cadastrado por" value={quote.createdBy.name ?? quote.createdBy.email ?? "—"} />
            </div>
            <Field label="Descrição" value={quote.description ?? "—"} />
            {quote.ticket ? (
              <div className="grid gap-1">
                <p className="text-xs text-muted-foreground">Chamado</p>
                <Link href={`/chamados/${quote.ticket.id}`} className="text-primary hover:underline">
                  {ticketCode(quote.ticket.code)} {quote.ticket.title}
                </Link>
              </div>
            ) : (
              <Field label="Chamado" value="Sem vínculo" />
            )}
            {quote.decidedAt ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Decisão"
                  value={`${quote.decidedBy?.name ?? quote.decidedBy?.email ?? "—"} · ${formatDateTime(quote.decidedAt)}`}
                />
                <Field label="Nota da decisão" value={quote.decisionNote ?? "—"} />
              </div>
            ) : null}
            {quote.invoices.length ? (
              <div className="grid gap-1">
                <p className="text-xs text-muted-foreground">Lançamentos</p>
                {quote.invoices.map((inv) => (
                  <Link key={inv.id} href={`/notas-fiscais/${inv.id}`} className="text-primary hover:underline">
                    {inv.number ? `NF ${inv.number}` : "Nota pendente"} · {inv.status === "POSTED" ? "lançada" : "aguardando lançamento"}
                  </Link>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Anexo</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm">
            <AttachmentLinks items={pdfs} empty="Nenhum PDF." />
            <AttachQuoteForm quoteId={quote.id} validUntil={validUntil} />
          </CardContent>
        </Card>
      </div>

      {siblings.length > 1 ? (
        <Card>
          <CardHeader>
            <CardTitle>Comparativo do chamado</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {siblings.map((q) => (
              <Link
                key={q.id}
                href={`/orcamentos/${q.id}`}
                className={`grid gap-1 rounded-lg border p-3 text-sm hover:bg-muted/40 ${q.id === quote.id ? "ring-2 ring-primary" : ""}`}
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

      {quote.status === "PENDING" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Aprovar ou reprovar</CardTitle>
            </CardHeader>
            <CardContent>
              <DecideQuoteForm quoteId={quote.id} hasSiblings={otherPending.length > 0} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Editar proposta</CardTitle>
            </CardHeader>
            <CardContent>
              <QuoteForm
                suppliers={suppliers}
                tickets={tickets}
                quote={{
                  id: quote.id,
                  amount: Number(quote.amount).toFixed(2).replace(".", ","),
                  validUntil,
                  description: quote.description ?? "",
                  ticketId: quote.ticketId ?? "",
                  supplierId: quote.supplierId,
                }}
                existingPdfs={pdfs}
              />
            </CardContent>
          </Card>
        </div>
      ) : null}

      {quote.status === "APPROVED" ? (
        <Card>
          <CardHeader>
            <CardTitle>Converter</CardTitle>
          </CardHeader>
          <CardContent>
            <ConvertQuoteForm
              quoteId={quote.id}
              defaultSectorId={defaultSectorId}
              sectors={sectors}
              needSector={!quote.ticketId}
              invoiceId={invoiceId}
            />
          </CardContent>
        </Card>
      ) : null}

      {quote.status === "REJECTED" && !quote.ticketId ? (
        <Alert>
          <AlertTitle>Contrato — Etapa 7</AlertTitle>
          <AlertDescription>
            A conversão em contrato (chamado de inclusão) ainda não tem tela. O gancho fica para a Etapa 7.
          </AlertDescription>
        </Alert>
      ) : null}

      <Button nativeButton={false} variant="outline" render={<Link href="/orcamentos" />}>
        Voltar à lista
      </Button>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="whitespace-pre-wrap">{value}</p>
    </div>
  );
}
