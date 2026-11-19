"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { AttachmentError, attachUploadedFile } from "@/lib/attachments";
import { requireFinance } from "@/lib/dal";
import { parseDateOnly } from "@/lib/dates";
import { db } from "@/lib/db";
import { completeLinkedTicket } from "@/features/tickets/complete";
import { TicketFlowError } from "@/features/tickets/status-machine";
import { createContractSchema } from "./schemas";

export type ContractFormState =
  | { error?: string; fieldErrors?: Record<string, string[] | undefined> }
  | undefined;

function tokensFrom(formData: FormData, name = "uploadTokens") {
  return formData.getAll(name).filter((v): v is string => typeof v === "string" && v.length > 0);
}

class ContractActionError extends Error {}

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
    if (!existing?.active) throw new ContractActionError("Fornecedor inválido ou inativo.");
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
  return (
    await tx.supplier.create({
      data: { legalName: data.supplierLegalName!, cnpj },
    })
  ).id;
}

async function assertInclusionTicket(tx: Prisma.TransactionClient, ticketId: string | null, currentContractId?: string) {
  if (!ticketId) return null;
  const ticket = await tx.ticket.findUnique({
    where: { id: ticketId },
    select: { id: true, type: true, status: true, sectorId: true, contract: { select: { id: true } } },
  });
  if (!ticket) throw new ContractActionError("Chamado não encontrado.");
  if (ticket.type !== "CONTRACT_INCLUSION") {
    throw new ContractActionError("Só é possível converter chamados de inclusão de contrato.");
  }
  if (ticket.status === "CANCELED") throw new ContractActionError("Este chamado foi cancelado.");
  if (ticket.contract && ticket.contract.id !== currentContractId) {
    throw new ContractActionError("Este chamado já gerou um contrato.");
  }
  return ticket;
}

function notesWithQuote(notes: string | null, quoteId: string | null) {
  if (!quoteId) return notes;
  const tag = `Origem: orçamento ${quoteId}`;
  if (notes?.includes(tag)) return notes;
  return notes ? `${notes}\n\n${tag}` : tag;
}

function revalidateContract(contractId: string, ticketId?: string | null) {
  revalidatePath("/contratos");
  revalidatePath(`/contratos/${contractId}`);
  revalidatePath("/dashboard");
  if (ticketId) {
    revalidatePath("/chamados");
    revalidatePath(`/chamados/${ticketId}`);
  }
}

export async function createContract(_prev: ContractFormState, formData: FormData): Promise<ContractFormState> {
  const user = await requireFinance();
  const parsed = createContractSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const tokens = tokensFrom(formData);
  if (!tokens.length) return { error: "Anexe o PDF do contrato assinado." };

  let contractId = "";
  try {
    contractId = await db.$transaction(async (tx) => {
      const ticket = await assertInclusionTicket(tx, parsed.data.ticketId);
      const supplierId = await resolveSupplier(tx, parsed.data);
      const sectorId = ticket?.sectorId ?? parsed.data.sectorId;
      const sector = await tx.sector.findUnique({ where: { id: sectorId }, select: { id: true, active: true } });
      if (!sector?.active) throw new ContractActionError("Setor inválido ou inativo.");

      const contract = await tx.contract.create({
        data: {
          code: parsed.data.code,
          object: parsed.data.object,
          supplierId,
          sectorId,
          monthlyValue: parsed.data.monthlyValue?.toFixed(2),
          totalValue: parsed.data.totalValue?.toFixed(2),
          startDate: parseDateOnly(parsed.data.startDate),
          endDate: parsed.data.endDate ? parseDateOnly(parsed.data.endDate) : null,
          renewalDate: parsed.data.renewalDate ? parseDateOnly(parsed.data.renewalDate) : null,
          autoRenew: parsed.data.autoRenew,
          alertDaysBefore: parsed.data.alertDaysBefore,
          notes: notesWithQuote(parsed.data.notes, parsed.data.quoteId),
          ticketId: ticket?.id ?? null,
          createdById: user.id,
        },
      });
      for (const token of tokens) {
        await attachUploadedFile(token, user, { contractId: contract.id }, ["CONTRACT"], tx);
      }
      if (ticket) await completeLinkedTicket(tx, ticket.id, user.id, ["CONTRACT_INCLUSION"]);
      return contract.id;
    });
  } catch (err) {
    if (err instanceof ContractActionError) return { error: err.message };
    if (err instanceof TicketFlowError) return { error: err.message };
    if (err instanceof AttachmentError) return { error: err.message };
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const target = JSON.stringify(err.meta?.target ?? "");
      if (target.includes("cnpj")) return { fieldErrors: { supplierCnpj: ["Já existe um fornecedor com este CNPJ."] } };
      if (target.includes("ticketId")) return { error: "Este chamado já gerou um contrato." };
      return { fieldErrors: { code: ["Já existe um contrato com este número."] } };
    }
    throw err;
  }

  revalidateContract(contractId, parsed.data.ticketId);
  redirect(`/contratos/${contractId}`);
}

