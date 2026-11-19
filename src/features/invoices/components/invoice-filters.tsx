import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { INVOICE_STATUS_LABELS } from "../labels";
import type { InvoiceFilters } from "../schemas";
import { INVOICE_STATUSES } from "../labels";

export function InvoiceFiltersBar({
  filters,
  sectors,
  suppliers,
  showFinanceFilters,
}: {
  filters: InvoiceFilters;
  sectors: { id: string; name: string; costCenter: string }[];
  suppliers: { id: string; legalName: string }[];
  showFinanceFilters: boolean;
}) {
  return (
    <form method="get" className="flex flex-wrap items-end gap-3">
      <Input name="q" defaultValue={filters.q ?? ""} placeholder="Buscar descrição ou número" className="w-56" />
      <NativeSelect name="status" defaultValue={filters.status ?? ""} className="w-40">
        <NativeSelectOption value="">Todos os status</NativeSelectOption>
        {INVOICE_STATUSES.map((s) => (
          <NativeSelectOption key={s} value={s}>
            {INVOICE_STATUS_LABELS[s]}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      {showFinanceFilters ? (
        <>
          <NativeSelect name="supplierId" defaultValue={filters.supplierId ?? ""} className="w-52">
            <NativeSelectOption value="">Todos os fornecedores</NativeSelectOption>
            {suppliers.map((s) => (
              <NativeSelectOption key={s.id} value={s.id}>
                {s.legalName}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <NativeSelect name="sectorId" defaultValue={filters.sectorId ?? ""} className="w-48">
            <NativeSelectOption value="">Setor / centro de custo</NativeSelectOption>
            {sectors.map((s) => (
              <NativeSelectOption key={s.id} value={s.id}>
                {s.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </>
      ) : null}
      <Input type="date" name="from" defaultValue={filters.from ?? ""} className="w-40" aria-label="Emissão de" />
      <Input type="date" name="to" defaultValue={filters.to ?? ""} className="w-40" aria-label="Emissão até" />
      <Button type="submit" variant="outline">
        Filtrar
      </Button>
    </form>
  );
}
