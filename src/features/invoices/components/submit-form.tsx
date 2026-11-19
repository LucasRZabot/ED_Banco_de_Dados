"use client";

import { useActionState, useState } from "react";
import { FieldError } from "@/components/shared/field-error";
import { FileUpload } from "@/components/shared/file-upload";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { todayInTz, toDateInputValue } from "@/lib/dates";
import { submitInvoice } from "../actions";

type Sector = { id: string; name: string; costCenter: string };

export function InvoiceSubmitForm({
  sectors,
  lockedSectorName,
}: {
  sectors: Sector[];
  lockedSectorName?: string;
}) {
  const [state, action, pending] = useActionState(submitInvoice, undefined);
  const [uploading, setUploading] = useState(false);
  const errors = state?.fieldErrors;
  const busy = pending || uploading;
  const referenceDate = toDateInputValue(todayInTz());

  return (
    <form action={action} className="grid max-w-2xl gap-4">
      {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      {lockedSectorName ? (
        <div className="grid gap-2">
          <Label>Setor</Label>
          <p className="text-sm">{lockedSectorName}</p>
          <p className="text-xs text-muted-foreground">A nota fica no seu setor. Não é possível alterar.</p>
        </div>
      ) : (
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
      )}

      <div className="grid gap-2">
        <Label htmlFor="description">Do que se trata a nota</Label>
        <Textarea id="description" name="description" required minLength={8} rows={4} />
        <p className="text-xs text-muted-foreground">
          Descreva o material, serviço ou custo. Número, fornecedor e valor entram no lançamento do financeiro.
        </p>
        <FieldError messages={errors?.description} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>PDF da nota</Label>
          <FileUpload
            name="pdfTokens"
            category="INVOICE_PDF"
            multiple={false}
            accept="application/pdf"
            referenceDate={referenceDate}
            onBusyChange={setUploading}
          />
        </div>
        <div className="grid gap-2">
          <Label>XML da NF-e</Label>
          <FileUpload
            name="xmlTokens"
            category="INVOICE_XML"
            multiple={false}
            accept="application/xml,text/xml,.xml"
            referenceDate={referenceDate}
            onBusyChange={setUploading}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Envie o PDF, o XML ou os dois. Aguarde o nome do arquivo aparecer.</p>

      <Button type="submit" disabled={busy}>
        {busy ? "Enviando…" : "Enviar nota"}
      </Button>
    </form>
  );
}
