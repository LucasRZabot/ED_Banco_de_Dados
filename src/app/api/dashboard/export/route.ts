import { buildDashboardCsv, parseDashboardFilters, relevantLists, type DashboardCsvRow } from "@/features/dashboard/filters";
import { getDashboardSnapshot } from "@/features/dashboard/queries";
import { authenticateRequest } from "@/lib/dal";
import { formatBRL, formatDateOnly, ticketCode } from "@/lib/format";

export async function GET(request: Request) {
  const { user, error } = await authenticateRequest();
  if (error) return error;
  if (user.role !== "FINANCEIRO") {
    return Response.json({ error: "Acesso restrito à coordenação financeira." }, { status: 403 });
  }

  const url = new URL(request.url);
  const filters = parseDashboardFilters({
    status: url.searchParams.get("status") ?? undefined,
    supplierId: url.searchParams.get("supplierId") ?? undefined,
    sectorId: url.searchParams.get("sectorId") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  });
  const snap = await getDashboardSnapshot(filters);
  const lists = relevantLists(filters.status);
  const rows: DashboardCsvRow[] = [];

  if (lists.has("bills") && filters.status !== "BILL_PAID") {
    for (const b of snap.alertBills) {
      rows.push({
        tipo: "boleto",
        vencimento: formatDateOnly(b.dueDate),
        fornecedor: b.supplier.legalName,
        setor: `${b.sector.name} (${b.sector.costCenter})`,
        valor: formatBRL(b.amount),
        status: b.dueDate < snap.today ? "Atrasado" : "A pagar",
        titulo: b.description ?? "",
      });
    }
  }
  if (lists.has("bills") && filters.status === "BILL_PAID") {
    for (const b of snap.paidBillItems) {
      rows.push({
        tipo: "boleto",
        vencimento: formatDateOnly(b.paidAt),
        fornecedor: b.supplier.legalName,
        setor: `${b.sector.name} (${b.sector.costCenter})`,
        valor: formatBRL(b.paidAmount ?? b.amount),
        status: "Pago",
        titulo: b.description ?? "",
      });
    }
  }
  if (lists.has("invoices")) {
    for (const n of snap.pendingInvoiceItems) {
      rows.push({
        tipo: "nota_fiscal",
        vencimento: formatDateOnly(n.issueDate ?? n.createdAt),
        fornecedor: n.supplier?.legalName ?? "",
        setor: `${n.sector.name} (${n.sector.costCenter})`,
        valor: formatBRL(n.amount),
        status: "Pendente",
        titulo: n.description,
      });
    }
  }
  if (lists.has("contracts")) {
    for (const c of snap.expiringContractItems) {
      const due = c.renewalDate && (!c.endDate || c.renewalDate <= c.endDate) ? c.renewalDate : c.endDate;
      rows.push({
        tipo: "contrato",
        vencimento: formatDateOnly(due),
        fornecedor: c.supplier.legalName,
        setor: `${c.sector.name} (${c.sector.costCenter})`,
        valor: formatBRL(c.monthlyValue),
        status: "Ativo",
        titulo: c.object,
      });
    }
  }
  if (lists.has("tickets")) {
    for (const t of snap.pendingTicketItems) {
      rows.push({
        tipo: "chamado",
        vencimento: formatDateOnly(t.neededBy ?? t.createdAt),
        fornecedor: "",
        setor: `${t.sector.name} (${t.sector.costCenter})`,
        valor: "",
        status: t.status,
        titulo: `${ticketCode(t.code)} ${t.title}`,
      });
    }
  }
  if (lists.has("quotes")) {
    for (const q of snap.pendingQuoteItems) {
      rows.push({
        tipo: "orcamento",
        vencimento: formatDateOnly(q.validUntil),
        fornecedor: q.supplier.legalName,
        setor: q.ticket?.sector ? `${q.ticket.sector.name} (${q.ticket.sector.costCenter})` : "",
        valor: formatBRL(q.amount),
        status: "Pendente",
        titulo: q.ticket?.title ?? q.description ?? "",
      });
    }
  }

  const csv = buildDashboardCsv(rows);
  const stamp = url.searchParams.get("from") ?? "dashboard";
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="dashboard-${stamp}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
