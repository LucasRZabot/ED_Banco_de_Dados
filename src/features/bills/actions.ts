"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { AttachmentError, attachUploadedFile } from "@/lib/attachments";
import { requireFinance } from "@/lib/dal";
import { parseDateOnly } from "@/lib/dates";
import { db } from "@/lib/db";
import { createBillSchema, payBillSchema } from "./schemas";

export type BillFormState =
  | { error?: string; fieldErrors?: Record<string, string[] | undefined> }
  | undefined;

function tokensFrom(formData: FormData, name = "uploadTokens") {
  return formData.getAll(name).filter((v): v is string => typeof v === "string" && v.length > 0);
}

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
    if (!existing?.active) throw new BillActionError("Fornecedor inválido ou inativo.");
    return existing.id;
  }
  const created = await tx.supplier.create({
    data: {
      legalName: data.supplierLegalName!,
      cnpj: data.supplierCnpj!,
    },
  });
  return created.id;
}

class BillActionError extends Error {}

export async function createBill(_prev: BillFormState, formData: FormData): Promise<BillFormState> {
  const user = await requireFinance();
  const parsed = createBillSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const sector = await db.sector.findUnique({
    where: { id: parsed.data.sectorId },
    select: { id: true, active: true },
  });
  if (!sector?.active) return { fieldErrors: { sectorId: ["Setor inválido ou inativo."] } };

  const tokens = tokensFrom(formData);
  let billId = "";
  const invoiceId = parsed.data.invoiceId;
  const contractId = parsed.data.contractId;
  if (invoiceId) {
    const invoice = await db.invoice.findUnique({ where: { id: invoiceId }, select: { id: true, status: true } });
    if (!invoice || invoice.status !== "POSTED") return { error: "Nota inválida para gerar boleto." };
  }
  if (contractId) {
    const contract = await db.contract.findUnique({ where: { id: contractId }, select: { id: true } });
    if (!contract) return { error: "Contrato inválido para gerar boleto." };
  }

  try {
    billId = await db.$transaction(async (tx) => {
      const supplierId = await resolveSupplier(tx, parsed.data);
      const bill = await tx.bill.create({
        data: {
          digitableLine: parsed.data.digitableLine,
          amount: parsed.data.amount.toFixed(2),
          dueDate: parseDateOnly(parsed.data.dueDate),
          description: parsed.data.description,
          installment: parsed.data.installment,
          supplierId,
          sectorId: parsed.data.sectorId,
          invoiceId,
          contractId,
          createdById: user.id,
        },
      });
      for (const token of tokens) {
        await attachUploadedFile(token, user, { billId: bill.id }, ["BILL"], tx);
      }
      return bill.id;
    });
  } catch (err) {
    if (err instanceof BillActionError) return { error: err.message };
    if (err instanceof AttachmentError) return { error: err.message };
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const target = JSON.stringify(err.meta?.target ?? "");
      if (target.includes("cnpj")) return { fieldErrors: { supplierCnpj: ["Já existe um fornecedor com este CNPJ."] } };
      return { fieldErrors: { digitableLine: ["Já existe um boleto com esta linha digitável."] } };
    }
    throw err;
  }

  revalidatePath("/boletos");
  revalidatePath("/dashboard");
  redirect(`/boletos/${billId}`);
}

