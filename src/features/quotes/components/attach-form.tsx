"use client";

import { useActionState, useState } from "react";
import { FileUpload } from "@/components/shared/file-upload";
import { Button } from "@/components/ui/button";
import { attachQuoteFiles } from "../actions";

export function AttachQuoteForm({ quoteId, validUntil }: { quoteId: string; validUntil: string }) {
  const [state, action, pending] = useActionState(attachQuoteFiles, undefined);
  const [uploading, setUploading] = useState(false);
  const busy = pending || uploading;

  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="quoteId" value={quoteId} />
      {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <FileUpload
        category="QUOTE"
        multiple={false}
        accept="application/pdf"
        referenceDate={validUntil}
        onBusyChange={setUploading}
      />
      <Button type="submit" disabled={busy} variant="outline">
        {busy ? "Anexando…" : "Salvar PDF"}
      </Button>
    </form>
  );
}
