import type { Metadata } from "next";
import { ClipboardList } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requireRole } from "@/lib/dal";

export const metadata: Metadata = { title: "Chamados" };

export default async function TicketsPage() {
  const user = await requireRole("FINANCEIRO", "REQUESTER");
  const scope =
    user.role === "FINANCEIRO"
      ? "Você avalia cada chamado: se for viável, segue para Em Processamento e depois Concluído; se não, é Cancelado com um motivo visível para quem abriu."
      : "Você vê somente os chamados que você mesma abriu, com o resultado: Em Processamento, Concluído ou Cancelado (com o motivo).";

  return (
    <>
      <PageHeader title="Chamados" description={scope} />
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
          <ClipboardList className="size-8 text-muted-foreground" />
          <p className="font-medium">Módulo de chamados em construção (Etapa 3)</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Abertura de pedidos de compra/orçamento e inclusão de contrato, com anexos, comentários e
            acompanhamento de status.
          </p>
        </CardContent>
      </Card>
    </>
  );
}
