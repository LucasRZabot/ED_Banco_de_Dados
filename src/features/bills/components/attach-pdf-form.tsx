"use client";

import { useActionState, useState } from "react";
import { FileUpload } from "@/components/shared/file-upload";
import { Button } from "@/components/ui/button";
import { attachBillPdf } from "../actions";

export function AttachBillPdfForm({ billId, dueDate }: { billId: string; dueDate: string }) {
  const [state, action, pending] = useActionState(attachBillPdf, undefined);
  const [uploading, setUploading] = useState(false);
  const busy = pending || uploading;

  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="billId" value={billId} />
      {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <FileUpload
        category="BILL"
        multiple={false}
        accept="application/pdf"
        referenceDate={dueDate}
        onBusyChange={setUploading}
      />
      <Button type="submit" disabled={busy} variant="outline">
        {busy ? "Anexando…" : "Salvar PDF do boleto"}
      </Button>
    </form>
  );
}
