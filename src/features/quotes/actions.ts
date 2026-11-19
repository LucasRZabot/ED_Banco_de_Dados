"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { AttachmentError, attachUploadedFile } from "@/lib/attachments";
import { requireFinance } from "@/lib/dal";
import { parseDateOnly } from "@/lib/dates";
import { db } from "@/lib/db";
import { formatBRL } from "@/lib/format";
import { convertQuoteSchema, createQuoteSchema, decideQuoteSchema } from "./schemas";

export type QuoteFormState =
  | { error?: string; fieldErrors?: Record<string, string[] | undefined> }
  | undefined;

function tokensFrom(formData: FormData, name = "uploadTokens") {
  return formData.getAll(name).filter((v): v is string => typeof v === "string" && v.length > 0);
}

class QuoteActionError extends Error {}

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
    if (!existing?.active) throw new QuoteActionError("Fornecedor inválido ou inativo.");
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

async function assertPurchaseTicket(tx: Prisma.TransactionClient, ticketId: string | null) {
  if (!ticketId) return null;
  const ticket = await tx.ticket.findUnique({
    where: { id: ticketId },
    select: { id: true, type: true, status: true, sectorId: true },
  });
  if (!ticket) throw new QuoteActionError("Chamado não encontrado.");
  if (ticket.type !== "PURCHASE_QUOTE") {
    throw new QuoteActionError("Só é possível vincular orçamentos a chamados de compra / orçamento.");
  }
  if (ticket.status === "CANCELED" || ticket.status === "COMPLETED") {
    throw new QuoteActionError("Este chamado já foi encerrado.");
  }
  return ticket;
}

function revalidateQuote(quoteId: string, ticketId?: string | null) {
  revalidatePath("/orcamentos");
  revalidatePath(`/orcamentos/${quoteId}`);
  if (ticketId) {
    revalidatePath("/chamados");
    revalidatePath(`/chamados/${ticketId}`);
  }
}

export async function createQuote(_prev: QuoteFormState, formData: FormData): Promise<QuoteFormState> {
  const user = await requireFinance();
  const parsed = createQuoteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const tokens = tokensFrom(formData);
  if (!tokens.length) return { error: "Anexe o PDF da proposta." };

  let quoteId = "";
  try {
    quoteId = await db.$transaction(async (tx) => {
      const ticket = await assertPurchaseTicket(tx, parsed.data.ticketId);
      const supplierId = await resolveSupplier(tx, parsed.data);
      const quote = await tx.quote.create({
        data: {
          amount: parsed.data.amount.toFixed(2),
          validUntil: parseDateOnly(parsed.data.validUntil),
          description: parsed.data.description,
          ticketId: ticket?.id ?? null,
          supplierId,
          createdById: user.id,
        },
      });
      for (const token of tokens) {
        await attachUploadedFile(token, user, { quoteId: quote.id }, ["QUOTE"], tx);
      }
      return quote.id;
    });
  } catch (err) {
    if (err instanceof QuoteActionError) return { error: err.message };
    if (err instanceof AttachmentError) return { error: err.message };
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { fieldErrors: { supplierCnpj: ["Já existe um fornecedor com este CNPJ."] } };
    }
    throw err;
  }

  revalidateQuote(quoteId, parsed.data.ticketId);
  redirect(`/orcamentos/${quoteId}`);
}

export async function updateQuote(_prev: QuoteFormState, formData: FormData): Promise<QuoteFormState> {
  const user = await requireFinance();
  const quoteId = String(formData.get("quoteId") ?? "");
  if (!quoteId) return { error: "Orçamento não encontrado." };

  const existing = await db.quote.findUnique({
    where: { id: quoteId },
    select: { id: true, status: true, ticketId: true },
  });
  if (!existing) return { error: "Orçamento não encontrado." };
  if (existing.status !== "PENDING") return { error: "Só é possível editar orçamentos pendentes." };

  const parsed = createQuoteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const tokens = tokensFrom(formData);
  try {
    await db.$transaction(async (tx) => {
      const ticket = await assertPurchaseTicket(tx, parsed.data.ticketId);
      const supplierId = await resolveSupplier(tx, parsed.data);
      await tx.quote.update({
        where: { id: existing.id },
        data: {
          amount: parsed.data.amount.toFixed(2),
          validUntil: parseDateOnly(parsed.data.validUntil),
          description: parsed.data.description,
          ticketId: ticket?.id ?? null,
          supplierId,
        },
      });
      for (const token of tokens) {
        await attachUploadedFile(token, user, { quoteId: existing.id }, ["QUOTE"], tx);
      }
    });
  } catch (err) {
    if (err instanceof QuoteActionError) return { error: err.message };
    if (err instanceof AttachmentError) return { error: err.message };
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { fieldErrors: { supplierCnpj: ["Já existe um fornecedor com este CNPJ."] } };
    }
    throw err;
  }

  revalidateQuote(existing.id, parsed.data.ticketId ?? existing.ticketId);
  redirect(`/orcamentos/${existing.id}`);
}

