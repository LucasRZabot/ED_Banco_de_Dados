"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { terminateContract } from "../actions";

export function TerminateContractForm({ contractId }: { contractId: string }) {
  const [state, action, pending] = useActionState(terminateContract, undefined);

  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="contractId" value={contractId} />
      {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <Button type="submit" variant="destructive" disabled={pending}>
        {pending ? "Encerrando…" : "Encerrar contrato"}
      </Button>
    </form>
  );
}
