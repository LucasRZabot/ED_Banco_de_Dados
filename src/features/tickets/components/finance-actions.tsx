"use client";

import { useActionState, useState } from "react";
import { FieldError } from "@/components/shared/field-error";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { changeTicketStatus } from "../actions";
import { TRANSITIONS, type TicketStatus } from "../status-machine";

export function FinanceActions({ ticketId, status }: { ticketId: string; status: TicketStatus }) {
  const next = TRANSITIONS[status];
  const [cancelOpen, setCancelOpen] = useState(false);
  const [state, action, pending] = useActionState(changeTicketStatus, undefined);

  if (!next.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {state?.error ? <p className="w-full text-sm text-destructive">{state.error}</p> : null}
      {next.includes("IN_PROGRESS") ? (
        <form action={action}>
          <input type="hidden" name="ticketId" value={ticketId} />
          <input type="hidden" name="toStatus" value="IN_PROGRESS" />
          <Button type="submit" disabled={pending}>
            {pending ? "Salvando…" : "Marcar como viável"}
          </Button>
        </form>
      ) : null}
      {next.includes("COMPLETED") ? (
        <form action={action}>
          <input type="hidden" name="ticketId" value={ticketId} />
          <input type="hidden" name="toStatus" value="COMPLETED" />
          <Button type="submit" disabled={pending}>
            {pending ? "Salvando…" : "Concluir"}
          </Button>
        </form>
      ) : null}
      {next.includes("CANCELED") ? (
        <Button variant="destructive" onClick={() => setCancelOpen(true)} disabled={pending}>
          Cancelar chamado
        </Button>
      ) : null}

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancelar chamado</DialogTitle>
            <DialogDescription>
              A chefia verá este motivo. Só cancele se o pedido for inviável.
            </DialogDescription>
          </DialogHeader>
          <form action={action} className="grid gap-4">
            <input type="hidden" name="ticketId" value={ticketId} />
            <input type="hidden" name="toStatus" value="CANCELED" />
            <div className="grid gap-2">
              <Label htmlFor="reason">Motivo</Label>
              <Textarea id="reason" name="reason" required minLength={5} rows={4} />
              <FieldError messages={state?.fieldErrors?.reason} />
            </div>
            {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCancelOpen(false)}>
                Voltar
              </Button>
              <Button type="submit" variant="destructive" disabled={pending}>
                {pending ? "Cancelando…" : "Confirmar cancelamento"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
