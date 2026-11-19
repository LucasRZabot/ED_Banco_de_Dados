import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { CONTRACT_STATUS_LABELS, CONTRACT_STATUSES } from "../labels";
import type { ContractFilters } from "../schemas";

export function ContractFiltersBar({
  filters,
  suppliers,
  sectors,
}: {
  filters: ContractFilters;
  suppliers: { id: string; legalName: string }[];
  sectors: { id: string; name: string; costCenter: string }[];
}) {
  return (
    <form method="get" className="flex flex-wrap items-end gap-3">
      <Input name="q" defaultValue={filters.q ?? ""} placeholder="Buscar objeto, número ou fornecedor" className="w-64" />
      <NativeSelect name="status" defaultValue={filters.status ?? ""} className="w-40">
        <NativeSelectOption value="">Todos os status</NativeSelectOption>
        {CONTRACT_STATUSES.map((s) => (
          <NativeSelectOption key={s} value={s}>
            {CONTRACT_STATUS_LABELS[s]}
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
      <NativeSelect name="sectorId" defaultValue={filters.sectorId ?? ""} className="w-48">
        <NativeSelectOption value="">Setor / centro de custo</NativeSelectOption>
        {sectors.map((s) => (
          <NativeSelectOption key={s.id} value={s.id}>
            {s.name}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <NativeSelect name="expiring" defaultValue={filters.expiring ?? ""} className="w-52">
        <NativeSelectOption value="">Todos os prazos</NativeSelectOption>
        <NativeSelectOption value="1">Vencem/renovam em 30 dias</NativeSelectOption>
      </NativeSelect>
      <Input type="date" name="from" defaultValue={filters.from ?? ""} className="w-40" aria-label="Prazo de" />
      <Input type="date" name="to" defaultValue={filters.to ?? ""} className="w-40" aria-label="Prazo até" />
      <Button type="submit" variant="outline">
        Filtrar
      </Button>
    </form>
  );
}
