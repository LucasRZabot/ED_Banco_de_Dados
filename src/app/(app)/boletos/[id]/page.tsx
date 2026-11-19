import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DeadlineBadge } from "@/components/shared/deadline-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PayBillForm } from "@/features/bills/components/pay-form";
import { BillStatusBadge } from "@/features/bills/components/status-badge";
import { effectiveBillStatus, getBillOrNotFound } from "@/features/bills/queries";
import { requireFinance } from "@/lib/dal";
import { todayInTz, toDateInputValue } from "@/lib/dates";
import { formatBRL, formatCnpjDisplay, formatDateOnly, formatDigitableLine, formatFileSize } from "@/lib/format";

export const metadata: Metadata = { title: "Boleto" };

export default async function BillDetailPage({ params }: PageProps<"/boletos/[id]">) {
  const user = await requireFinance();
  const { id } = await params;
  if (!id) notFound();
  const bill = await getBillOrNotFound(user, id);
  const today = todayInTz();
  const status = effectiveBillStatus(bill, today);
  const pdfs = bill.attachments.filter((a) => a.category === "BILL");
  const proofs = bill.attachments.filter((a) => a.category === "BILL_PAYMENT_PROOF");

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
        <p className="text-3xl font-semibold tabular-nums">{formatBRL(bill.amount)}</p>
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
            <CardTitle>Anexos</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <AttachmentGroup title="Boleto" items={pdfs} />
            <AttachmentGroup title="Comprovantes" items={proofs} />
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
              dueDate={toDateInputValue(bill.dueDate)}
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

function AttachmentGroup({
  title,
  items,
}: {
  title: string;
  items: { id: string; fileName: string; fileSize: number }[];
}) {
  return (
    <div className="grid gap-1">
      <p className="text-xs text-muted-foreground">{title}</p>
      {items.length === 0 ? (
        <p className="text-muted-foreground">Nenhum.</p>
      ) : (
        items.map((a) => (
          <a key={a.id} href={`/api/files/${a.id}`} className="text-primary hover:underline">
            {a.fileName} <span className="text-muted-foreground">({formatFileSize(a.fileSize)})</span>
          </a>
        ))
      )}
    </div>
  );
}
