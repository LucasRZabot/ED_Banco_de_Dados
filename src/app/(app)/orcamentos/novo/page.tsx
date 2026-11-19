import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { QuoteForm } from "@/features/quotes/components/quote-form";
import { listPurchaseTicketsForQuotes, listSuppliersForQuotes } from "@/features/quotes/queries";
import { requireFinance } from "@/lib/dal";

export const metadata: Metadata = { title: "Novo orçamento" };

export default function NewQuotePage({ searchParams }: PageProps<"/orcamentos/novo">) {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <NewQuoteContent searchParams={searchParams} />
    </Suspense>
  );
}

async function NewQuoteContent({ searchParams }: { searchParams: PageProps<"/orcamentos/novo">["searchParams"] }) {
  await requireFinance();
  const raw = await searchParams;
  const ticketId = typeof raw.ticketId === "string" ? raw.ticketId : "";
  const [suppliers, tickets] = await Promise.all([listSuppliersForQuotes(), listPurchaseTicketsForQuotes()]);

  return (
    <>
      <PageHeader
        title="Novo orçamento"
        description="Fornecedor, valor cotado, validade da proposta e o PDF. Você pode vincular a um chamado de compra."
      />
      <QuoteForm
        suppliers={suppliers}
        tickets={tickets}
        draft={ticketId ? { amount: "", validUntil: "", description: "", ticketId, supplierId: "" } : undefined}
      />
    </>
  );
}
