"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { cancelInvoice } from "../actions";

export function CancelInvoiceForm({ invoiceId }: { invoiceId: string }) {
  const [state, action, pending] = useActionState(cancelInvoice, undefined);
  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="invoiceId" value={invoiceId} />
      {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <Button type="submit" variant="destructive" disabled={pending}>
        {pending ? "Cancelando…" : "Cancelar nota"}
      </Button>
    </form>
  );
}
