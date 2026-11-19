"use client";

import { useActionState, useState } from "react";
import { FileUpload } from "@/components/shared/file-upload";
import { Button } from "@/components/ui/button";
import { attachInvoiceFiles } from "../actions";

export function AttachInvoiceForm({ invoiceId, referenceDate }: { invoiceId: string; referenceDate?: string }) {
  const [state, action, pending] = useActionState(attachInvoiceFiles, undefined);
  const [uploading, setUploading] = useState(false);
  const busy = pending || uploading;

  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="invoiceId" value={invoiceId} />
      {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <FileUpload
          name="pdfTokens"
          category="INVOICE_PDF"
          multiple={false}
          accept="application/pdf"
          referenceDate={referenceDate}
          onBusyChange={setUploading}
        />
        <FileUpload
          name="xmlTokens"
          category="INVOICE_XML"
          multiple={false}
          accept="application/xml,text/xml,.xml"
          referenceDate={referenceDate}
          onBusyChange={setUploading}
        />
      </div>
      <Button type="submit" disabled={busy} variant="outline">
        {busy ? "Anexando…" : "Salvar anexos"}
      </Button>
    </form>
  );
}
