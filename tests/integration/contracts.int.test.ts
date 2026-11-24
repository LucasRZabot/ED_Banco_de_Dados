import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getContractOrNotFound, listContracts } from "@/features/contracts/queries";
import { completeLinkedTicket } from "@/features/tickets/complete";
import { attachUploadedFile } from "@/lib/attachments";
import { getFileBlob } from "@/lib/blobs";
import type { CurrentUser } from "@/lib/dal";
import { addDays, todayInTz } from "@/lib/dates";
import { db } from "@/lib/db";
import { cnpjFromBase } from "@/lib/validators/cnpj";
import { uploadBlob } from "./put-blob";

const run = randomUUID().slice(0, 8);
const pdf = Buffer.from(`%PDF-1.4\n% contrato ${run}\n%%EOF\n`);
const today = todayInTz();

let sectorId: string;
let admin: CurrentUser;
let financeiro: CurrentUser;
let chefia: CurrentUser;
let supplierId: string;
let ticketId: string;
let contractId: string;

async function makeUser(role: "ADMIN" | "FINANCEIRO" | "REQUESTER", sectorId: string): Promise<CurrentUser> {
  const u = await db.user.create({
    data: {
      email: `${role.toLowerCase()}-ct-${randomUUID()}@teste.local`,
      name: role,
      role,
      sectorId,
      mustChangePassword: false,
    },
  });
  return { ...u, sector: null };
}

async function uploadContractPdf(userId: string) {
  return uploadBlob({ userId, category: "CONTRACT", data: pdf, fileName: "contrato-assinado.pdf" });
}

beforeAll(async () => {
  sectorId = (await db.sector.create({ data: { name: `UTI CT ${run}`, costCenter: `CT-${run}` } })).id;
  admin = await makeUser("ADMIN", sectorId);
  financeiro = await makeUser("FINANCEIRO", sectorId);
  chefia = await makeUser("REQUESTER", sectorId);
  supplierId = (
    await db.supplier.create({
      data: { legalName: `Fornecedor CT ${run}`, cnpj: cnpjFromBase(`71${Date.now().toString().slice(-10)}`) },
    })
  ).id;
  ticketId = (
    await db.ticket.create({
      data: {
        type: "CONTRACT_INCLUSION",
        title: `Manutenção de bombas ${run}`,
        description: "Inclusão do contrato anual de manutenção preventiva.",
        justification: "Equipamento crítico da UTI sem cobertura.",
        sectorId,
        requesterId: chefia.id,
      },
    })
  ).id;
  contractId = (
    await db.contract.create({
      data: {
        object: `Manutenção preventiva ${run}`,
        supplierId,
        sectorId,
        monthlyValue: "1200.00",
        startDate: addDays(today, -10),
        endDate: addDays(today, 20),
        alertDaysBefore: 30,
        createdById: financeiro.id,
      },
    })
  ).id;
});

afterAll(async () => {
  const ids = [admin?.id, financeiro?.id, chefia?.id].filter(Boolean);
  await db.notification.deleteMany({ where: { userId: { in: ids } } });
  await db.attachment.deleteMany({ where: { uploadedById: { in: ids } } });
  if (contractId) await db.contract.deleteMany({ where: { id: contractId } });
  if (ticketId) await db.ticket.deleteMany({ where: { id: ticketId } });
  if (supplierId) await db.supplier.deleteMany({ where: { id: supplierId } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
  await db.sector.deleteMany({ where: { id: sectorId } });
  await db.$disconnect();
});

describe("visibilidade de contratos", () => {
  it("só o financeiro lista; chefia e admin não veem", async () => {
    const finance = await listContracts(financeiro, {});
    const requester = await listContracts(chefia, {});
    const ti = await listContracts(admin, {});
    expect(finance.some((c) => c.id === contractId)).toBe(true);
    expect(requester).toEqual([]);
    expect(ti).toEqual([]);
    await expect(getContractOrNotFound(chefia, contractId)).rejects.toThrow();
    await expect(getContractOrNotFound(admin, contractId)).rejects.toThrow();
  });
});

describe("anexo PDF no prefixo contratos/", () => {
  it("grava a key e o blob privado no Postgres", async () => {
    const { key, token } = await uploadContractPdf(financeiro.id);
    const att = await attachUploadedFile(token, financeiro, { contractId }, ["CONTRACT"]);
    expect(att.fileKey).toBe(key);
    expect(key).toMatch(/^contratos\/[0-9a-f-]{36}\.pdf$/);

    const blob = await getFileBlob(att.fileKey);
    expect(blob).toBeTruthy();
    expect(Buffer.from(blob!.data).equals(pdf)).toBe(true);
  });
});

describe("conversão do chamado de inclusão", () => {
  it("conclui OPEN via IN_PROGRESS ao gerar o contrato", async () => {
    await db.contract.update({ where: { id: contractId }, data: { ticketId } });
    await db.$transaction((tx) => completeLinkedTicket(tx, ticketId, financeiro.id, ["CONTRACT_INCLUSION"]));
    const ticket = await db.ticket.findUnique({
      where: { id: ticketId },
      include: { statusHistory: { orderBy: { createdAt: "asc" } } },
    });
    expect(ticket?.status).toBe("COMPLETED");
    expect(ticket?.statusHistory.map((h) => h.toStatus)).toEqual(["IN_PROGRESS", "COMPLETED"]);
  });
});
