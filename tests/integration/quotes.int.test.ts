import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getQuoteOrNotFound, listQuotes } from "@/features/quotes/queries";
import { completeLinkedTicket } from "@/features/tickets/complete";
import { attachUploadedFile } from "@/lib/attachments";
import { getFileBlob } from "@/lib/blobs";
import type { CurrentUser } from "@/lib/dal";
import { db } from "@/lib/db";
import { cnpjFromBase } from "@/lib/validators/cnpj";
import { uploadBlob } from "./put-blob";

const run = randomUUID().slice(0, 8);
const pdf = Buffer.from(`%PDF-1.4\n% orcamento ${run}\n%%EOF\n`);

let sectorId: string;
let admin: CurrentUser;
let financeiro: CurrentUser;
let chefia: CurrentUser;
let supplierA: string;
let supplierB: string;
let ticketId: string;
let quoteCheap: string;
let quoteExpensive: string;
let quoteSolo: string;

async function makeUser(role: "ADMIN" | "FINANCEIRO" | "REQUESTER", sectorId: string): Promise<CurrentUser> {
  const u = await db.user.create({
    data: {
      email: `${role.toLowerCase()}-orc-${randomUUID()}@teste.local`,
      name: role,
      role,
      sectorId,
      mustChangePassword: false,
    },
  });
  return { ...u, sector: null };
}

async function uploadQuotePdf(userId: string) {
  return uploadBlob({ userId, category: "QUOTE", data: pdf, fileName: "proposta.pdf" });
}

beforeAll(async () => {
  sectorId = (await db.sector.create({ data: { name: `UTI ORC ${run}`, costCenter: `ORC-${run}` } })).id;
  admin = await makeUser("ADMIN", sectorId);
  financeiro = await makeUser("FINANCEIRO", sectorId);
  chefia = await makeUser("REQUESTER", sectorId);
  supplierA = (
    await db.supplier.create({
      data: { legalName: `Fornecedor A ${run}`, cnpj: cnpjFromBase(`61${Date.now().toString().slice(-10)}`) },
    })
  ).id;
  supplierB = (
    await db.supplier.create({
      data: { legalName: `Fornecedor B ${run}`, cnpj: cnpjFromBase(`62${Date.now().toString().slice(-10)}`) },
    })
  ).id;
  ticketId = (
    await db.ticket.create({
      data: {
        type: "PURCHASE_QUOTE",
        title: `Luva estéril ${run}`,
        description: "Reposição do estoque da UTI para o comparativo.",
        justification: "Estoque abaixo do mínimo combinado.",
        sectorId,
        requesterId: chefia.id,
      },
    })
  ).id;
  quoteCheap = (
    await db.quote.create({
      data: {
        supplierId: supplierA,
        ticketId,
        amount: "100.50",
        validUntil: new Date("2026-12-20T00:00:00.000Z"),
        description: `Proposta barata ${run}`,
        createdById: financeiro.id,
      },
    })
  ).id;
  quoteExpensive = (
    await db.quote.create({
      data: {
        supplierId: supplierB,
        ticketId,
        amount: "180.00",
        validUntil: new Date("2026-12-22T00:00:00.000Z"),
        description: `Proposta cara ${run}`,
        createdById: financeiro.id,
      },
    })
  ).id;
  quoteSolo = (
    await db.quote.create({
      data: {
        supplierId: supplierA,
        amount: "50.00",
        validUntil: new Date("2026-12-15T00:00:00.000Z"),
        description: `Avulso ${run}`,
        createdById: financeiro.id,
      },
    })
  ).id;
});

