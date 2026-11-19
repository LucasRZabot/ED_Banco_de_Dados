"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { canViewInvoice } from "@/lib/access";
import { AttachmentError, attachUploadedFile } from "@/lib/attachments";
import { requireFinance, requireRole } from "@/lib/dal";
import { parseDateOnly } from "@/lib/dates";
import { db } from "@/lib/db";
import { parseNfeXml } from "@/lib/nfe-xml";
import { getObjectText } from "@/lib/s3";
import { verifyUploadToken } from "@/lib/upload-token";
import { env } from "@/lib/env";
import { postInvoiceSchema, submitInvoiceSchema } from "./schemas";

export type InvoiceFormState =
  | { error?: string; fieldErrors?: Record<string, string[] | undefined> }
  | undefined;

function tokensFrom(formData: FormData, name: string) {
  return formData.getAll(name).filter((v): v is string => typeof v === "string" && v.length > 0);
}

class InvoiceActionError extends Error {}

async function resolveSupplier(
  tx: Prisma.TransactionClient,
  data: {
    supplierId: string | null;
    supplierLegalName: string | null;
    supplierCnpj: string | null;
  },
) {
  if (data.supplierId) {
    const existing = await tx.supplier.findUnique({ where: { id: data.supplierId }, select: { id: true, active: true } });
    if (!existing?.active) throw new InvoiceActionError("Fornecedor inválido ou inativo.");
    return existing.id;
  }
  const cnpj = data.supplierCnpj!;
  const found = await tx.supplier.findUnique({ where: { cnpj }, select: { id: true } });
  if (found) {
    if (data.supplierLegalName) {
      await tx.supplier.update({ where: { id: found.id }, data: { legalName: data.supplierLegalName } });
    }
    return found.id;
  }
  const created = await tx.supplier.create({
    data: { legalName: data.supplierLegalName!, cnpj },
  });
  return created.id;
}

async function attachTokens(
  tokens: string[],
  user: { id: string },
  invoiceId: string,
  expected: ("INVOICE_PDF" | "INVOICE_XML")[],
  tx: Prisma.TransactionClient,
) {
  for (const token of tokens) {
    await attachUploadedFile(token, user, { invoiceId }, expected, tx);
  }
}

async function xmlHintFromTokens(tokens: string[]) {
  for (const token of tokens) {
    const claims = verifyUploadToken(token, env().AUTH_SECRET);
    if (!claims || claims.category !== "INVOICE_XML") continue;
    try {
      const parsed = parseNfeXml(await getObjectText(claims.key));
      if (parsed.ok) return parsed.data;
    } catch {
      /* arquivo ainda vai ser validado no HeadObject do attach */
    }
  }
  return null;
}

export async function submitInvoice(_prev: InvoiceFormState, formData: FormData): Promise<InvoiceFormState> {
  const user = await requireRole("FINANCEIRO", "REQUESTER");
  const parsed = submitInvoiceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const pdfTokens = tokensFrom(formData, "pdfTokens");
  const xmlTokens = tokensFrom(formData, "xmlTokens");
  if (!pdfTokens.length && !xmlTokens.length) {
    return { error: "Anexe o PDF e/ou o XML da nota." };
  }

  const sectorId = user.role === "REQUESTER" ? user.sectorId : parsed.data.sectorId;
  if (!sectorId) return { error: "Sua conta não está vinculada a um setor." };

  const sector = await db.sector.findUnique({ where: { id: sectorId }, select: { id: true, active: true } });
  if (!sector?.active) return { fieldErrors: { sectorId: ["Setor inválido ou inativo."] } };

  let invoiceId = "";
  try {
    invoiceId = await db.$transaction(async (tx) => {
      const invoice = await tx.invoice.create({
        data: {
          description: parsed.data.description,
          sectorId,
          submittedById: user.id,
        },
      });
      await attachTokens(pdfTokens, user, invoice.id, ["INVOICE_PDF"], tx);
      await attachTokens(xmlTokens, user, invoice.id, ["INVOICE_XML"], tx);
      return invoice.id;
    });
  } catch (err) {
    if (err instanceof AttachmentError) return { error: err.message };
    throw err;
  }

  revalidatePath("/notas-fiscais");
  redirect(`/notas-fiscais/${invoiceId}`);
}

