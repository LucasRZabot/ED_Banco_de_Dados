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
import { createBill, updateBill } from "../actions";

type Sector = { id: string; name: string; costCenter: string };
type Supplier = { id: string; legalName: string; cnpj: string };
export type BillFormValues = {
  id: string;
  digitableLine: string;
  amount: string;
  dueDate: string;
  description: string;
  installment: string;
  sectorId: string;
  supplierId: string;
};

export function BillForm({
  sectors,
  suppliers,
  bill,
  existingPdfs = [],
}: {
  sectors: Sector[];
  suppliers: Supplier[];
  bill?: BillFormValues;
  existingPdfs?: { id: string; fileName: string; fileSize: number }[];
}) {
  const action = bill ? updateBill : createBill;
  const [state, formAction, pending] = useActionState(action, undefined);
  const [supplierId, setSupplierId] = useState(bill?.supplierId ?? "");
  const [dueDate, setDueDate] = useState(bill?.dueDate ?? "");
  const [uploading, setUploading] = useState(false);
  const errors = state?.fieldErrors;
  const isNewSupplier = !supplierId;
  const busy = pending || uploading;

  return (
    <form action={formAction} className="grid max-w-2xl gap-4">
      {bill ? <input type="hidden" name="billId" value={bill.id} /> : null}
      {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <div className="grid gap-2">
        <Label htmlFor="digitableLine">Linha digitável</Label>
        <Input
          id="digitableLine"
          name="digitableLine"
          required
          inputMode="numeric"
          autoComplete="off"
          placeholder="47 dígitos (boleto) ou 48 (convênio)"
          defaultValue={bill?.digitableLine}
        />
        <p className="text-xs text-muted-foreground">Pode colar com pontos e espaços; gravamos só os dígitos.</p>
        <FieldError messages={errors?.digitableLine} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="amount">Valor (R$)</Label>
          <Input id="amount" name="amount" required inputMode="decimal" placeholder="1.234,56" defaultValue={bill?.amount} />
          <FieldError messages={errors?.amount} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="dueDate">Vencimento</Label>
          <Input
            id="dueDate"
            name="dueDate"
            type="date"
            required
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
          <FieldError messages={errors?.dueDate} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="sectorId">Setor / centro de custo</Label>
          <NativeSelect id="sectorId" name="sectorId" required className="w-full" defaultValue={bill?.sectorId ?? ""}>
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
          <Label htmlFor="installment">Parcela (opcional)</Label>
          <Input id="installment" name="installment" type="number" min={1} defaultValue={bill?.installment} />
          <FieldError messages={errors?.installment} />
        </div>
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
        <Label htmlFor="description">Descrição</Label>
        <Textarea id="description" name="description" rows={3} defaultValue={bill?.description} />
        <FieldError messages={errors?.description} />
      </div>

      <div className="grid gap-2">
        <Label>PDF do boleto</Label>
        {existingPdfs.length ? <AttachmentLinks items={existingPdfs} /> : null}
        <FileUpload
          category="BILL"
          multiple={false}
          accept="application/pdf"
          referenceDate={dueDate || undefined}
          onBusyChange={setUploading}
        />
        <p className="text-xs text-muted-foreground">
          Anexe o PDF para a coordenação abrir e visualizar. Aguarde o nome do arquivo aparecer antes de salvar.
        </p>
      </div>

      <Button type="submit" disabled={busy}>
        {busy ? "Salvando…" : bill ? "Salvar alterações" : "Cadastrar boleto"}
      </Button>
    </form>
  );
}
