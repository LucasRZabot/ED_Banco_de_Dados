import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AttachmentLinks } from "@/components/shared/attachment-links";
import { PageHeader } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { AttachBillPdfForm } from "@/features/bills/components/attach-pdf-form";
import { BillForm } from "@/features/bills/components/bill-form";
import { getBillOrNotFound, listSectorsForBills, listSuppliersForBills } from "@/features/bills/queries";
import { requireFinance } from "@/lib/dal";
import { toDateInputValue } from "@/lib/dates";

export const metadata: Metadata = { title: "Editar boleto" };

export default function EditBillPage({ params }: PageProps<"/boletos/[id]/editar">) {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <EditBill params={params} />
    </Suspense>
  );
}

async function EditBill({ params }: { params: PageProps<"/boletos/[id]/editar">["params"] }) {
  const user = await requireFinance();
  const { id } = await params;
  if (!id) notFound();
  const [bill, sectors, suppliers] = await Promise.all([
    getBillOrNotFound(user, id),
    listSectorsForBills(),
    listSuppliersForBills(),
  ]);
  const pdfs = bill.attachments.filter((a) => a.category === "BILL");

  return (
    <>
      <PageHeader
        title="Editar boleto"
        description={
          bill.status === "PAID"
            ? "Este boleto já foi baixado. Os dados não mudam; você ainda pode anexar o PDF para visualizar."
            : "Altere os dados e anexe ou substitua o PDF do boleto. O comprovante de pagamento fica na baixa."
        }
      />
      {bill.status === "PAID" ? (
        <div className="grid max-w-2xl gap-4">
          <p className="text-sm text-muted-foreground">
            Este boleto já foi baixado: os valores não mudam. Você ainda pode anexar o PDF para visualizar.
          </p>
          <AttachmentLinks items={pdfs} empty="Nenhum PDF do boleto ainda." />
          <AttachBillPdfForm billId={bill.id} dueDate={toDateInputValue(bill.dueDate)} />
        </div>
      ) : (
        <BillForm
          sectors={sectors}
          suppliers={suppliers}
          existingPdfs={pdfs}
          bill={{
            id: bill.id,
            digitableLine: bill.digitableLine,
            amount: Number(bill.amount).toFixed(2).replace(".", ","),
            dueDate: toDateInputValue(bill.dueDate),
            description: bill.description ?? "",
            installment: bill.installment?.toString() ?? "",
            sectorId: bill.sectorId,
            supplierId: bill.supplierId,
          }}
        />
      )}
    </>
  );
}
