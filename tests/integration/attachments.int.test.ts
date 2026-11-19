import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AttachmentError, attachUploadedFile, canViewAttachment } from "@/lib/attachments";
import type { CurrentUser } from "@/lib/dal";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { presignDownload, presignUpload } from "@/lib/s3";
import { buildFileKey } from "@/lib/storage-keys";
import { createUploadToken } from "@/lib/upload-token";

// Requer Postgres + S3 locais (docker compose up) e `npm run s3:setup`.
const run = randomUUID().slice(0, 8);
const pdf = Buffer.from(`%PDF-1.4\n% teste ${run}\n%%EOF\n`);

let sectorA: string;
let sectorB: string;
let admin: CurrentUser;
let chefiaA: CurrentUser;
let chefiaB: CurrentUser;
let ticketId: string;

async function makeUser(role: "ADMIN" | "REQUESTER", sectorId: string): Promise<CurrentUser> {
  const u = await db.user.create({
    data: { email: `${role.toLowerCase()}-${randomUUID()}@teste.local`, role, sectorId, mustChangePassword: false },
  });
  return { ...u, sector: null };
}

async function uploadTicketPdf(userId: string, size = pdf.length) {
  const key = buildFileKey({ category: "TICKET", mimeType: "application/pdf", timeZone: env().APP_TIMEZONE });
  const url = await presignUpload(key, "application/pdf");
  const put = await fetch(url, { method: "PUT", headers: { "Content-Type": "application/pdf" }, body: pdf });
  expect(put.ok).toBe(true);
  const token = createUploadToken(
    {
      key,
      userId,
      category: "TICKET",
      fileName: "orçamento fornecedor.pdf",
      fileType: "application/pdf",
      fileSize: size,
      exp: Math.floor(Date.now() / 1000) + 600,
    },
    env().AUTH_SECRET,
  );
  return { key, token };
}

beforeAll(async () => {
  sectorA = (await db.sector.create({ data: { name: `Setor A ${run}`, costCenter: `TA-${run}` } })).id;
  sectorB = (await db.sector.create({ data: { name: `Setor B ${run}`, costCenter: `TB-${run}` } })).id;
  admin = await makeUser("ADMIN", sectorA);
  chefiaA = await makeUser("REQUESTER", sectorA);
  chefiaB = await makeUser("REQUESTER", sectorB);
  ticketId = (
    await db.ticket.create({
      data: {
        type: "PURCHASE_QUOTE",
        title: "Teste de anexo",
        description: "Teste",
        justification: "Teste",
        sectorId: sectorA,
        requesterId: chefiaA.id,
      },
    })
  ).id;
});

afterAll(async () => {
  await db.attachment.deleteMany({ where: { ticketId } });
  await db.ticket.deleteMany({ where: { id: ticketId } });
  await db.user.deleteMany({ where: { id: { in: [admin.id, chefiaA.id, chefiaB.id] } } });
  await db.sector.deleteMany({ where: { id: { in: [sectorA, sectorB] } } });
  await db.$disconnect();
});

describe("anexos com S3 presigned", () => {
  it("grava o anexo, controla acesso por setor e baixa o arquivo", async () => {
    const { key, token } = await uploadTicketPdf(chefiaA.id);
    const att = await attachUploadedFile(token, chefiaA, { ticketId }, ["TICKET"]);

    expect(att).toMatchObject({ fileKey: key, fileType: "application/pdf", fileSize: pdf.length, ticketId });
    expect(key).toMatch(/^chamados\/[0-9a-f-]{36}\.pdf$/);

    expect((await canViewAttachment(admin, att.id)).allowed).toBe(true);
    expect((await canViewAttachment(chefiaA, att.id)).allowed).toBe(true);
    expect((await canViewAttachment(chefiaB, att.id)).allowed).toBe(false);

    const res = await fetch(await presignDownload(att.fileKey, att.fileName, att.fileType));
    expect(res.ok).toBe(true);
    expect(Buffer.from(await res.arrayBuffer()).equals(pdf)).toBe(true);
    expect(res.headers.get("content-disposition")).toContain("filename*=UTF-8''or%C3%A7amento");

    await expect(attachUploadedFile(token, chefiaA, { ticketId })).rejects.toThrow(); // fileKey único
  });

  it("recusa token de outro usuário, categoria inesperada e tamanho divergente", async () => {
    const other = await uploadTicketPdf(chefiaB.id);
    await expect(attachUploadedFile(other.token, chefiaA, { ticketId })).rejects.toBeInstanceOf(AttachmentError);

    const wrongCategory = await uploadTicketPdf(chefiaA.id);
    await expect(attachUploadedFile(wrongCategory.token, chefiaA, { ticketId }, ["CONTRACT"])).rejects.toBeInstanceOf(
      AttachmentError,
    );

    const lying = await uploadTicketPdf(chefiaA.id, pdf.length + 10);
    await expect(attachUploadedFile(lying.token, chefiaA, { ticketId })).rejects.toThrow(/Tamanho/);
  });

  it("recusa key que não foi enviada ao S3", async () => {
    const key = buildFileKey({ category: "TICKET", mimeType: "application/pdf", timeZone: env().APP_TIMEZONE });
    const token = createUploadToken(
      {
        key,
        userId: chefiaA.id,
        category: "TICKET",
        fileName: "x.pdf",
        fileType: "application/pdf",
        fileSize: 10,
        exp: Math.floor(Date.now() / 1000) + 600,
      },
      env().AUTH_SECRET,
    );
    await expect(attachUploadedFile(token, chefiaA, { ticketId })).rejects.toThrow(/não encontrado/);
  });

  it("banco recusa anexo sem dono (CHECK)", async () => {
    await expect(
      db.attachment.create({
        data: {
          fileKey: `chamados/${randomUUID()}.pdf`,
          fileName: "x.pdf",
          fileType: "application/pdf",
          fileSize: 1,
          category: "TICKET",
          uploadedById: admin.id,
        },
      }),
    ).rejects.toThrow();
  });

  it("banco recusa chefia sem setor (CHECK)", async () => {
    await expect(
      db.user.create({ data: { email: `sem-setor-${run}@teste.local`, role: "REQUESTER" } }),
    ).rejects.toThrow();
  });
});
