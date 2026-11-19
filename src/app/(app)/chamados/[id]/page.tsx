import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QuoteStatusBadge } from "@/features/quotes/components/status-badge";
import { listQuotesForTicket } from "@/features/quotes/queries";
import { CommentForm } from "@/features/tickets/components/comment-form";
import { FinanceActions } from "@/features/tickets/components/finance-actions";
import { TicketStatusBadge } from "@/features/tickets/components/status-badge";
import { COMMENT_VISIBILITY_LABELS, TICKET_STATUS_LABELS, TICKET_TYPE_LABELS, URGENCY_LABELS } from "@/features/tickets/labels";
import { getTicketOrNotFound } from "@/features/tickets/queries";
import type { CommentVisibility, TicketStatus, TicketType, Urgency } from "@/features/tickets/status-machine";
import { requireRole } from "@/lib/dal";
import { formatBRL, formatDate, formatDateOnly, formatDateTime, formatFileSize, ticketCode } from "@/lib/format";

export const metadata: Metadata = { title: "Chamado" };

export default async function TicketDetailPage({ params }: PageProps<"/chamados/[id]">) {
  const user = await requireRole("FINANCEIRO", "REQUESTER");
  const { id } = await params;
  if (!id) notFound();
  const ticket = await getTicketOrNotFound(user, id);
  const status = ticket.status as TicketStatus;
  const showResult = user.role === "REQUESTER";
  const quotes =
    user.role === "FINANCEIRO" && ticket.type === "PURCHASE_QUOTE" ? await listQuotesForTicket(ticket.id) : [];

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid gap-1">
          <p className="font-mono text-sm text-muted-foreground">{ticketCode(ticket.code)}</p>
          <h2 className="text-2xl font-semibold tracking-tight">{ticket.title}</h2>
          <div className="flex flex-wrap items-center gap-2">
            <TicketStatusBadge status={status} showResult={showResult} />
            <Badge variant="outline">{TICKET_TYPE_LABELS[ticket.type as TicketType]}</Badge>
            <Badge variant="outline">{URGENCY_LABELS[ticket.urgency as Urgency]}</Badge>
          </div>
        </div>
        {user.role === "FINANCEIRO" ? (
          <FinanceActions ticketId={ticket.id} status={status} type={ticket.type as TicketType} />
        ) : null}
      </div>

      {status === "CANCELED" && ticket.cancellationReason ? (
        <Alert variant="destructive">
          <AlertTitle>Reprovado — motivo visível à chefia</AlertTitle>
          <AlertDescription>{ticket.cancellationReason}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Pedido</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm">
            <Field label="Setor" value={`${ticket.sector.name} (${ticket.sector.costCenter})`} />
            <Field label="Solicitante" value={ticket.requester.name ?? ticket.requester.email} />
            <Field label="Descrição" value={ticket.description} />
            <Field label="Justificativa" value={ticket.justification} />
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Quantidade" value={ticket.quantity?.toString() ?? "—"} />
              <Field label="Necessário até" value={formatDate(ticket.neededBy)} />
              <Field label="Aberto em" value={formatDateTime(ticket.createdAt)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Anexos</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            {ticket.attachments.length === 0 ? (
              <p className="text-muted-foreground">Nenhum anexo.</p>
            ) : (
              ticket.attachments.map((a) => (
                <a key={a.id} href={`/api/files/${a.id}`} className="text-primary hover:underline">
                  {a.fileName} <span className="text-muted-foreground">({formatFileSize(a.fileSize)})</span>
                </a>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {user.role === "FINANCEIRO" && ticket.type === "PURCHASE_QUOTE" ? (
        <Card>
          <CardHeader>
            <CardTitle>Orçamentos deste chamado</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {quotes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum orçamento cadastrado ainda.</p>
            ) : (
              quotes.map((q) => (
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
              ))
            )}
          </CardContent>
        </Card>
      ) : null}

      {user.role === "FINANCEIRO" && ticket.type === "CONTRACT_INCLUSION" ? (
        <Alert>
          <AlertTitle>Contrato — Etapa 7</AlertTitle>
          <AlertDescription>
            A conversão deste chamado em contrato ainda não tem tela. O gancho fica registrado para a Etapa 7.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Andamento</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            {ticket.statusHistory.map((h) => (
              <div key={h.id} className="border-l-2 pl-3">
                <p className="font-medium">
                  {h.fromStatus ? TICKET_STATUS_LABELS[h.fromStatus as TicketStatus] : "Criado"} →{" "}
                  {TICKET_STATUS_LABELS[h.toStatus as TicketStatus]}
                </p>
                <p className="text-xs text-muted-foreground">
                  {h.changedBy.name ?? h.changedBy.email} · {formatDateTime(h.createdAt)}
                </p>
                {h.note ? <p className="mt-1">{h.note}</p> : null}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Comentários</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {ticket.comments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum comentário ainda.</p>
            ) : (
              ticket.comments.map((c) => (
                <div key={c.id} className="grid gap-1 rounded-lg border p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{c.author.name ?? c.author.email}</span>
                    {c.visibility === "INTERNAL" ? (
                      <Badge variant="secondary">{COMMENT_VISIBILITY_LABELS[c.visibility as CommentVisibility]}</Badge>
                    ) : null}
                    <span className="text-xs text-muted-foreground">{formatDateTime(c.createdAt)}</span>
                  </div>
                  <p className="whitespace-pre-wrap">{c.body}</p>
                </div>
              ))
            )}
            <CommentForm ticketId={ticket.id} role={user.role} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="whitespace-pre-wrap">{value}</p>
    </div>
  );
}
