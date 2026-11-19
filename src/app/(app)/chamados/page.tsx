import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TicketFiltersBar } from "@/features/tickets/components/ticket-filters";
import { TicketStatusBadge } from "@/features/tickets/components/status-badge";
import { TICKET_TYPE_LABELS, URGENCY_LABELS } from "@/features/tickets/labels";
import { listSectorsForFilter, listTickets } from "@/features/tickets/queries";
import { ticketFiltersSchema } from "@/features/tickets/schemas";
import type { TicketStatus, TicketType, Urgency } from "@/features/tickets/status-machine";
import { requireRole } from "@/lib/dal";
import { formatDate, ticketCode } from "@/lib/format";

export const metadata: Metadata = { title: "Chamados" };

export default function TicketsPage({ searchParams }: PageProps<"/chamados">) {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <TicketsContent searchParams={searchParams} />
    </Suspense>
  );
}

async function TicketsContent({ searchParams }: { searchParams: PageProps<"/chamados">["searchParams"] }) {
  const user = await requireRole("FINANCEIRO", "REQUESTER");
  const raw = await searchParams;
  const parsed = ticketFiltersSchema.safeParse({
    status: str(raw.status) || undefined,
    type: str(raw.type) || undefined,
    urgency: str(raw.urgency) || undefined,
    sectorId: str(raw.sectorId) || undefined,
    from: str(raw.from) || undefined,
    to: str(raw.to) || undefined,
    q: str(raw.q) || undefined,
  });
  const filters = parsed.success ? parsed.data : {};
  const [tickets, sectors] = await Promise.all([
    listTickets(user, filters),
    user.role === "FINANCEIRO" ? listSectorsForFilter() : Promise.resolve([]),
  ]);
  const showResult = user.role === "REQUESTER";

  return (
    <>
      <PageHeader
        title="Chamados"
        description={
          user.role === "FINANCEIRO"
            ? "Avalie cada pedido: viável segue para Em Processamento; inviável é cancelado com motivo visível à chefia."
            : "Você vê somente os chamados que você mesma abriu, com o resultado da avaliação."
        }
        actions={
          user.role === "REQUESTER" ? (
            <Button render={<Link href="/chamados/novo" />}>Novo chamado</Button>
          ) : null
        }
      />
      <TicketFiltersBar filters={filters} sectors={sectors} showSector={user.role === "FINANCEIRO"} />
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nº</TableHead>
              <TableHead>Título</TableHead>
              <TableHead>Tipo</TableHead>
              {user.role === "FINANCEIRO" ? <TableHead>Setor</TableHead> : null}
              <TableHead>Urgência</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Aberto em</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tickets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={user.role === "FINANCEIRO" ? 7 : 6} className="py-10 text-center text-muted-foreground">
                  Nenhum chamado encontrado.
                </TableCell>
              </TableRow>
            ) : (
              tickets.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-mono">
                    <Link href={`/chamados/${t.id}`} className="text-primary hover:underline">
                      {ticketCode(t.code)}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link href={`/chamados/${t.id}`} className="font-medium hover:underline">
                      {t.title}
                    </Link>
                  </TableCell>
                  <TableCell>{TICKET_TYPE_LABELS[t.type as TicketType]}</TableCell>
                  {user.role === "FINANCEIRO" ? <TableCell>{t.sector.name}</TableCell> : null}
                  <TableCell>{URGENCY_LABELS[t.urgency as Urgency]}</TableCell>
                  <TableCell>
                    <TicketStatusBadge status={t.status as TicketStatus} showResult={showResult} />
                  </TableCell>
                  <TableCell className="tabular-nums">{formatDate(t.createdAt)}</TableCell>
                </TableRow>
              ))
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
