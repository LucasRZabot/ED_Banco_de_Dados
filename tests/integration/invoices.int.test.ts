import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { attachUploadedFile } from "@/lib/attachments";
import { getFileBlob } from "@/lib/blobs";
import type { CurrentUser } from "@/lib/dal";
import { db } from "@/lib/db";
import { getInvoiceOrNotFound, listInvoices } from "@/features/invoices/queries";
import { cnpjFromBase } from "@/lib/validators/cnpj";
import { parseNfeXml } from "@/lib/nfe-xml";
import { uploadBlob } from "./put-blob";

const run = randomUUID().slice(0, 8);
const pdf = Buffer.from(`%PDF-1.4\n% nota ${run}\n%%EOF\n`);

let sectorA: string;
let sectorB: string;
let admin: CurrentUser;
let financeiro: CurrentUser;
let chefiaA: CurrentUser;
let chefiaB: CurrentUser;
let invoiceA: string;
let invoiceB: string;
let supplierId: string;

async function makeUser(role: "ADMIN" | "FINANCEIRO" | "REQUESTER", sectorId: string): Promise<CurrentUser> {
  const u = await db.user.create({
    data: {
      email: `${role.toLowerCase()}-nf-${randomUUID()}@teste.local`,
      name: role,
      role,
      sectorId,
      mustChangePassword: false,
    },
  });
  return { ...u, sector: null };
}

async function uploadInvoicePdf(userId: string) {
  return uploadBlob({ userId, category: "INVOICE_PDF", data: pdf, fileName: "nota.pdf" });
}

beforeAll(async () => {
  sectorA = (await db.sector.create({ data: { name: `UTI NF ${run}`, costCenter: `NF-A-${run}` } })).id;
  sectorB = (await db.sector.create({ data: { name: `CC NF ${run}`, costCenter: `NF-B-${run}` } })).id;
  admin = await makeUser("ADMIN", sectorA);
  financeiro = await makeUser("FINANCEIRO", sectorA);
  chefiaA = await makeUser("REQUESTER", sectorA);
  chefiaB = await makeUser("REQUESTER", sectorA);
  supplierId = (
    await db.supplier.create({
      data: { legalName: `Fornecedor NF ${run}`, cnpj: cnpjFromBase(`55${Date.now().toString().slice(-10)}`) },
    })
  ).id;
  invoiceA = (
    await db.invoice.create({
      data: { description: `Curativos UTI ${run}`, sectorId: sectorA, submittedById: chefiaA.id },
    })
  ).id;
  invoiceB = (
    await db.invoice.create({
      data: { description: `Luva CC ${run}`, sectorId: sectorA, submittedById: chefiaB.id },
    })
  ).id;
});

afterAll(async () => {
  const ids = [admin?.id, financeiro?.id, chefiaA?.id, chefiaB?.id].filter(Boolean);
  await db.attachment.deleteMany({ where: { uploadedById: { in: ids } } });
  await db.invoice.deleteMany({ where: { id: { in: [invoiceA, invoiceB].filter(Boolean) } } });
  if (supplierId) await db.supplier.deleteMany({ where: { id: supplierId } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
  await db.sector.deleteMany({ where: { id: { in: [sectorA, sectorB] } } });
  await db.$disconnect();
});

describe("visibilidade de notas fiscais", () => {
  it("chefia vê só as que ela enviou; financeiro vê todas; admin nenhuma", async () => {
    const own = await listInvoices(chefiaA, {});
    const peer = await listInvoices(chefiaB, {});
    const finance = await listInvoices(financeiro, {});
    const ti = await listInvoices(admin, {});
    expect(own.some((i) => i.id === invoiceA)).toBe(true);
    expect(own.some((i) => i.id === invoiceB)).toBe(false);
    expect(peer.some((i) => i.id === invoiceB)).toBe(true);
    expect(peer.some((i) => i.id === invoiceA)).toBe(false);
    expect(finance.some((i) => i.id === invoiceA)).toBe(true);
    expect(finance.some((i) => i.id === invoiceB)).toBe(true);
    expect(ti).toEqual([]);
    await expect(getInvoiceOrNotFound(chefiaB, invoiceA)).rejects.toThrow();
    await expect(getInvoiceOrNotFound(admin, invoiceA)).rejects.toThrow();
  });

  it("anexa PDF na nota, financeiro abre, chefia colega não vê o arquivo", async () => {
    const { key, token } = await uploadInvoicePdf(chefiaA.id);
    const att = await attachUploadedFile(token, chefiaA, { invoiceId: invoiceA }, ["INVOICE_PDF"]);
    expect(att.fileKey).toBe(key);
    expect(key).toMatch(/^notas-fiscais\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.pdf$/);

    const blob = await getFileBlob(att.fileKey);
    expect(blob).toBeTruthy();
    expect(Buffer.from(blob!.data).equals(pdf)).toBe(true);
  });

  it("lançamento POSTED exige dados fiscais; com eles grava postedBy", async () => {
    await expect(
      db.invoice.update({ where: { id: invoiceA }, data: { status: "POSTED" } }),
    ).rejects.toThrow();

    const posted = await db.invoice.update({
      where: { id: invoiceA },
      data: {
        status: "POSTED",
        number: `9${run}`,
        series: "1",
        supplierId,
        issueDate: new Date("2026-11-10T00:00:00.000Z"),
        amount: "150.40",
        postedById: financeiro.id,
        postedAt: new Date(),
      },
    });
    expect(posted.status).toBe("POSTED");
    expect(posted.postedById).toBe(financeiro.id);
  });
});

describe("XML NF-e", () => {
  it("o parser usado no lançamento lê o XML da nota", () => {
    const cnpj = cnpjFromBase("112223330001");
    const parsed = parseNfeXml(
      `<NFe><infNFe Id="NFe352401${cnpj}550010000001231234567890"><ide><serie>1</serie><nNF>12</nNF><dEmi>2026-01-02</dEmi></ide><emit><CNPJ>${cnpj}</CNPJ><xNome>X</xNome></emit><vNF>10.00</vNF></infNFe></NFe>`,
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data.number).toBe("12");
    expect(parsed.data.supplierCnpj).toBe(cnpj);
  });
});
