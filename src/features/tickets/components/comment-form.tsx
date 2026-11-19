"use client";

import { useActionState } from "react";
import { FieldError } from "@/components/shared/field-error";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { AppRole } from "@/lib/roles";
import { addTicketComment } from "../actions";
import { COMMENT_VISIBILITY_LABELS } from "../labels";

export function CommentForm({ ticketId, role }: { ticketId: string; role: AppRole }) {
  const [state, action, pending] = useActionState(addTicketComment, undefined);

  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="ticketId" value={ticketId} />
      <div className="grid gap-2">
        <Label htmlFor="body">{role === "FINANCEIRO" ? "Comentário" : "Mensagem ao financeiro"}</Label>
        <Textarea id="body" name="body" required minLength={2} rows={3} />
        <FieldError messages={state?.fieldErrors?.body} />
      </div>
      {role === "FINANCEIRO" ? (
        <div className="grid gap-2">
          <Label htmlFor="visibility">Visibilidade</Label>
          <NativeSelect id="visibility" name="visibility" defaultValue="PUBLIC" className="w-56">
            <NativeSelectOption value="PUBLIC">{COMMENT_VISIBILITY_LABELS.PUBLIC}</NativeSelectOption>
            <NativeSelectOption value="INTERNAL">{COMMENT_VISIBILITY_LABELS.INTERNAL}</NativeSelectOption>
          </NativeSelect>
        </div>
      ) : (
        <input type="hidden" name="visibility" value="PUBLIC" />
      )}
      {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <Button type="submit" variant="outline" disabled={pending} className="w-fit">
        {pending ? "Enviando…" : "Enviar"}
      </Button>
    </form>
  );
}
