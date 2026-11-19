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
import { createQuote, updateQuote } from "../actions";

type Supplier = { id: string; legalName: string; cnpj: string };
type Ticket = { id: string; code: number; title: string; sector: { name: string; costCenter: string } };
export type QuoteFormValues = {
  id: string;
  amount: string;
  validUntil: string;
  description: string;
  ticketId: string;
  supplierId: string;
};

export function QuoteForm({
  suppliers,
  tickets,
  quote,
  draft,
  existingPdfs = [],
}: {
  suppliers: Supplier[];
  tickets: Ticket[];
  quote?: QuoteFormValues;
  draft?: Omit<QuoteFormValues, "id">;
  existingPdfs?: { id: string; fileName: string; fileSize: number }[];
}) {
  const editing = Boolean(quote?.id);
  const initial = quote ?? draft;
  const action = editing ? updateQuote : createQuote;
  const [state, formAction, pending] = useActionState(action, undefined);
  const [supplierId, setSupplierId] = useState(initial?.supplierId ?? "");
  const [validUntil, setValidUntil] = useState(initial?.validUntil ?? "");
  const [uploading, setUploading] = useState(false);
  const errors = state?.fieldErrors;
  const isNewSupplier = !supplierId;
  const busy = pending || uploading;

  return (
    <form action={formAction} className="grid max-w-2xl gap-4">
      {editing ? <input type="hidden" name="quoteId" value={quote!.id} /> : null}
      {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="amount">Valor cotado (R$)</Label>
          <Input id="amount" name="amount" required inputMode="decimal" placeholder="1.234,56" defaultValue={initial?.amount} />
          <FieldError messages={errors?.amount} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="validUntil">Validade da proposta</Label>
          <Input
            id="validUntil"
            name="validUntil"
            type="date"
            required
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
          />
          <FieldError messages={errors?.validUntil} />
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
        <Label htmlFor="ticketId">Chamado de compra (opcional)</Label>
        <NativeSelect id="ticketId" name="ticketId" className="w-full" defaultValue={initial?.ticketId ?? ""}>
          <NativeSelectOption value="">Sem vínculo</NativeSelectOption>
          {tickets.map((t) => (
            <NativeSelectOption key={t.id} value={t.id}>
              #{t.code} {t.title} · {t.sector.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <p className="text-xs text-muted-foreground">
          Vários orçamentos no mesmo chamado formam o comparativo. Chamados de inclusão de contrato entram na Etapa 7.
        </p>
        <FieldError messages={errors?.ticketId} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="description">Descrição da proposta</Label>
        <Textarea id="description" name="description" rows={3} defaultValue={initial?.description} />
        <FieldError messages={errors?.description} />
      </div>

      <div className="grid gap-2">
        <Label>PDF da proposta</Label>
        {existingPdfs.length ? <AttachmentLinks items={existingPdfs} /> : null}
        <FileUpload
          category="QUOTE"
          multiple={false}
          accept="application/pdf"
          referenceDate={validUntil || undefined}
          onBusyChange={setUploading}
        />
        <p className="text-xs text-muted-foreground">
          {editing
            ? "Anexe outro PDF se precisar substituir ou complementar. Aguarde o nome do arquivo aparecer antes de salvar."
            : "Anexe o PDF da proposta. Aguarde o nome do arquivo aparecer antes de salvar."}
        </p>
      </div>

      <Button type="submit" disabled={busy}>
        {busy ? "Salvando…" : editing ? "Salvar alterações" : "Cadastrar orçamento"}
      </Button>
    </form>
  );
}
