import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { TicketForm } from "@/features/tickets/components/ticket-form";
import { requireRole } from "@/lib/dal";

export const metadata: Metadata = { title: "Novo chamado" };

export default async function NewTicketPage() {
  const user = await requireRole("REQUESTER");
  return (
    <>
      <PageHeader
        title="Novo chamado"
        description={`Setor ${user.sector?.name ?? ""}. O financeiro avalia se o pedido é viável.`}
      />
      <TicketForm sectorName={user.sector?.name ?? "Setor não informado"} />
    </>
  );
}
