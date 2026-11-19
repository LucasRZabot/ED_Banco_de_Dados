import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { DASHBOARD_STATUS_LABELS } from "../labels";
import { DASHBOARD_STATUSES, type DashboardFilters } from "../schemas";
import { withQuery } from "../filters";

export function DashboardFiltersBar({
  filters,
  sectors,
  suppliers,
}: {
  filters: DashboardFilters;
  sectors: { id: string; name: string; costCenter: string }[];
  suppliers: { id: string; legalName: string }[];
}) {
  const exportHref = withQuery("/api/dashboard/export", {
    status: filters.status,
    supplierId: filters.supplierId,
    sectorId: filters.sectorId,
    from: filters.from,
    to: filters.to,
  });

  return (
    <form method="get" className="flex flex-wrap items-end gap-3">
      <NativeSelect name="status" defaultValue={filters.status ?? ""} className="w-52" aria-label="Status">
        <NativeSelectOption value="">Todos os status</NativeSelectOption>
        {DASHBOARD_STATUSES.map((s) => (
          <NativeSelectOption key={s} value={s}>
            {DASHBOARD_STATUS_LABELS[s]}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <NativeSelect name="supplierId" defaultValue={filters.supplierId ?? ""} className="w-56" aria-label="Fornecedor">
        <NativeSelectOption value="">Todos os fornecedores</NativeSelectOption>
        {suppliers.map((s) => (
          <NativeSelectOption key={s.id} value={s.id}>
            {s.legalName}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <NativeSelect name="sectorId" defaultValue={filters.sectorId ?? ""} className="w-56" aria-label="Centro de custo">
        <NativeSelectOption value="">Setor / centro de custo</NativeSelectOption>
        {sectors.map((s) => (
          <NativeSelectOption key={s.id} value={s.id}>
            {s.name} ({s.costCenter})
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <Input type="date" name="from" defaultValue={filters.from ?? ""} className="w-40" aria-label="Período de" />
      <Input type="date" name="to" defaultValue={filters.to ?? ""} className="w-40" aria-label="Período até" />
      <Button type="submit" variant="outline">
        Filtrar
      </Button>
      <Button nativeButton={false} variant="ghost" render={<Link href="/dashboard" />}>
        Limpar
      </Button>
      <Button nativeButton={false} variant="outline" render={<a href={exportHref} download="dashboard.csv" />}>
        Exportar CSV
      </Button>
    </form>
  );
}
