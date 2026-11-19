import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { QUOTE_STATUS_LABELS, QUOTE_STATUSES } from "../labels";
import type { QuoteFilters } from "../schemas";

export function QuoteFiltersBar({
  filters,
  suppliers,
  tickets,
}: {
  filters: QuoteFilters;
  suppliers: { id: string; legalName: string }[];
  tickets: { id: string; code: number; title: string }[];
}) {
  return (
    <form method="get" className="flex flex-wrap items-end gap-3">
      <Input name="q" defaultValue={filters.q ?? ""} placeholder="Buscar fornecedor ou descrição" className="w-56" />
      <NativeSelect name="status" defaultValue={filters.status ?? ""} className="w-40">
        <NativeSelectOption value="">Todos os status</NativeSelectOption>
        {QUOTE_STATUSES.map((s) => (
          <NativeSelectOption key={s} value={s}>
            {QUOTE_STATUS_LABELS[s]}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <NativeSelect name="supplierId" defaultValue={filters.supplierId ?? ""} className="w-52">
        <NativeSelectOption value="">Todos os fornecedores</NativeSelectOption>
        {suppliers.map((s) => (
          <NativeSelectOption key={s.id} value={s.id}>
            {s.legalName}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <NativeSelect name="ticketId" defaultValue={filters.ticketId ?? ""} className="w-56">
        <NativeSelectOption value="">Todos os chamados</NativeSelectOption>
        {tickets.map((t) => (
          <NativeSelectOption key={t.id} value={t.id}>
            #{t.code} {t.title}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <Input type="date" name="from" defaultValue={filters.from ?? ""} className="w-40" aria-label="Validade de" />
      <Input type="date" name="to" defaultValue={filters.to ?? ""} className="w-40" aria-label="Validade até" />
      <Button type="submit" variant="outline">
        Filtrar
      </Button>
    </form>
  );
}
