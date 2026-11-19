import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { BillForm } from "@/features/bills/components/bill-form";
import { listSectorsForBills, listSuppliersForBills } from "@/features/bills/queries";
import { requireFinance } from "@/lib/dal";

export const metadata: Metadata = { title: "Novo boleto" };

export default function NewBillPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <NewBillContent />
    </Suspense>
  );
}

async function NewBillContent() {
  await requireFinance();
  const [sectors, suppliers] = await Promise.all([listSectorsForBills(), listSuppliersForBills()]);

  return (
    <>
      <PageHeader
        title="Novo boleto"
        description="Linha digitável, valor, vencimento, setor, fornecedor e o PDF do boleto para a coordenação abrir e visualizar."
      />
      <BillForm sectors={sectors} suppliers={suppliers} />
    </>
  );
}
