"use client";

import { useActionState, useState } from "react";
import { FileUpload } from "@/components/shared/file-upload";
import { Button } from "@/components/ui/button";
import { attachContractFile } from "../actions";

export function AttachContractForm({ contractId }: { contractId: string }) {
  const [state, action, pending] = useActionState(attachContractFile, undefined);
  const [uploading, setUploading] = useState(false);
  const busy = pending || uploading;

  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="contractId" value={contractId} />
      {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <FileUpload category="CONTRACT" multiple={false} accept="application/pdf" onBusyChange={setUploading} />
      <Button type="submit" disabled={busy} variant="outline">
        {busy ? "Anexando…" : "Salvar PDF"}
      </Button>
    </form>
  );
}