export async function updateBill(_prev: BillFormState, formData: FormData): Promise<BillFormState> {
  const user = await requireFinance();
  const billId = String(formData.get("billId") ?? "");
  if (!billId) return { error: "Boleto não encontrado." };

  const existing = await db.bill.findUnique({
    where: { id: billId },
    select: { id: true, status: true },
  });
  if (!existing) return { error: "Boleto não encontrado." };
  if (existing.status === "PAID") return { error: "Boleto pago: só é possível anexar o PDF, sem alterar os dados." };

  const parsed = createBillSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const sector = await db.sector.findUnique({
    where: { id: parsed.data.sectorId },
    select: { id: true, active: true },
  });
  if (!sector?.active) return { fieldErrors: { sectorId: ["Setor inválido ou inativo."] } };

  const tokens = tokensFrom(formData);
  try {
    await db.$transaction(async (tx) => {
      const supplierId = await resolveSupplier(tx, parsed.data);
      await tx.bill.update({
        where: { id: existing.id },
        data: {
          digitableLine: parsed.data.digitableLine,
          amount: parsed.data.amount.toFixed(2),
          dueDate: parseDateOnly(parsed.data.dueDate),
          description: parsed.data.description,
          installment: parsed.data.installment,
          supplierId,
          sectorId: parsed.data.sectorId,
        },
      });
      for (const token of tokens) {
        await attachUploadedFile(token, user, { billId: existing.id }, ["BILL"], tx);
      }
    });
  } catch (err) {
    if (err instanceof BillActionError) return { error: err.message };
    if (err instanceof AttachmentError) return { error: err.message };
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const target = JSON.stringify(err.meta?.target ?? "");
      if (target.includes("cnpj")) return { fieldErrors: { supplierCnpj: ["Já existe um fornecedor com este CNPJ."] } };
      return { fieldErrors: { digitableLine: ["Já existe um boleto com esta linha digitável."] } };
    }
    throw err;
  }

  revalidatePath("/boletos");
  revalidatePath(`/boletos/${existing.id}`);
  revalidatePath("/dashboard");
  redirect(`/boletos/${existing.id}`);
}

export async function attachBillPdf(_prev: BillFormState, formData: FormData): Promise<BillFormState> {
  const user = await requireFinance();
  const billId = String(formData.get("billId") ?? "");
  const tokens = tokensFrom(formData);
  if (!billId) return { error: "Boleto não encontrado." };
  if (!tokens.length) return { error: "Anexe o PDF do boleto." };

  const bill = await db.bill.findUnique({ where: { id: billId }, select: { id: true } });
  if (!bill) return { error: "Boleto não encontrado." };

  try {
    await db.$transaction(async (tx) => {
      for (const token of tokens) {
        await attachUploadedFile(token, user, { billId: bill.id }, ["BILL"], tx);
      }
    });
  } catch (err) {
    if (err instanceof AttachmentError) return { error: err.message };
    throw err;
  }

  revalidatePath("/boletos");
  revalidatePath(`/boletos/${bill.id}`);
  redirect(`/boletos/${bill.id}`);
}

export async function payBill(_prev: BillFormState, formData: FormData): Promise<BillFormState> {
  const user = await requireFinance();
  const parsed = payBillSchema.safeParse({
    billId: formData.get("billId"),
    paidAt: formData.get("paidAt"),
    paidAmount: formData.get("paidAmount"),
    paymentNote: formData.get("paymentNote") ?? "",
  });
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const tokens = tokensFrom(formData, "proofTokens");
  if (!tokens.length) return { error: "Anexe o comprovante de pagamento (PDF ou imagem)." };

  const bill = await db.bill.findUnique({
    where: { id: parsed.data.billId },
    select: { id: true, status: true },
  });
  if (!bill) return { error: "Boleto não encontrado." };
  if (bill.status === "PAID") return { error: "Este boleto já foi baixado." };

  try {
    await db.$transaction(async (tx) => {
      await tx.bill.update({
        where: { id: bill.id },
        data: {
          status: "PAID",
          paidAt: parseDateOnly(parsed.data.paidAt),
          paidAmount: parsed.data.paidAmount.toFixed(2),
          paymentNote: parsed.data.paymentNote,
          paidById: user.id,
        },
      });
      for (const token of tokens) {
        await attachUploadedFile(token, user, { billId: bill.id }, ["BILL_PAYMENT_PROOF"], tx);
      }
    });
  } catch (err) {
    if (err instanceof AttachmentError) return { error: err.message };
    throw err;
  }

  revalidatePath("/boletos");
  revalidatePath(`/boletos/${bill.id}`);
  revalidatePath("/dashboard");
  revalidatePath("/notificacoes");
  redirect(`/boletos/${bill.id}`);
}
