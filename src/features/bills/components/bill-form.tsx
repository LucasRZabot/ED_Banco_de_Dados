"use client";

import { useActionState, useState } from "react";
import { FieldError } from "@/components/shared/field-error";
import { FileUpload } from "@/components/shared/file-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { createBill } from "../actions";

type Sector = { id: string; name: string; costCenter: string };
type Supplier = { id: string; legalName: string; cnpj: string };

export function BillForm({ sectors, suppliers }: { sectors: Sector[]; suppliers: Supplier[] }) {
  const [state, action, pending] = useActionState(createBill, undefined);
  const [supplierId, setSupplierId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const errors = state?.fieldErrors;
  const isNewSupplier = !supplierId;

  return (
    <form action={action} className="grid max-w-2xl gap-4">
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
        />
        <p className="text-xs text-muted-foreground">Pode colar com pontos e espaços; gravamos só os dígitos.</p>
        <FieldError messages={errors?.digitableLine} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="amount">Valor (R$)</Label>
          <Input id="amount" name="amount" required inputMode="decimal" placeholder="1.234,56" />
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
          <NativeSelect id="sectorId" name="sectorId" required className="w-full" defaultValue="">
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
          <Input id="installment" name="installment" type="number" min={1} />
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
        <Textarea id="description" name="description" rows={3} />
        <FieldError messages={errors?.description} />
      </div>

      <div className="grid gap-2">
        <Label>PDF do boleto (opcional)</Label>
        <FileUpload category="BILL" multiple={false} referenceDate={dueDate || undefined} />
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Salvando…" : "Cadastrar boleto"}
      </Button>
    </form>
  );
}
