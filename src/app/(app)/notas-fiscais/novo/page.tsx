import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { InvoiceSubmitForm } from "@/features/invoices/components/submit-form";
import { listSectorsForInvoices } from "@/features/invoices/queries";
import { requireRole } from "@/lib/dal";

export const metadata: Metadata = { title: "Nova nota fiscal" };

export default function NewInvoicePage() {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <NewInvoiceContent />
    </Suspense>
  );
}

async function NewInvoiceContent() {
  const user = await requireRole("FINANCEIRO", "REQUESTER");
  const sectors = user.role === "FINANCEIRO" ? await listSectorsForInvoices() : [];
  const sectorName = user.sector ? `${user.sector.name} (${user.sector.costCenter})` : undefined;

  return (
    <>
      <PageHeader
        title="Nova nota fiscal"
        description={
          user.role === "FINANCEIRO"
            ? "Descreva a nota, escolha o setor e anexe PDF e/ou XML. O lançamento fiscal fica no detalhe."
            : "Descreva do que se trata a nota e anexe o PDF e/ou o XML. Você verá somente as notas que você enviar."
        }
      />
      <InvoiceSubmitForm
        sectors={sectors}
        lockedSectorName={user.role === "REQUESTER" ? sectorName : undefined}
      />
    </>
  );
}
