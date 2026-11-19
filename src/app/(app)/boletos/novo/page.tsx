import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { BillForm } from "@/features/bills/components/bill-form";
import { listSectorsForBills, listSuppliersForBills } from "@/features/bills/queries";
import { requireFinance } from "@/lib/dal";
import { db } from "@/lib/db";
import { toDateInputValue } from "@/lib/dates";

export const metadata: Metadata = { title: "Novo boleto" };

export default function NewBillPage({ searchParams }: PageProps<"/boletos/novo">) {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <NewBillContent searchParams={searchParams} />
    </Suspense>
  );
}

async function NewBillContent({ searchParams }: { searchParams: PageProps<"/boletos/novo">["searchParams"] }) {
  await requireFinance();
  const raw = await searchParams;
  const invoiceId = typeof raw.invoiceId === "string" ? raw.invoiceId : undefined;
  const quoteId = typeof raw.quoteId === "string" ? raw.quoteId : undefined;
  const [sectors, suppliers, invoice, quote] = await Promise.all([
    listSectorsForBills(),
    listSuppliersForBills(),
    invoiceId
      ? db.invoice.findUnique({
          where: { id: invoiceId },
          select: {
            id: true,
            status: true,
            amount: true,
            description: true,
            sectorId: true,
            supplierId: true,
          },
        })
      : Promise.resolve(null),
    quoteId
      ? db.quote.findUnique({
          where: { id: quoteId },
          select: {
            id: true,
            status: true,
            amount: true,
            description: true,
            supplierId: true,
            ticket: { select: { sectorId: true } },
          },
        })
      : Promise.resolve(null),
  ]);
  const fromPosted = invoice?.status === "POSTED" ? invoice : null;
  const fromQuote = !fromPosted && quote?.status === "APPROVED" ? quote : null;

  return (
    <>
      <PageHeader
        title="Novo boleto"
        description={
          fromPosted
            ? "Boleto vinculado à nota lançada. Confira valor, setor e fornecedor."
            : fromQuote
              ? "Boleto a partir do orçamento aprovado. Confira valor, setor e fornecedor."
              : "Linha digitável, valor, vencimento, setor, fornecedor e o PDF do boleto para a coordenação abrir e visualizar."
        }
      />
      <BillForm
        sectors={sectors}
        suppliers={suppliers}
        invoiceId={fromPosted?.id}
        draft={
          fromPosted
            ? {
                digitableLine: "",
                amount: fromPosted.amount ? Number(fromPosted.amount).toFixed(2).replace(".", ",") : "",
                dueDate: toDateInputValue(new Date()),
                description: fromPosted.description,
                installment: "",
                sectorId: fromPosted.sectorId,
                supplierId: fromPosted.supplierId ?? "",
              }
            : fromQuote
              ? {
                  digitableLine: "",
                  amount: Number(fromQuote.amount).toFixed(2).replace(".", ","),
                  dueDate: toDateInputValue(new Date()),
                  description: fromQuote.description ?? "",
                  installment: "",
                  sectorId: fromQuote.ticket?.sectorId ?? "",
                  supplierId: fromQuote.supplierId,
                }
              : undefined
        }
      />
    </>
  );
}
