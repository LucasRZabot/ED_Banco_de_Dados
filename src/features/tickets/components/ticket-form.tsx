"use client";

import { useActionState } from "react";
import { FieldError } from "@/components/shared/field-error";
import { FileUpload } from "@/components/shared/file-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { createTicket } from "../actions";
import { TICKET_TYPE_LABELS, URGENCY_LABELS } from "../labels";
import { TICKET_TYPES, URGENCIES } from "../status-machine";

export function TicketForm({ sectorName }: { sectorName: string }) {
  const [state, action, pending] = useActionState(createTicket, undefined);
  const errors = state?.fieldErrors;

  return (
    <form action={action} className="grid max-w-2xl gap-4">
      {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <div className="grid gap-2">
        <Label htmlFor="type">Tipo</Label>
        <NativeSelect id="type" name="type" className="w-full" required defaultValue="PURCHASE_QUOTE">
          {TICKET_TYPES.map((t) => (
            <NativeSelectOption key={t} value={t}>
              {TICKET_TYPE_LABELS[t]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <FieldError messages={errors?.type} />
      </div>
      <div className="grid gap-2">
        <Label>Setor</Label>
        <Input value={sectorName} disabled readOnly />
        <p className="text-xs text-muted-foreground">O chamado fica no seu setor. Não é possível alterar.</p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="title">Título</Label>
        <Input id="title" name="title" required maxLength={160} />
        <FieldError messages={errors?.title} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="description">Descrição</Label>
        <Textarea id="description" name="description" required minLength={10} rows={4} />
        <FieldError messages={errors?.description} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="justification">Justificativa</Label>
        <Textarea id="justification" name="justification" required minLength={10} rows={3} />
        <FieldError messages={errors?.justification} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor="quantity">Quantidade</Label>
          <Input id="quantity" name="quantity" type="number" min={1} />
          <FieldError messages={errors?.quantity} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="urgency">Urgência</Label>
          <NativeSelect id="urgency" name="urgency" className="w-full" defaultValue="MEDIUM">
            {URGENCIES.map((u) => (
              <NativeSelectOption key={u} value={u}>
                {URGENCY_LABELS[u]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="neededBy">Necessário até</Label>
          <Input id="neededBy" name="neededBy" type="date" />
          <FieldError messages={errors?.neededBy} />
        </div>
      </div>
      <div className="grid gap-2">
        <Label>Anexos</Label>
        <FileUpload category="TICKET" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Abrindo…" : "Abrir chamado"}
      </Button>
    </form>
  );
}
