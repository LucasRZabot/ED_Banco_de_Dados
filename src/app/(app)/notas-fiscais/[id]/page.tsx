import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AttachmentLinks } from "@/components/shared/attachment-links";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AttachInvoiceForm } from "@/features/invoices/components/attach-form";
import { CancelInvoiceForm } from "@/features/invoices/components/cancel-form";
import { InvoicePostForm } from "@/features/invoices/components/post-form";
import { InvoiceStatusBadge } from "@/features/invoices/components/status-badge";
import {
  getInvoiceOrNotFound,
  listLinksForPost,
  listSuppliersForInvoices,
  prefillFromXmlAttachment,
} from "@/features/invoices/queries";
import { requireRole } from "@/lib/dal";
import { toDateInputValue } from "@/lib/dates";
import { formatBRL, formatCnpjDisplay, formatDate, formatDateOnly, ticketCode } from "@/lib/format";

export const metadata: Metadata = { title: "Nota fiscal" };

export default function InvoiceDetailPage({ params }: PageProps<"/notas-fiscais/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <InvoiceDetail params={params} />
    </Suspense>
  );
}

async function InvoiceDetail({ params }: { params: PageProps<"/notas-fiscais/[id]">["params"] }) {
  const user = await requireRole("FINANCEIRO", "REQUESTER");
  const { id } = await params;
  if (!id) notFound();
  const invoice = await getInvoiceOrNotFound(user, id);
  const pdfs = invoice.attachments.filter((a) => a.category === "INVOICE_PDF");
  const xmls = invoice.attachments.filter((a) => a.category === "INVOICE_XML");
  const finance = user.role === "FINANCEIRO";
  const canAttach = finance || (user.role === "REQUESTER" && invoice.status === "PENDING");
  const issue = invoice.issueDate ? toDateInputValue(invoice.issueDate) : undefined;

  const xmlPrefill = xmls[0] ? await prefillFromXmlAttachment(xmls[0].fileKey) : null;
  const links = finance && invoice.status === "PENDING" ? await listLinksForPost() : { quotes: [], contracts: [], tickets: [] };
  const suppliers = finance && invoice.status === "PENDING" ? await listSuppliersForInvoices() : [];

  const matchedSupplier = xmlPrefill?.supplierCnpj
    ? suppliers.find((s) => s.cnpj === xmlPrefill.supplierCnpj)
    : undefined;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid gap-1">
          <h2 className="text-2xl font-semibold tracking-tight">
            {invoice.supplier?.legalName ?? "Nota aguardando lançamento"}
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <InvoiceStatusBadge status={invoice.status} />
            {invoice.number ? (
              <p className="font-mono text-sm text-muted-foreground">
                {invoice.number}/{invoice.series}
              </p>
            ) : null}
          </div>
        </div>
        {invoice.amount ? <p className="text-3xl font-semibold tabular-nums">{formatBRL(invoice.amount)}</p> : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Dados da nota</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm">
            <Field label="Do que se trata" value={invoice.description} />
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Setor" value={`${invoice.sector.name} (${invoice.sector.costCenter})`} />
              <Field label="Enviada em" value={formatDate(invoice.createdAt)} />
              <Field label="Enviada por" value={invoice.submittedBy.name ?? invoice.submittedBy.email ?? "—"} />
            </div>
            {invoice.status === "POSTED" ? (
              <>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field
                    label="Fornecedor"
                    value={
                      invoice.supplier
                        ? `${invoice.supplier.legalName} · ${formatCnpjDisplay(invoice.supplier.cnpj)}`
                        : "—"
                    }
                  />
                  <Field label="Emissão" value={formatDateOnly(invoice.issueDate)} />
                  <Field label="Lançada por" value={invoice.postedBy?.name ?? invoice.postedBy?.email ?? "—"} />
                </div>
                {invoice.accessKey ? <Field label="Chave de acesso" value={invoice.accessKey} mono /> : null}
                {invoice.quote ? (
                  <Field label="Orçamento" value={invoice.quote.description ?? invoice.quote.id} />
                ) : null}
                {invoice.contract ? (
                  <Field
                    label="Contrato"
                    value={invoice.contract.code ? `${invoice.contract.code} · ${invoice.contract.object}` : invoice.contract.object}
                  />
                ) : null}
                {invoice.ticket ? (
                  <Field label="Chamado" value={`${ticketCode(invoice.ticket.code)} ${invoice.ticket.title}`} />
                ) : null}
              </>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Anexos</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm">
            <div className="grid gap-2">
              <p className="text-xs text-muted-foreground">PDF</p>
              <AttachmentLinks items={pdfs} empty="Nenhum PDF." />
            </div>
            <div className="grid gap-2">
              <p className="text-xs text-muted-foreground">XML</p>
              <AttachmentLinks items={xmls} empty="Nenhum XML." />
            </div>
            {canAttach ? <AttachInvoiceForm invoiceId={invoice.id} referenceDate={issue} /> : null}
          </CardContent>
        </Card>
      </div>

      {finance && invoice.bills.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Boletos desta nota</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            {invoice.bills.map((b) => (
              <Link key={b.id} href={`/boletos/${b.id}`} className="text-primary hover:underline">
                {formatDateOnly(b.dueDate)} · {formatBRL(b.amount)}
              </Link>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {finance && invoice.status === "PENDING" ? (
        <Card>
          <CardHeader>
            <CardTitle>Lançar nota</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6">
            <InvoicePostForm
              invoiceId={invoice.id}
              suppliers={suppliers}
              quotes={links.quotes}
              contracts={links.contracts}
              tickets={links.tickets}
              referenceDate={issue}
              defaults={{
                number: invoice.number ?? xmlPrefill?.number ?? "",
                series: invoice.series ?? xmlPrefill?.series ?? "",
                accessKey: invoice.accessKey ?? xmlPrefill?.accessKey ?? "",
                amount: invoice.amount
                  ? Number(invoice.amount).toFixed(2).replace(".", ",")
                  : xmlPrefill?.amount
                    ? xmlPrefill.amount.replace(".", ",")
                    : "",
                issueDate: issue ?? xmlPrefill?.issueDate ?? "",
                supplierId: invoice.supplierId ?? matchedSupplier?.id ?? "",
                supplierLegalName: xmlPrefill?.supplierLegalName ?? "",
                supplierCnpj: xmlPrefill?.supplierCnpj ?? "",
                quoteId: invoice.quoteId ?? "",
                contractId: invoice.contractId ?? "",
                ticketId: invoice.ticketId ?? "",
              }}
            />
            <CancelInvoiceForm invoiceId={invoice.id} />
          </CardContent>
        </Card>
      ) : null}

      {finance && invoice.status === "POSTED" ? (
        <Button nativeButton={false} render={<Link href={`/boletos/novo?invoiceId=${invoice.id}`} />}>
          Novo boleto desta nota
        </Button>
      ) : null}
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
