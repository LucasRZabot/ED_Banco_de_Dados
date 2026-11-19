import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AttachmentLinks } from "@/components/shared/attachment-links";
import { DeadlineBadge } from "@/components/shared/deadline-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AttachBillPdfForm } from "@/features/bills/components/attach-pdf-form";
import { PayBillForm } from "@/features/bills/components/pay-form";
import { BillStatusBadge } from "@/features/bills/components/status-badge";
import { effectiveBillStatus, getBillOrNotFound } from "@/features/bills/queries";
import { requireFinance } from "@/lib/dal";
import { todayInTz, toDateInputValue } from "@/lib/dates";
import { formatBRL, formatCnpjDisplay, formatDateOnly, formatDigitableLine } from "@/lib/format";

export const metadata: Metadata = { title: "Boleto" };

export default function BillDetailPage({ params }: PageProps<"/boletos/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <BillDetail params={params} />
    </Suspense>
  );
}

async function BillDetail({ params }: { params: PageProps<"/boletos/[id]">["params"] }) {
  const user = await requireFinance();
  const { id } = await params;
  if (!id) notFound();
  const bill = await getBillOrNotFound(user, id);
  const today = todayInTz();
  const status = effectiveBillStatus(bill, today);
  const pdfs = bill.attachments.filter((a) => a.category === "BILL");
  const proofs = bill.attachments.filter((a) => a.category === "BILL_PAYMENT_PROOF");
  const due = toDateInputValue(bill.dueDate);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid gap-1">
          <h2 className="text-2xl font-semibold tracking-tight">{bill.supplier.legalName}</h2>
          <div className="flex flex-wrap items-center gap-2">
            <BillStatusBadge status={status} />
            <DeadlineBadge dueDate={bill.dueDate} paid={status === "PAID"} today={today} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-3xl font-semibold tabular-nums">{formatBRL(bill.amount)}</p>
          <Button variant="outline" nativeButton={false} render={<Link href={`/boletos/${bill.id}/editar`} />}>
            Editar
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Dados do boleto</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm">
            <Field label="Linha digitável" value={formatDigitableLine(bill.digitableLine)} mono />
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Vencimento" value={formatDateOnly(bill.dueDate)} />
              <Field label="Parcela" value={bill.installment?.toString() ?? "—"} />
              <Field label="Setor" value={`${bill.sector.name} (${bill.sector.costCenter})`} />
            </div>
            <Field label="Fornecedor" value={`${bill.supplier.legalName} · ${formatCnpjDisplay(bill.supplier.cnpj)}`} />
            <Field label="Descrição" value={bill.description ?? "—"} />
            <Field label="Lançado por" value={bill.createdBy.name ?? bill.createdBy.email ?? "—"} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>PDF do boleto</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm">
            <AttachmentLinks items={pdfs} empty="Nenhum PDF anexado. Envie o arquivo do boleto." />
            <AttachBillPdfForm billId={bill.id} dueDate={due} />
            <div className="grid gap-2 border-t pt-3">
              <p className="text-xs text-muted-foreground">Comprovantes de pagamento</p>
              <AttachmentLinks items={proofs} empty="Nenhum. Entre na baixa para anexar." />
            </div>
          </CardContent>
        </Card>
      </div>

      {status === "PAID" ? (
        <Card>
          <CardHeader>
            <CardTitle>Baixa</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm sm:grid-cols-3">
            <Field label="Pago em" value={formatDateOnly(bill.paidAt)} />
            <Field label="Valor pago" value={formatBRL(bill.paidAmount)} />
            <Field label="Baixado por" value={bill.paidBy?.name ?? bill.paidBy?.email ?? "—"} />
            {bill.paymentNote ? <Field label="Observação" value={bill.paymentNote} /> : null}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Dar baixa</CardTitle>
          </CardHeader>
          <CardContent>
            <PayBillForm
              billId={bill.id}
              defaultAmount={Number(bill.amount).toFixed(2).replace(".", ",")}
              defaultPaidAt={toDateInputValue(today)}
              dueDate={due}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid gap-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={mono ? "font-mono text-xs leading-relaxed break-all" : "whitespace-pre-wrap"}>{value}</p>
    </div>
  );
}