export async function updateContract(_prev: ContractFormState, formData: FormData): Promise<ContractFormState> {
  const user = await requireFinance();
  const contractId = String(formData.get("contractId") ?? "");
  if (!contractId) return { error: "Contrato não encontrado." };

  const existing = await db.contract.findUnique({
    where: { id: contractId },
    select: { id: true, status: true, ticketId: true },
  });
  if (!existing) return { error: "Contrato não encontrado." };
  if (existing.status === "TERMINATED") return { error: "Contrato encerrado: só é possível anexar o PDF." };

  const parsed = createContractSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const tokens = tokensFrom(formData);
  try {
    await db.$transaction(async (tx) => {
      const ticket = await assertInclusionTicket(tx, parsed.data.ticketId, existing.id);
      const supplierId = await resolveSupplier(tx, parsed.data);
      const sectorId = ticket?.sectorId ?? parsed.data.sectorId;
      const sector = await tx.sector.findUnique({ where: { id: sectorId }, select: { id: true, active: true } });
      if (!sector?.active) throw new ContractActionError("Setor inválido ou inativo.");

      await tx.contract.update({
        where: { id: existing.id },
        data: {
          code: parsed.data.code,
          object: parsed.data.object,
          supplierId,
          sectorId,
          monthlyValue: parsed.data.monthlyValue?.toFixed(2) ?? null,
          totalValue: parsed.data.totalValue?.toFixed(2) ?? null,
          startDate: parseDateOnly(parsed.data.startDate),
          endDate: parsed.data.endDate ? parseDateOnly(parsed.data.endDate) : null,
          renewalDate: parsed.data.renewalDate ? parseDateOnly(parsed.data.renewalDate) : null,
          autoRenew: parsed.data.autoRenew,
          alertDaysBefore: parsed.data.alertDaysBefore,
          notes: notesWithQuote(parsed.data.notes, parsed.data.quoteId),
          ticketId: ticket?.id ?? existing.ticketId,
          status: existing.status === "EXPIRED" && parsed.data.autoRenew ? "ACTIVE" : existing.status,
        },
      });
      for (const token of tokens) {
        await attachUploadedFile(token, user, { contractId: existing.id }, ["CONTRACT"], tx);
      }
    });
  } catch (err) {
    if (err instanceof ContractActionError) return { error: err.message };
    if (err instanceof TicketFlowError) return { error: err.message };
    if (err instanceof AttachmentError) return { error: err.message };
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const target = JSON.stringify(err.meta?.target ?? "");
      if (target.includes("cnpj")) return { fieldErrors: { supplierCnpj: ["Já existe um fornecedor com este CNPJ."] } };
      return { fieldErrors: { code: ["Já existe um contrato com este número."] } };
    }
    throw err;
  }

  revalidateContract(existing.id, parsed.data.ticketId ?? existing.ticketId);
  redirect(`/contratos/${existing.id}`);
}

export async function attachContractFile(_prev: ContractFormState, formData: FormData): Promise<ContractFormState> {
  const user = await requireFinance();
  const contractId = String(formData.get("contractId") ?? "");
  const tokens = tokensFrom(formData);
  if (!contractId) return { error: "Contrato não encontrado." };
  if (!tokens.length) return { error: "Anexe o PDF do contrato assinado." };

  const contract = await db.contract.findUnique({ where: { id: contractId }, select: { id: true, ticketId: true } });
  if (!contract) return { error: "Contrato não encontrado." };

  try {
    await db.$transaction(async (tx) => {
      for (const token of tokens) {
        await attachUploadedFile(token, user, { contractId: contract.id }, ["CONTRACT"], tx);
      }
    });
  } catch (err) {
    if (err instanceof AttachmentError) return { error: err.message };
    throw err;
  }

  revalidateContract(contract.id, contract.ticketId);
  redirect(`/contratos/${contract.id}`);
}

export async function terminateContract(_prev: ContractFormState, formData: FormData): Promise<ContractFormState> {
  await requireFinance();
  const contractId = String(formData.get("contractId") ?? "");
  if (!contractId) return { error: "Contrato não encontrado." };

  const contract = await db.contract.findUnique({
    where: { id: contractId },
    select: { id: true, status: true, ticketId: true },
  });
  if (!contract) return { error: "Contrato não encontrado." };
  if (contract.status === "TERMINATED") return { error: "Este contrato já está encerrado." };

  await db.contract.update({ where: { id: contract.id }, data: { status: "TERMINATED" } });
  revalidateContract(contract.id, contract.ticketId);
  redirect(`/contratos/${contract.id}`);
}

