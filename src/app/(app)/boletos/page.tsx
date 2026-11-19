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
import { BillFiltersBar } from "@/features/bills/components/bill-filters";
import { BillStatusBadge } from "@/features/bills/components/status-badge";
import { effectiveBillStatus, listBills, listSectorsForBills, listSuppliersForBills } from "@/features/bills/queries";
import { billFiltersSchema } from "@/features/bills/schemas";
import { requireFinance } from "@/lib/dal";
import { todayInTz } from "@/lib/dates";
import { formatBRL, formatDateOnly } from "@/lib/format";

export const metadata: Metadata = { title: "Boletos" };

export default function BillsPage({ searchParams }: PageProps<"/boletos">) {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <BillsContent searchParams={searchParams} />
    </Suspense>
  );
}

async function BillsContent({ searchParams }: { searchParams: PageProps<"/boletos">["searchParams"] }) {
  const user = await requireFinance();
  const raw = await searchParams;
  const parsed = billFiltersSchema.safeParse({
    status: str(raw.status) || undefined,
    supplierId: str(raw.supplierId) || undefined,
    sectorId: str(raw.sectorId) || undefined,
    from: str(raw.from) || undefined,
    to: str(raw.to) || undefined,
    q: str(raw.q) || undefined,
  });
  const filters = parsed.success ? parsed.data : {};
  const [bills, sectors, suppliers] = await Promise.all([
    listBills(user, filters),
    listSectorsForBills(),
    listSuppliersForBills(),
  ]);
  const today = todayInTz();

  return (
    <>
      <PageHeader
        title="Boletos"
        description="Cadastro, vencimentos e baixa. Só a coordenação financeira vê e lança boletos."
        actions={
          <Button nativeButton={false} render={<Link href="/boletos/novo" />}>
            Novo boleto
          </Button>
        }
      />
      <BillFiltersBar filters={filters} sectors={sectors} suppliers={suppliers} />
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vencimento</TableHead>
              <TableHead>Fornecedor</TableHead>
              <TableHead>Setor</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Prazo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bills.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  Nenhum boleto encontrado.
                </TableCell>
              </TableRow>
            ) : (
              bills.map((b) => {
                const status = effectiveBillStatus(b, today);
                return (
                  <TableRow key={b.id}>
                    <TableCell className="tabular-nums">
                      <Link href={`/boletos/${b.id}`} className="font-medium text-primary hover:underline">
                        {formatDateOnly(b.dueDate)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/boletos/${b.id}`} className="inline-flex items-center gap-1.5 hover:underline">
                        {b.supplier.legalName}
                        {b.attachments.some((a) => a.category === "BILL") ? (
                          <Paperclip className="size-3.5 text-muted-foreground" aria-label="PDF do boleto anexado" />
                        ) : null}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {b.sector.name}
                      <span className="ml-1 text-xs text-muted-foreground">{b.sector.costCenter}</span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatBRL(b.amount)}</TableCell>
                    <TableCell>
                      <BillStatusBadge status={status} />
                    </TableCell>
                    <TableCell>
                      <DeadlineBadge dueDate={b.dueDate} paid={status === "PAID"} today={today} />
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
