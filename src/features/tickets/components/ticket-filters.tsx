import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { TICKET_STATUS_LABELS, TICKET_TYPE_LABELS, URGENCY_LABELS } from "../labels";
import type { TicketFilters } from "../schemas";
import { TICKET_STATUSES, TICKET_TYPES, URGENCIES } from "../status-machine";

export function TicketFiltersBar({
  filters,
  sectors,
  showSector,
}: {
  filters: TicketFilters;
  sectors: { id: string; name: string; costCenter: string }[];
  showSector: boolean;
}) {
  return (
    <form method="get" className="flex flex-wrap items-end gap-3">
      <Input name="q" defaultValue={filters.q ?? ""} placeholder="Buscar título" className="w-48" />
      <NativeSelect name="status" defaultValue={filters.status ?? ""} className="w-44">
        <NativeSelectOption value="">Todos os status</NativeSelectOption>
        {TICKET_STATUSES.map((s) => (
          <NativeSelectOption key={s} value={s}>
            {TICKET_STATUS_LABELS[s]}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <NativeSelect name="type" defaultValue={filters.type ?? ""} className="w-52">
        <NativeSelectOption value="">Todos os tipos</NativeSelectOption>
        {TICKET_TYPES.map((t) => (
          <NativeSelectOption key={t} value={t}>
            {TICKET_TYPE_LABELS[t]}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <NativeSelect name="urgency" defaultValue={filters.urgency ?? ""} className="w-36">
        <NativeSelectOption value="">Urgência</NativeSelectOption>
        {URGENCIES.map((u) => (
          <NativeSelectOption key={u} value={u}>
            {URGENCY_LABELS[u]}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      {showSector ? (
        <NativeSelect name="sectorId" defaultValue={filters.sectorId ?? ""} className="w-48">
          <NativeSelectOption value="">Todos os setores</NativeSelectOption>
          {sectors.map((s) => (
            <NativeSelectOption key={s.id} value={s.id}>
              {s.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      ) : null}
      <Input type="date" name="from" defaultValue={filters.from ?? ""} className="w-40" aria-label="De" />
      <Input type="date" name="to" defaultValue={filters.to ?? ""} className="w-40" aria-label="Até" />
      <Button type="submit" variant="outline">
        Filtrar
      </Button>
    </form>
  );
}
