import { describe, expect, it } from "vitest";
import {
  applyTransition,
  canTransition,
  TicketFlowError,
  TRANSITIONS,
} from "@/features/tickets/status-machine";

describe("fluxo do chamado", () => {
  it("só permite Aberto → Em Processamento/Cancelado e Em Processamento → Concluído/Cancelado", () => {
    expect(TRANSITIONS.OPEN).toEqual(["IN_PROGRESS", "CANCELED"]);
    expect(TRANSITIONS.IN_PROGRESS).toEqual(["COMPLETED", "CANCELED"]);
    expect(canTransition("OPEN", "COMPLETED")).toBe(false);
    expect(canTransition("CANCELED", "OPEN")).toBe(false);
    expect(canTransition("COMPLETED", "IN_PROGRESS")).toBe(false);
  });

  it("grava datas e responsável ao marcar como viável", () => {
    const now = new Date("2026-11-19T15:00:00Z");
    expect(applyTransition("OPEN", "IN_PROGRESS", { now, assigneeId: "fin-1" })).toEqual({
      status: "IN_PROGRESS",
      processingStartedAt: now,
      assigneeId: "fin-1",
    });
  });

  it("exige motivo no cancelamento e preenche closedAt", () => {
    expect(() => applyTransition("OPEN", "CANCELED", { reason: "  " })).toThrow(TicketFlowError);
    const now = new Date();
    const patch = applyTransition("IN_PROGRESS", "CANCELED", { now, reason: " Sem verba " });
    expect(patch).toMatchObject({ status: "CANCELED", cancellationReason: "Sem verba", closedAt: now });
  });

  it("conclui a partir de Em Processamento", () => {
    const now = new Date();
    expect(applyTransition("IN_PROGRESS", "COMPLETED", { now })).toEqual({ status: "COMPLETED", closedAt: now });
    expect(() => applyTransition("OPEN", "COMPLETED")).toThrow(/Não é possível/);
  });
});
