import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { BILL_STATUS_LABELS } from "../labels";
import { BILL_STATUSES } from "../labels";
import type { BillFilters } from "../schemas";

export function BillFiltersBar({
  filters,
  sectors,
  suppliers,
}: {
  filters: BillFilters;
  sectors: { id: string; name: string; costCenter: string }[];
  suppliers: { id: string; legalName: string }[];
}) {
  return (
    <form method="get" className="flex flex-wrap items-end gap-3">
      <Input name="q" defaultValue={filters.q ?? ""} placeholder="Buscar fornecedor ou linha" className="w-56" />
      <NativeSelect name="status" defaultValue={filters.status ?? ""} className="w-40">
        <NativeSelectOption value="">Todos os status</NativeSelectOption>
        {BILL_STATUSES.map((s) => (
          <NativeSelectOption key={s} value={s}>
            {BILL_STATUS_LABELS[s]}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <NativeSelect name="supplierId" defaultValue={filters.supplierId ?? ""} className="w-56">
        <NativeSelectOption value="">Todos os fornecedores</NativeSelectOption>
        {suppliers.map((s) => (
          <NativeSelectOption key={s.id} value={s.id}>
            {s.legalName}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <NativeSelect name="sectorId" defaultValue={filters.sectorId ?? ""} className="w-56">
        <NativeSelectOption value="">Setor / centro de custo</NativeSelectOption>
        {sectors.map((s) => (
          <NativeSelectOption key={s.id} value={s.id}>
            {s.name} ({s.costCenter})
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <Input type="date" name="from" defaultValue={filters.from ?? ""} className="w-40" aria-label="Vencimento de" />
      <Input type="date" name="to" defaultValue={filters.to ?? ""} className="w-40" aria-label="Vencimento até" />
      <Button type="submit" variant="outline">
        Filtrar
      </Button>
    </form>
  );
}
