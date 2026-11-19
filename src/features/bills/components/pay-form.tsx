"use client";

import { useActionState } from "react";
import { FieldError } from "@/components/shared/field-error";
import { FileUpload } from "@/components/shared/file-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { payBill } from "../actions";

export function PayBillForm({
  billId,
  defaultAmount,
  defaultPaidAt,
  dueDate,
}: {
  billId: string;
  defaultAmount: string;
  defaultPaidAt: string;
  dueDate: string;
}) {
  const [state, action, pending] = useActionState(payBill, undefined);
  const errors = state?.fieldErrors;

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="billId" value={billId} />
      {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="paidAt">Data da baixa</Label>
          <Input id="paidAt" name="paidAt" type="date" required defaultValue={defaultPaidAt} />
          <FieldError messages={errors?.paidAt} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="paidAmount">Valor pago (R$)</Label>
          <Input id="paidAmount" name="paidAmount" required inputMode="decimal" defaultValue={defaultAmount} />
          <FieldError messages={errors?.paidAmount} />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="paymentNote">Observação</Label>
        <Textarea id="paymentNote" name="paymentNote" rows={2} />
      </div>
      <div className="grid gap-2">
        <Label>Comprovante (obrigatório)</Label>
        <FileUpload name="proofTokens" category="BILL_PAYMENT_PROOF" multiple={false} referenceDate={dueDate} />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Baixando…" : "Dar baixa"}
      </Button>
    </form>
  );
}
