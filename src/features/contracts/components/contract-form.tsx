"use client";

import { useActionState, useState } from "react";
import { AttachmentLinks } from "@/components/shared/attachment-links";
import { FieldError } from "@/components/shared/field-error";
import { FileUpload } from "@/components/shared/file-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { createContract, updateContract } from "../actions";

type Supplier = { id: string; legalName: string; cnpj: string };
type Sector = { id: string; name: string; costCenter: string };
type Ticket = { id: string; code: number; title: string; sector: { name: string; costCenter: string } };

export type ContractFormValues = {
  id: string;
  code: string;
  object: string;
  monthlyValue: string;
  totalValue: string;
  startDate: string;
  endDate: string;
  renewalDate: string;
  autoRenew: boolean;
  alertDaysBefore: string;
  notes: string;
  sectorId: string;
  ticketId: string;
  supplierId: string;
  quoteId: string;
};

export function ContractForm({
  suppliers,
  sectors,
  tickets,
  contract,
  draft,
  existingPdfs = [],
}: {
  suppliers: Supplier[];
  sectors: Sector[];
  tickets: Ticket[];
  contract?: ContractFormValues;
  draft?: Omit<ContractFormValues, "id">;
  existingPdfs?: { id: string; fileName: string; fileSize: number }[];
}) {
  const editing = Boolean(contract?.id);
  const initial = contract ?? draft;
  const action = editing ? updateContract : createContract;
  const [state, formAction, pending] = useActionState(action, undefined);
  const [supplierId, setSupplierId] = useState(initial?.supplierId ?? "");
  const [uploading, setUploading] = useState(false);
  const errors = state?.fieldErrors;
  const isNewSupplier = !supplierId;
  const busy = pending || uploading;

  return (
    <form action={formAction} className="grid max-w-2xl gap-4">
      {editing ? <input type="hidden" name="contractId" value={contract!.id} /> : null}
      {initial?.quoteId ? <input type="hidden" name="quoteId" value={initial.quoteId} /> : null}
      {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <div className="grid gap-2">
        <Label htmlFor="object">Objeto</Label>
        <Textarea id="object" name="object" required rows={3} defaultValue={initial?.object} />
        <FieldError messages={errors?.object} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="code">Número do contrato (opcional)</Label>
          <Input id="code" name="code" defaultValue={initial?.code} />
          <FieldError messages={errors?.code} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="alertDaysBefore">Dias de antecedência do alerta</Label>
          <Input id="alertDaysBefore" name="alertDaysBefore" type="number" min={0} max={365} defaultValue={initial?.alertDaysBefore ?? "30"} />
          <FieldError messages={errors?.alertDaysBefore} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="monthlyValue">Valor mensal (R$)</Label>
          <Input id="monthlyValue" name="monthlyValue" inputMode="decimal" placeholder="1.234,56" defaultValue={initial?.monthlyValue} />
          <FieldError messages={errors?.monthlyValue} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="totalValue">Valor total (R$)</Label>
          <Input id="totalValue" name="totalValue" inputMode="decimal" placeholder="12.345,67" defaultValue={initial?.totalValue} />
          <FieldError messages={errors?.totalValue} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor="startDate">Início</Label>
          <Input id="startDate" name="startDate" type="date" required defaultValue={initial?.startDate} />
          <FieldError messages={errors?.startDate} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="endDate">Término</Label>
          <Input id="endDate" name="endDate" type="date" defaultValue={initial?.endDate} />
          <FieldError messages={errors?.endDate} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="renewalDate">Renovação / reajuste</Label>
          <Input id="renewalDate" name="renewalDate" type="date" defaultValue={initial?.renewalDate} />
          <FieldError messages={errors?.renewalDate} />
        </div>
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="autoRenew" value="1" defaultChecked={initial?.autoRenew} className="mt-1 size-4" />
        <span>Renovação automática — o cron não marca como vencido ao passar o término.</span>
      </label>

      <div className="grid gap-2">
        <Label htmlFor="sectorId">Setor / centro de custo</Label>
        <NativeSelect id="sectorId" name="sectorId" required className="w-full" defaultValue={initial?.sectorId ?? ""}>
          <NativeSelectOption value="">Escolha o setor</NativeSelectOption>
          {sectors.map((s) => (
            <NativeSelectOption key={s.id} value={s.id}>
              {s.name} ({s.costCenter})
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <FieldError messages={errors?.sectorId} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="supplierId">Fornecedor</Label>
        <NativeSelect
          id="supplierId"
          name="supplierId"
          className="w-full"
          value={supplierId}
          onChange={(e) => setSupplierId(e.target.value)}
        >
          <NativeSelectOption value="">Novo fornecedor</NativeSelectOption>
          {suppliers.map((s) => (
            <NativeSelectOption key={s.id} value={s.id}>
              {s.legalName}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      {isNewSupplier ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="supplierLegalName">Razão social</Label>
            <Input id="supplierLegalName" name="supplierLegalName" />
            <FieldError messages={errors?.supplierLegalName} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="supplierCnpj">CNPJ</Label>
            <Input id="supplierCnpj" name="supplierCnpj" inputMode="numeric" placeholder="00.000.000/0000-00" />
            <FieldError messages={errors?.supplierCnpj} />
          </div>
        </div>
      ) : null}

      <div className="grid gap-2">
        <Label htmlFor="ticketId">Chamado de inclusão (opcional)</Label>
        <NativeSelect id="ticketId" name="ticketId" className="w-full" defaultValue={initial?.ticketId ?? ""}>
          <NativeSelectOption value="">Sem vínculo</NativeSelectOption>
          {tickets.map((t) => (
            <NativeSelectOption key={t.id} value={t.id}>
              #{t.code} {t.title} · {t.sector.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <p className="text-xs text-muted-foreground">Ao salvar com um chamado de inclusão, ele é concluído.</p>
        <FieldError messages={errors?.ticketId} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="notes">Observações</Label>
        <Textarea id="notes" name="notes" rows={3} defaultValue={initial?.notes} />
        <FieldError messages={errors?.notes} />
      </div>

      <div className="grid gap-2">
        <Label>PDF do contrato assinado</Label>
        {existingPdfs.length ? <AttachmentLinks items={existingPdfs} /> : null}
        <FileUpload category="CONTRACT" multiple={false} accept="application/pdf" onBusyChange={setUploading} />
        <p className="text-xs text-muted-foreground">
          {editing
            ? "Anexe outro PDF se precisar complementar. Aguarde o nome do arquivo aparecer antes de salvar."
            : "Anexe o PDF assinado. Aguarde o nome do arquivo aparecer antes de salvar."}
        </p>
      </div>

      <Button type="submit" disabled={busy}>
        {busy ? "Salvando…" : editing ? "Salvar alterações" : "Cadastrar contrato"}
      </Button>
    </form>
  );
}