export async function postInvoice(_prev: InvoiceFormState, formData: FormData): Promise<InvoiceFormState> {
  const user = await requireFinance();
  const parsed = postInvoiceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const invoice = await db.invoice.findUnique({
    where: { id: parsed.data.invoiceId },
    select: { id: true, status: true },
  });
  if (!invoice) return { error: "Nota não encontrada." };
  if (invoice.status === "CANCELED") return { error: "Esta nota foi cancelada." };
  if (invoice.status === "POSTED") return { error: "Esta nota já foi lançada." };

  const pdfTokens = tokensFrom(formData, "pdfTokens");
  const xmlTokens = tokensFrom(formData, "xmlTokens");
  const xmlHint = await xmlHintFromTokens(xmlTokens);

  const number = parsed.data.number;
  const series = parsed.data.series;
  const accessKey = parsed.data.accessKey ?? xmlHint?.accessKey ?? null;
  const supplierLegalName = parsed.data.supplierLegalName ?? xmlHint?.supplierLegalName ?? null;
  const supplierCnpj = parsed.data.supplierCnpj ?? xmlHint?.supplierCnpj ?? null;

  try {
    await db.$transaction(async (tx) => {
      const supplierId = await resolveSupplier(tx, {
        supplierId: parsed.data.supplierId,
        supplierLegalName,
        supplierCnpj,
      });
      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          number,
          series,
          accessKey,
          amount: parsed.data.amount.toFixed(2),
          issueDate: parseDateOnly(parsed.data.issueDate),
          supplierId,
          quoteId: parsed.data.quoteId,
          contractId: parsed.data.contractId,
          ticketId: parsed.data.ticketId,
          status: "POSTED",
          postedById: user.id,
          postedAt: new Date(),
        },
      });
      await attachTokens(pdfTokens, user, invoice.id, ["INVOICE_PDF"], tx);
      await attachTokens(xmlTokens, user, invoice.id, ["INVOICE_XML"], tx);
    });
  } catch (err) {
    if (err instanceof InvoiceActionError) return { error: err.message };
    if (err instanceof AttachmentError) return { error: err.message };
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const target = JSON.stringify(err.meta?.target ?? "");
      if (target.includes("accessKey")) return { fieldErrors: { accessKey: ["Já existe uma nota com esta chave de acesso."] } };
      if (target.includes("cnpj")) return { fieldErrors: { supplierCnpj: ["Já existe um fornecedor com este CNPJ."] } };
      return { fieldErrors: { number: ["Já existe uma nota com este número e série para o fornecedor."] } };
    }
    throw err;
  }

  revalidatePath("/notas-fiscais");
  revalidatePath(`/notas-fiscais/${invoice.id}`);
  revalidatePath("/dashboard");
  redirect(`/notas-fiscais/${invoice.id}`);
}

export async function attachInvoiceFiles(_prev: InvoiceFormState, formData: FormData): Promise<InvoiceFormState> {
  const user = await requireRole("FINANCEIRO", "REQUESTER");
  const invoiceId = String(formData.get("invoiceId") ?? "");
  const pdfTokens = tokensFrom(formData, "pdfTokens");
  const xmlTokens = tokensFrom(formData, "xmlTokens");
  if (!invoiceId) return { error: "Nota não encontrada." };
  if (!pdfTokens.length && !xmlTokens.length) return { error: "Anexe o PDF e/ou o XML." };

  const invoice = await db.invoice.findUnique({
    where: { id: invoiceId },
    select: { id: true, submittedById: true, status: true },
  });
  if (!invoice || !canViewInvoice(user, invoice.submittedById)) return { error: "Nota não encontrada." };
  if (user.role === "REQUESTER" && invoice.status !== "PENDING") {
    return { error: "Só é possível anexar enquanto a nota está pendente." };
  }

  try {
    await db.$transaction(async (tx) => {
      await attachTokens(pdfTokens, user, invoice.id, ["INVOICE_PDF"], tx);
      await attachTokens(xmlTokens, user, invoice.id, ["INVOICE_XML"], tx);
    });
  } catch (err) {
    if (err instanceof AttachmentError) return { error: err.message };
    throw err;
  }

  revalidatePath("/notas-fiscais");
  revalidatePath(`/notas-fiscais/${invoice.id}`);
  redirect(`/notas-fiscais/${invoice.id}`);
}

export async function cancelInvoice(_prev: InvoiceFormState, formData: FormData): Promise<InvoiceFormState> {
  await requireFinance();
  const invoiceId = String(formData.get("invoiceId") ?? "");
  if (!invoiceId) return { error: "Nota não encontrada." };

  const invoice = await db.invoice.findUnique({ where: { id: invoiceId }, select: { id: true, status: true } });
  if (!invoice) return { error: "Nota não encontrada." };
  if (invoice.status === "POSTED") return { error: "Nota lançada não pode ser cancelada por aqui." };
  if (invoice.status === "CANCELED") return { error: "Esta nota já está cancelada." };

  await db.invoice.update({ where: { id: invoice.id }, data: { status: "CANCELED" } });
  revalidatePath("/notas-fiscais");
  revalidatePath(`/notas-fiscais/${invoice.id}`);
  redirect(`/notas-fiscais/${invoice.id}`);
}
