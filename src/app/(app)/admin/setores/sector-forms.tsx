"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { toast } from "sonner";
import { FieldError } from "@/components/shared/field-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSector, setSectorActive } from "./actions";

export function CreateSectorForm() {
  const [state, action, pending] = useActionState(createSector, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) {
      toast.success("Setor criado.");
      formRef.current?.reset();
    }
    if (state?.error) toast.error(state.error);
  }, [state]);

  return (
    <form ref={formRef} action={action} className="flex flex-wrap items-start gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="name">Nome do setor</Label>
        <Input id="name" name="name" placeholder="Ex.: UTI Adulto" className="w-64" required />
        <FieldError messages={state?.fieldErrors?.name} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="costCenter">Centro de custo</Label>
        <Input id="costCenter" name="costCenter" placeholder="Ex.: 3.01.002" className="w-40" required />
        <FieldError messages={state?.fieldErrors?.costCenter} />
      </div>
      <Button type="submit" disabled={pending} className="mt-6">
        {pending ? "Salvando…" : "Adicionar setor"}
      </Button>
    </form>
  );
}

export function ToggleSectorButton({ id, active }: { id: string; active: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant={active ? "ghost" : "outline"}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await setSectorActive(id, !active);
          if (res?.error) toast.error(res.error);
          else toast.success(active ? "Setor desativado." : "Setor reativado.");
        })
      }
    >
      {active ? "Desativar" : "Reativar"}
    </Button>
  );
}
