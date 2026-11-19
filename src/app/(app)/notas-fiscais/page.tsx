import type { Metadata } from "next";
import { Receipt } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requireRole } from "@/lib/dal";

export const metadata: Metadata = { title: "Notas Fiscais" };

export default async function InvoicesPage() {
  const user = await requireRole("FINANCEIRO", "REQUESTER");
  const scope =
    user.role === "FINANCEIRO"
      ? "Você vê todas as notas enviadas e completa o lançamento: número, fornecedor, emissão e valor."
      : "Você envia as notas do seu setor com uma descrição e vê somente as que você mesma enviou.";

  return (
    <>
      <PageHeader title="Notas Fiscais" description={scope} />
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
          <Receipt className="size-8 text-muted-foreground" />
          <p className="font-medium">Lançamento de notas em construção (Etapa 5)</p>
          <p className="max-w-md text-sm text-muted-foreground">
            A chefia anexa o PDF ou XML e descreve do que se trata a nota. O Financeiro recebe e lança os
            dados fiscais.
          </p>
        </CardContent>
      </Card>
    </>
  );
}
