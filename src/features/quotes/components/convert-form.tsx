"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FieldError } from "@/components/shared/field-error";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { convertQuoteToInvoice } from "../actions";

type Sector = { id: string; name: string; costCenter: string };

export function ConvertQuoteForm({
  quoteId,
  defaultSectorId,
  sectors,
  needSector,
  invoiceId,
}: {
  quoteId: string;
  defaultSectorId?: string;
  sectors: Sector[];
  needSector: boolean;
  invoiceId?: string;
}) {
  const [state, action, pending] = useActionState(convertQuoteToInvoice, undefined);

  if (invoiceId) {
    return (
      <div className="grid gap-3">
        <p className="text-sm text-muted-foreground">Este orçamento já gerou um lançamento.</p>
        <Button nativeButton={false} render={<Link href={`/notas-fiscais/${invoiceId}`} />}>
          Abrir nota fiscal
        </Button>
      </div>
    );
  }

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="quoteId" value={quoteId} />
      {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      {needSector ? (
        <div className="grid gap-2">
          <Label htmlFor="sectorId">Setor / centro de custo da nota</Label>
          <NativeSelect id="sectorId" name="sectorId" required className="w-full" defaultValue={defaultSectorId ?? ""}>
            <NativeSelectOption value="">Escolha o setor</NativeSelectOption>
            {sectors.map((s) => (
              <NativeSelectOption key={s.id} value={s.id}>
                {s.name} ({s.costCenter})
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <FieldError messages={state?.fieldErrors?.sectorId} />
        </div>
      ) : (
        <input type="hidden" name="sectorId" value={defaultSectorId ?? ""} />
      )}

      <p className="text-sm text-muted-foreground">
        Abre uma nota pendente com fornecedor, valor e chamado preenchidos. O chamado só é concluído quando você lançar a
        nota.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Convertendo…" : "Converter em lançamento (NF)"}
        </Button>
        <Button nativeButton={false} variant="outline" render={<Link href={`/boletos/novo?quoteId=${quoteId}`} />}>
          Gerar boleto a partir deste orçamento
        </Button>
      </div>

      <Alert>
        <AlertTitle>Converter em contrato</AlertTitle>
        <AlertDescription>
          Se esta proposta virar contrato, abra o cadastro já com fornecedor e valor. Chamados de inclusão também
          convertem direto pela tela do chamado.
        </AlertDescription>
      </Alert>
      <Button nativeButton={false} variant="outline" render={<Link href={`/contratos/novo?quoteId=${quoteId}`} />}>
        Converter em contrato
      </Button>
    </form>
  );
}
