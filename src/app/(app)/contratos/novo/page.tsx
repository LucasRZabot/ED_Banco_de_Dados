import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { ContractForm } from "@/features/contracts/components/contract-form";
import {
  getApprovedQuoteDraft,
  listInclusionTicketsForContracts,
  listSectorsForContracts,
  listSuppliersForContracts,
} from "@/features/contracts/queries";
import { requireFinance } from "@/lib/dal";
import { db } from "@/lib/db";
import { toDateInputValue } from "@/lib/dates";

export const metadata: Metadata = { title: "Novo contrato" };

export default function NewContractPage({ searchParams }: PageProps<"/contratos/novo">) {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <NewContractContent searchParams={searchParams} />
    </Suspense>
  );
}

async function NewContractContent({ searchParams }: { searchParams: PageProps<"/contratos/novo">["searchParams"] }) {
  await requireFinance();
  const raw = await searchParams;
  const ticketId = typeof raw.ticketId === "string" ? raw.ticketId : "";
  const quoteId = typeof raw.quoteId === "string" ? raw.quoteId : "";
  const [suppliers, sectors, tickets, quoteDraft, ticket] = await Promise.all([
    listSuppliersForContracts(),
    listSectorsForContracts(),
    listInclusionTicketsForContracts(ticketId || null),
    quoteId ? getApprovedQuoteDraft(quoteId) : Promise.resolve(null),
    ticketId
      ? db.ticket.findUnique({
          where: { id: ticketId },
          select: { id: true, title: true, description: true, sectorId: true, type: true, status: true },
        })
      : Promise.resolve(null),
  ]);

  const fromTicket = ticket?.type === "CONTRACT_INCLUSION" && ticket.status !== "CANCELED" ? ticket : null;
  const today = toDateInputValue(new Date());

  const draft = quoteDraft
    ? {
        code: "",
        object: quoteDraft.object,
        monthlyValue: "",
        totalValue: quoteDraft.totalValue,
        startDate: today,
        endDate: "",
        renewalDate: "",
        autoRenew: false,
        alertDaysBefore: "30",
        notes: quoteDraft.notes,
        sectorId: quoteDraft.sectorId,
        ticketId: fromTicket?.id ?? "",
        supplierId: quoteDraft.supplierId,
        quoteId: quoteDraft.quoteId,
      }
    : fromTicket
      ? {
          code: "",
          object: fromTicket.title,
          monthlyValue: "",
          totalValue: "",
          startDate: today,
          endDate: "",
          renewalDate: "",
          autoRenew: false,
          alertDaysBefore: "30",
          notes: fromTicket.description,
          sectorId: fromTicket.sectorId,
          ticketId: fromTicket.id,
          supplierId: "",
          quoteId: "",
        }
      : undefined;

  return (
    <>
      <PageHeader
        title="Novo contrato"
        description={
          quoteDraft
            ? "Pré-preenchido a partir do orçamento aprovado. Confira objeto, fornecedor e valores."
            : fromTicket
              ? "Pré-preenchido a partir do chamado de inclusão. Ao salvar, o chamado é concluído."
              : "Fornecedor, objeto, valores, vigência e o PDF do contrato assinado."
        }
      />
      <ContractForm suppliers={suppliers} sectors={sectors} tickets={tickets} draft={draft} />
    </>
  );
}