afterAll(async () => {
  const ids = [admin?.id, financeiro?.id, chefia?.id].filter(Boolean);
  await db.notification.deleteMany({ where: { userId: { in: ids } } });
  await db.attachment.deleteMany({ where: { uploadedById: { in: ids } } });
  await db.invoice.deleteMany({ where: { quoteId: { in: [quoteCheap, quoteExpensive, quoteSolo].filter(Boolean) } } });
  await db.quote.deleteMany({ where: { id: { in: [quoteCheap, quoteExpensive, quoteSolo].filter(Boolean) } } });
  if (ticketId) await db.ticket.deleteMany({ where: { id: ticketId } });
  await db.supplier.deleteMany({ where: { id: { in: [supplierA, supplierB].filter(Boolean) } } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
  await db.sector.deleteMany({ where: { id: sectorId } });
  await db.$disconnect();
});

describe("visibilidade de orçamentos", () => {
  it("só o financeiro lista; chefia e admin não veem nem o da solicitação dela", async () => {
    const finance = await listQuotes(financeiro, {});
    const requester = await listQuotes(chefia, {});
    const ti = await listQuotes(admin, {});
    expect(finance.some((q) => q.id === quoteCheap)).toBe(true);
    expect(finance.some((q) => q.id === quoteSolo)).toBe(true);
    expect(requester).toEqual([]);
    expect(ti).toEqual([]);
    await expect(getQuoteOrNotFound(chefia, quoteCheap)).rejects.toThrow();
    await expect(getQuoteOrNotFound(admin, quoteCheap)).rejects.toThrow();
  });
});

describe("anexo PDF no prefixo orcamentos/", () => {
  it("grava a key e o blob privado no Postgres", async () => {
    const { key, token } = await uploadQuotePdf(financeiro.id);
    const att = await attachUploadedFile(token, financeiro, { quoteId: quoteCheap }, ["QUOTE"]);
    expect(att.fileKey).toBe(key);
    expect(key).toMatch(/^orcamentos\/[0-9a-f-]{36}\.pdf$/);

    const blob = await getFileBlob(att.fileKey);
    expect(blob).toBeTruthy();
    expect(Buffer.from(blob!.data).equals(pdf)).toBe(true);
  });
});

describe("aprovação, conversão e conclusão do chamado", () => {
  it("aprovar um reprova os demais pendentes do mesmo chamado", async () => {
    const now = new Date();
    await db.quote.update({
      where: { id: quoteCheap },
      data: { status: "APPROVED", decidedById: financeiro.id, decidedAt: now, decisionNote: "Melhor preço." },
    });
    await db.quote.updateMany({
      where: { ticketId, id: { not: quoteCheap }, status: "PENDING" },
      data: {
        status: "REJECTED",
        decisionNote: "Reprovado automaticamente: outro orçamento do chamado foi aprovado.",
        decidedById: financeiro.id,
        decidedAt: now,
      },
    });
    const cheap = await db.quote.findUnique({ where: { id: quoteCheap } });
    const expensive = await db.quote.findUnique({ where: { id: quoteExpensive } });
    expect(cheap?.status).toBe("APPROVED");
    expect(expensive?.status).toBe("REJECTED");
    expect(expensive?.decisionNote).toMatch(/automaticamente/);
  });

  it("converte o aprovado em NF pendente e, ao lançar, conclui o chamado OPEN", async () => {
    const invoice = await db.invoice.create({
      data: {
        description: `Lançamento do orçamento Fornecedor A ${run} (R$ 100,50)`,
        sectorId,
        submittedById: financeiro.id,
        quoteId: quoteCheap,
        ticketId,
        supplierId: supplierA,
        amount: "100.50",
      },
    });
    expect(invoice.status).toBe("PENDING");
    expect(invoice.quoteId).toBe(quoteCheap);
    expect(invoice.ticketId).toBe(ticketId);

    await db.invoice.update({
      where: { id: invoice.id },
      data: {
        status: "POSTED",
        number: `8${run}`,
        series: "1",
        issueDate: new Date("2026-11-19T00:00:00.000Z"),
        postedById: financeiro.id,
        postedAt: new Date(),
      },
    });

    await db.$transaction((tx) => completeLinkedTicket(tx, ticketId, financeiro.id));
    const ticket = await db.ticket.findUnique({
      where: { id: ticketId },
      include: { statusHistory: { orderBy: { createdAt: "asc" } } },
    });
    expect(ticket?.status).toBe("COMPLETED");
    expect(ticket?.processingStartedAt).toBeTruthy();
    expect(ticket?.closedAt).toBeTruthy();
    expect(ticket?.statusHistory.map((h) => h.toStatus)).toEqual(["IN_PROGRESS", "COMPLETED"]);
  });
});
