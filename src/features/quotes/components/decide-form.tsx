"use client";

import { useActionState } from "react";
import { FieldError } from "@/components/shared/field-error";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { decideQuote } from "../actions";

export function DecideQuoteForm({ quoteId, hasSiblings }: { quoteId: string; hasSiblings: boolean }) {
  const [state, action, pending] = useActionState(decideQuote, undefined);

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="quoteId" value={quoteId} />
      {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <div className="grid gap-2">
        <Label htmlFor="decisionNote">Nota da decisão</Label>
        <Textarea id="decisionNote" name="decisionNote" rows={3} placeholder="Obrigatória na reprovação." />
        <FieldError messages={state?.fieldErrors?.decisionNote} />
      </div>

      {hasSiblings ? (
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="rejectSiblings" value="1" defaultChecked className="mt-1 size-4" />
          <span>Ao aprovar, reprovar automaticamente os demais orçamentos pendentes deste chamado.</span>
        </label>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" name="decision" value="APPROVED" disabled={pending}>
          {pending ? "Salvando…" : "Aprovar"}
        </Button>
        <Button type="submit" name="decision" value="REJECTED" variant="destructive" disabled={pending}>
          {pending ? "Salvando…" : "Reprovar"}
        </Button>
      </div>
    </form>
  );
}