export async function attachQuoteFiles(_prev: QuoteFormState, formData: FormData): Promise<QuoteFormState> {
  const user = await requireFinance();
  const quoteId = String(formData.get("quoteId") ?? "");
  const tokens = tokensFrom(formData);
  if (!quoteId) return { error: "Orçamento não encontrado." };
  if (!tokens.length) return { error: "Anexe o PDF da proposta." };

  const quote = await db.quote.findUnique({ where: { id: quoteId }, select: { id: true, ticketId: true } });
  if (!quote) return { error: "Orçamento não encontrado." };

  try {
    await db.$transaction(async (tx) => {
      for (const token of tokens) {
        await attachUploadedFile(token, user, { quoteId: quote.id }, ["QUOTE"], tx);
      }
    });
  } catch (err) {
    if (err instanceof AttachmentError) return { error: err.message };
    throw err;
  }

  revalidateQuote(quote.id, quote.ticketId);
  redirect(`/orcamentos/${quote.id}`);
}

export async function decideQuote(_prev: QuoteFormState, formData: FormData): Promise<QuoteFormState> {
  const user = await requireFinance();
  const parsed = decideQuoteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const quote = await db.quote.findUnique({
    where: { id: parsed.data.quoteId },
    select: { id: true, status: true, ticketId: true },
  });
  if (!quote) return { error: "Orçamento não encontrado." };
  if (quote.status !== "PENDING") return { error: "Este orçamento já foi avaliado." };

  const now = new Date();
  const rejectSiblings = parsed.data.decision === "APPROVED" && parsed.data.rejectSiblings && Boolean(quote.ticketId);

  await db.$transaction(async (tx) => {
    await tx.quote.update({
      where: { id: quote.id },
      data: {
        status: parsed.data.decision,
        decisionNote: parsed.data.decisionNote,
        decidedById: user.id,
        decidedAt: now,
      },
    });
    if (rejectSiblings && quote.ticketId) {
      await tx.quote.updateMany({
        where: { ticketId: quote.ticketId, id: { not: quote.id }, status: "PENDING" },
        data: {
          status: "REJECTED",
          decisionNote: "Reprovado automaticamente: outro orçamento do chamado foi aprovado.",
          decidedById: user.id,
          decidedAt: now,
        },
      });
    }
  });

  revalidateQuote(quote.id, quote.ticketId);
  redirect(`/orcamentos/${quote.id}`);
}

/**
 * Converte orçamento aprovado em NF pendente pré-preenchida.
 * O chamado só vai para COMPLETED quando a nota é lançada (POSTED).
 * Vínculo a contrato fica na Etapa 7 — ver gancho na UI.
 */
export async function convertQuoteToInvoice(_prev: QuoteFormState, formData: FormData): Promise<QuoteFormState> {
  const user = await requireFinance();
  const parsed = convertQuoteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const quote = await db.quote.findUnique({
    where: { id: parsed.data.quoteId },
    include: {
      supplier: { select: { legalName: true } },
      ticket: { select: { id: true, type: true, sectorId: true, status: true } },
      invoices: { where: { status: { not: "CANCELED" } }, select: { id: true }, take: 1 },
    },
  });
  if (!quote) return { error: "Orçamento não encontrado." };
  if (quote.status !== "APPROVED") return { error: "Só é possível converter orçamentos aprovados." };
  if (quote.invoices[0]) {
    redirect(`/notas-fiscais/${quote.invoices[0].id}`);
  }
  if (quote.ticket?.type === "CONTRACT_INCLUSION") {
    return { error: "Este orçamento está ligado a um chamado de inclusão de contrato. A conversão em contrato entra na Etapa 7." };
  }

  const sectorId = quote.ticket?.sectorId ?? parsed.data.sectorId ?? user.sectorId;
  if (!sectorId) return { fieldErrors: { sectorId: ["Escolha o setor / centro de custo da nota."] } };

  const sector = await db.sector.findUnique({ where: { id: sectorId }, select: { id: true, active: true } });
  if (!sector?.active) return { fieldErrors: { sectorId: ["Setor inválido ou inativo."] } };

  const description =
    quote.description && quote.description.trim().length >= 8
      ? quote.description.trim()
      : `Lançamento do orçamento ${quote.supplier.legalName} (${formatBRL(quote.amount)})`;

  const invoice = await db.invoice.create({
    data: {
      description,
      sectorId,
      submittedById: user.id,
      quoteId: quote.id,
      ticketId: quote.ticketId,
      supplierId: quote.supplierId,
      amount: quote.amount,
    },
  });

  revalidateQuote(quote.id, quote.ticketId);
  revalidatePath("/notas-fiscais");
  revalidatePath(`/notas-fiscais/${invoice.id}`);
  redirect(`/notas-fiscais/${invoice.id}`);
}
