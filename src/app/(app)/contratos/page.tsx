import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Paperclip } from "lucide-react";
import { DeadlineBadge } from "@/components/shared/deadline-badge";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ContractFiltersBar } from "@/features/contracts/components/contract-filters";
import { ContractStatusBadge } from "@/features/contracts/components/status-badge";
import { contractAlertOn } from "@/features/contracts/labels";
import { listContracts, listSectorsForContracts, listSuppliersForContracts } from "@/features/contracts/queries";
import { contractFiltersSchema } from "@/features/contracts/schemas";
import { requireFinance } from "@/lib/dal";
import { todayInTz } from "@/lib/dates";
import { formatBRL, formatDateOnly, ticketCode } from "@/lib/format";

export const metadata: Metadata = { title: "Contratos" };

export default function ContractsPage({ searchParams }: PageProps<"/contratos">) {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <ContractsContent searchParams={searchParams} />
    </Suspense>
  );
}

async function ContractsContent({ searchParams }: { searchParams: PageProps<"/contratos">["searchParams"] }) {
  const user = await requireFinance();
  const raw = await searchParams;
  const parsed = contractFiltersSchema.safeParse({
    status: str(raw.status) || undefined,
    supplierId: str(raw.supplierId) || undefined,
    sectorId: str(raw.sectorId) || undefined,
    from: str(raw.from) || undefined,
    to: str(raw.to) || undefined,
    q: str(raw.q) || undefined,
    expiring: str(raw.expiring) === "1" ? "1" : undefined,
  });
  const filters = parsed.success ? parsed.data : {};
  const [contracts, suppliers, sectors] = await Promise.all([
    listContracts(user, filters),
    listSuppliersForContracts(),
    listSectorsForContracts(),
  ]);
  const today = todayInTz();

  return (
    <>
      <PageHeader
        title="Contratos"
        description="Cadastre contratos ativos, acompanhe término e renovação e abra o PDF assinado."
        actions={
          <Button nativeButton={false} render={<Link href="/contratos/novo" />}>
            Novo contrato
          </Button>
        }
      />
      <ContractFiltersBar filters={filters} suppliers={suppliers} sectors={sectors} />
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Objeto</TableHead>
              <TableHead>Fornecedor</TableHead>
              <TableHead>Setor</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Prazo</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contracts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  Nenhum contrato encontrado.
                </TableCell>
              </TableRow>
            ) : (
              contracts.map((c) => {
                const alertOn = contractAlertOn(c);
                const hasFile = c.attachments.length > 0;
                const value = c.monthlyValue ?? c.totalValue;
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Link href={`/contratos/${c.id}`} className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline">
                        <span className="line-clamp-2">{c.object}</span>
                        {hasFile ? <Paperclip className="size-3.5 shrink-0 text-muted-foreground" aria-label="Com anexo" /> : null}
                      </Link>
                      {c.code ? <p className="mt-0.5 font-mono text-xs text-muted-foreground">{c.code}</p> : null}
                      {c.ticket ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {ticketCode(c.ticket.code)} {c.ticket.title}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell>{c.supplier.legalName}</TableCell>
                    <TableCell>
                      {c.sector.name}
                      <span className="ml-1 text-xs text-muted-foreground">{c.sector.costCenter}</span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatBRL(value)}
                      {c.monthlyValue ? <p className="text-xs text-muted-foreground">mensal</p> : null}
                    </TableCell>
                    <TableCell>
                      <div className="grid gap-1">
                        <span className="tabular-nums">{alertOn ? formatDateOnly(alertOn) : "Indeterminado"}</span>
                        {c.status === "ACTIVE" && alertOn ? <DeadlineBadge dueDate={alertOn} today={today} /> : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <ContractStatusBadge status={c.status} />
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
