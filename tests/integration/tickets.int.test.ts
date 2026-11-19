import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { financeUserIds, notifyUsers } from "@/features/notifications/create";
import { getTicketOrNotFound, listTickets } from "@/features/tickets/queries";
import type { CurrentUser } from "@/lib/dal";
import { db } from "@/lib/db";

const run = randomUUID().slice(0, 8);

let sectorId: string;
let financeiro: CurrentUser;
let chefiaA: CurrentUser;
let chefiaB: CurrentUser;
let ticketId: string;

async function makeUser(role: CurrentUser["role"], sectorId: string): Promise<CurrentUser> {
  const u = await db.user.create({
    data: {
      email: `${role.toLowerCase()}-${randomUUID()}@teste.local`,
      name: role,
      role,
      sectorId,
      mustChangePassword: false,
    },
  });
  return { ...u, sector: null };
}

beforeAll(async () => {
  sectorId = (await db.sector.create({ data: { name: `UTI ${run}`, costCenter: `CC-${run}` } })).id;
  financeiro = await makeUser("FINANCEIRO", sectorId);
  chefiaA = await makeUser("REQUESTER", sectorId);
  chefiaB = await makeUser("REQUESTER", sectorId);
  const ticket = await db.ticket.create({
    data: {
      type: "PURCHASE_QUOTE",
      title: "Caixa de luva estéril",
      description: "Reposição do estoque da UTI",
      justification: "Estoque abaixo do mínimo",
      sectorId,
      requesterId: chefiaA.id,
    },
  });
  ticketId = ticket.id;
  await db.ticketComment.create({
    data: { ticketId, authorId: financeiro.id, visibility: "INTERNAL", body: "Verba do centro de custo X." },
  });
  await db.ticketComment.create({
    data: { ticketId, authorId: financeiro.id, visibility: "PUBLIC", body: "Recebemos o pedido." },
  });
});

afterAll(async () => {
  const ids = [financeiro.id, chefiaA.id, chefiaB.id];
  await db.notification.deleteMany({ where: { userId: { in: ids } } });
  await db.ticketComment.deleteMany({ where: { ticketId } });
  await db.ticket.deleteMany({ where: { id: ticketId } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
  await db.sector.deleteMany({ where: { id: sectorId } });
  await db.$disconnect();
});

describe("visibilidade dos chamados", () => {
  it("chefia só lista o que ela abriu; financeiro lista todos", async () => {
    const mine = await listTickets(chefiaA, {});
    const other = await listTickets(chefiaB, {});
    const finance = await listTickets(financeiro, {});
    expect(mine.some((t) => t.id === ticketId)).toBe(true);
    expect(other.some((t) => t.id === ticketId)).toBe(false);
    expect(finance.some((t) => t.id === ticketId)).toBe(true);
  });

  it("chefia não vê comentário interno e colega do setor recebe 404", async () => {
    const asOwner = await getTicketOrNotFound(chefiaA, ticketId);
    expect(asOwner.comments.map((c) => c.visibility)).toEqual(["PUBLIC"]);

    const asFinance = await getTicketOrNotFound(financeiro, ticketId);
    expect(asFinance.comments).toHaveLength(2);

    await expect(getTicketOrNotFound(chefiaB, ticketId)).rejects.toThrow();
  });

  it("notifica o financeiro na abertura, sem duplicar", async () => {
    const ids = await financeUserIds();
    expect(ids).toContain(financeiro.id);
    await notifyUsers({
      userIds: [financeiro.id],
      type: "TICKET_CREATED",
      title: "Novo chamado",
      message: "teste",
      link: `/chamados/${ticketId}`,
      ticketId,
      dedupeKey: () => `ticket:${ticketId}:CREATED:test`,
    });
    await notifyUsers({
      userIds: [financeiro.id],
      type: "TICKET_CREATED",
      title: "Novo chamado",
      message: "teste",
      link: `/chamados/${ticketId}`,
      ticketId,
      dedupeKey: () => `ticket:${ticketId}:CREATED:test`,
    });
    const count = await db.notification.count({
      where: { userId: financeiro.id, dedupeKey: `ticket:${ticketId}:CREATED:test` },
    });
    expect(count).toBe(1);
  });
});
