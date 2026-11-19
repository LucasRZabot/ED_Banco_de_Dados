import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Paperclip } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { InvoiceFiltersBar } from "@/features/invoices/components/invoice-filters";
import { InvoiceStatusBadge } from "@/features/invoices/components/status-badge";
import { listInvoices, listSectorsForInvoices, listSuppliersForInvoices } from "@/features/invoices/queries";
import { invoiceFiltersSchema } from "@/features/invoices/schemas";
import { requireRole } from "@/lib/dal";
import { formatBRL, formatDate, formatDateOnly } from "@/lib/format";

export const metadata: Metadata = { title: "Notas Fiscais" };

export default function InvoicesPage({ searchParams }: PageProps<"/notas-fiscais">) {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <InvoicesContent searchParams={searchParams} />
    </Suspense>
  );
}

async function InvoicesContent({ searchParams }: { searchParams: PageProps<"/notas-fiscais">["searchParams"] }) {
  const user = await requireRole("FINANCEIRO", "REQUESTER");
  const raw = await searchParams;
  const parsed = invoiceFiltersSchema.safeParse({
    status: str(raw.status) || undefined,
    supplierId: str(raw.supplierId) || undefined,
    sectorId: str(raw.sectorId) || undefined,
    from: str(raw.from) || undefined,
    to: str(raw.to) || undefined,
    q: str(raw.q) || undefined,
  });
  const filters = parsed.success ? parsed.data : {};
  const finance = user.role === "FINANCEIRO";
  const [invoices, sectors, suppliers] = await Promise.all([
    listInvoices(user, filters),
    finance ? listSectorsForInvoices() : Promise.resolve([]),
    finance ? listSuppliersForInvoices() : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHeader
        title="Notas Fiscais"
        description={
          finance
            ? "Você vê todas as notas. Complete o lançamento com número, fornecedor, emissão e valor."
            : "Você envia as notas do seu setor com uma descrição e vê somente as que você mesma enviou."
        }
        actions={
          <Button nativeButton={false} render={<Link href="/notas-fiscais/novo" />}>
            Nova nota
          </Button>
        }
      />
      <InvoiceFiltersBar
        filters={filters}
        sectors={sectors}
        suppliers={suppliers}
        showFinanceFilters={finance}
      />
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Enviada em</TableHead>
              <TableHead>Descrição</TableHead>
              {finance ? <TableHead>Setor</TableHead> : null}
              <TableHead>Fornecedor</TableHead>
              <TableHead>Número</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={finance ? 7 : 6} className="py-10 text-center text-muted-foreground">
                  Nenhuma nota encontrada.
                </TableCell>
              </TableRow>
            ) : (
              invoices.map((inv) => {
                const hasFile = inv.attachments.length > 0;
                return (
                  <TableRow key={inv.id}>
                    <TableCell className="tabular-nums">
                      <Link href={`/notas-fiscais/${inv.id}`} className="font-medium text-primary hover:underline">
                        {formatDate(inv.createdAt)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/notas-fiscais/${inv.id}`} className="inline-flex items-center gap-1.5 hover:underline">
                        <span className="line-clamp-2">{inv.description}</span>
                        {hasFile ? <Paperclip className="size-3.5 shrink-0 text-muted-foreground" aria-label="Com anexo" /> : null}
                      </Link>
                    </TableCell>
                    {finance ? (
                      <TableCell>
                        {inv.sector.name}
                        <span className="ml-1 text-xs text-muted-foreground">{inv.sector.costCenter}</span>
                      </TableCell>
                    ) : null}
                    <TableCell>{inv.supplier?.legalName ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {inv.number ? `${inv.number}/${inv.series ?? ""}` : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatBRL(inv.amount)}</TableCell>
                    <TableCell>
                      <InvoiceStatusBadge status={inv.status} />
                      {inv.issueDate ? (
                        <p className="mt-1 text-xs text-muted-foreground">Emissão {formatDateOnly(inv.issueDate)}</p>
                      ) : null}
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
