import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AttachmentLinks } from "@/components/shared/attachment-links";
import { DeadlineBadge } from "@/components/shared/deadline-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AttachContractForm } from "@/features/contracts/components/attach-form";
import { ContractForm } from "@/features/contracts/components/contract-form";
import { ContractStatusBadge } from "@/features/contracts/components/status-badge";
import { TerminateContractForm } from "@/features/contracts/components/terminate-form";
import { contractAlertOn } from "@/features/contracts/labels";
import {
  getContractOrNotFound,
  listInclusionTicketsForContracts,
  listSectorsForContracts,
  listSuppliersForContracts,
} from "@/features/contracts/queries";
import { requireFinance } from "@/lib/dal";
import { todayInTz, toDateInputValue } from "@/lib/dates";
import { formatBRL, formatCnpjDisplay, formatDate, formatDateOnly, ticketCode } from "@/lib/format";

export const metadata: Metadata = { title: "Contrato" };

export default function ContractDetailPage({ params }: PageProps<"/contratos/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <ContractDetail params={params} />
    </Suspense>
  );
}

async function ContractDetail({ params }: { params: PageProps<"/contratos/[id]">["params"] }) {
  const user = await requireFinance();
  const { id } = await params;
  if (!id) notFound();
  const contract = await getContractOrNotFound(user, id);
  const today = todayInTz();
  const alertOn = contractAlertOn(contract);
  const pdfs = contract.attachments.filter((a) => a.category === "CONTRACT");
  const canEdit = contract.status !== "TERMINATED";
  const [suppliers, sectors, tickets] = canEdit
    ? await Promise.all([
        listSuppliersForContracts(),
        listSectorsForContracts(),
        listInclusionTicketsForContracts(contract.ticketId),
      ])
    : [[], [], []];

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid gap-1">
          <h2 className="text-2xl font-semibold tracking-tight">{contract.object}</h2>
          <div className="flex flex-wrap items-center gap-2">
            <ContractStatusBadge status={contract.status} />
            {contract.code ? <p className="font-mono text-sm text-muted-foreground">{contract.code}</p> : null}
            {contract.status === "ACTIVE" && alertOn ? <DeadlineBadge dueDate={alertOn} today={today} /> : null}
          </div>
        </div>
        <p className="text-3xl font-semibold tabular-nums">{formatBRL(contract.monthlyValue ?? contract.totalValue)}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Vigência</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Fornecedor" value={`${contract.supplier.legalName} · ${formatCnpjDisplay(contract.supplier.cnpj)}`} />
              <Field label="Setor" value={`${contract.sector.name} (${contract.sector.costCenter})`} />
              <Field label="Cadastrado por" value={contract.createdBy.name ?? contract.createdBy.email ?? "—"} />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Início" value={formatDateOnly(contract.startDate)} />
              <Field label="Término" value={formatDateOnly(contract.endDate)} />
              <Field label="Renovação" value={formatDateOnly(contract.renewalDate)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Valor mensal" value={formatBRL(contract.monthlyValue)} />
              <Field label="Valor total" value={formatBRL(contract.totalValue)} />
              <Field
                label="Alerta"
                value={`${contract.alertDaysBefore} dias antes${contract.autoRenew ? " · renovação automática" : ""}`}
              />
            </div>
            {contract.ticket ? (
              <div className="grid gap-1">
                <p className="text-xs text-muted-foreground">Chamado de origem</p>
                <Link href={`/chamados/${contract.ticket.id}`} className="text-primary hover:underline">
                  {ticketCode(contract.ticket.code)} {contract.ticket.title}
                </Link>
              </div>
            ) : null}
            <Field label="Observações" value={contract.notes ?? "—"} />
            <Field label="Cadastrado em" value={formatDate(contract.createdAt)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contrato assinado</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm">
            <AttachmentLinks items={pdfs} empty="Nenhum PDF." />
            <AttachContractForm contractId={contract.id} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Notas fiscais</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            {contract.invoices.length === 0 ? (
              <p className="text-muted-foreground">Nenhuma nota vinculada.</p>
            ) : (
              contract.invoices.map((inv) => (
                <Link key={inv.id} href={`/notas-fiscais/${inv.id}`} className="text-primary hover:underline">
                  {inv.number ? `NF ${inv.number}` : "Nota pendente"} · {formatBRL(inv.amount)}
                </Link>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Boletos</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            {contract.bills.length === 0 ? (
              <p className="text-muted-foreground">Nenhum boleto vinculado.</p>
            ) : (
              contract.bills.map((b) => (
                <Link key={b.id} href={`/boletos/${b.id}`} className="text-primary hover:underline">
                  {formatDateOnly(b.dueDate)} · {formatBRL(b.amount)}
                </Link>
              ))
            )}
            <Button nativeButton={false} variant="outline" render={<Link href={`/boletos/novo?contractId=${contract.id}`} />}>
              Novo boleto deste contrato
            </Button>
          </CardContent>
        </Card>
      </div>

      {canEdit ? (
        <Card>
          <CardHeader>
            <CardTitle>Editar contrato</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6">
            <ContractForm
              suppliers={suppliers}
              sectors={sectors}
              tickets={tickets}
              contract={{
                id: contract.id,
                code: contract.code ?? "",
                object: contract.object,
                monthlyValue: contract.monthlyValue ? Number(contract.monthlyValue).toFixed(2).replace(".", ",") : "",
                totalValue: contract.totalValue ? Number(contract.totalValue).toFixed(2).replace(".", ",") : "",
                startDate: toDateInputValue(contract.startDate),
                endDate: contract.endDate ? toDateInputValue(contract.endDate) : "",
                renewalDate: contract.renewalDate ? toDateInputValue(contract.renewalDate) : "",
                autoRenew: contract.autoRenew,
                alertDaysBefore: String(contract.alertDaysBefore),
                notes: contract.notes ?? "",
                sectorId: contract.sectorId,
                ticketId: contract.ticketId ?? "",
                supplierId: contract.supplierId,
                quoteId: "",
              }}
              existingPdfs={pdfs}
            />
            {contract.status !== "TERMINATED" ? <TerminateContractForm contractId={contract.id} /> : null}
          </CardContent>
        </Card>
      ) : null}

      <Button nativeButton={false} variant="outline" render={<Link href="/contratos" />}>
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
