"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { requireAdmin } from "@/lib/dal";
import { db } from "@/lib/db";

export type SectorFormState =
  | { ok?: boolean; error?: string; fieldErrors?: Record<string, string[] | undefined> }
  | undefined;

const sectorSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do setor.").max(80),
  costCenter: z
    .string()
    .trim()
    .min(1, "Informe o código do centro de custo.")
    .max(20)
    .regex(/^[A-Za-z0-9.\-]+$/, "Use apenas letras, números, ponto ou hífen."),
});

export async function createSector(_prev: SectorFormState, formData: FormData): Promise<SectorFormState> {
  await requireAdmin();
  const parsed = sectorSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  try {
    await db.sector.create({ data: parsed.data });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { error: "Já existe um setor com este nome ou centro de custo." };
    }
    throw err;
  }
  revalidatePath("/admin/setores");
  return { ok: true };
}

export async function setSectorActive(id: string, active: boolean): Promise<SectorFormState> {
  await requireAdmin();
  if (!active) {
    const chefias = await db.user.count({ where: { sectorId: id, role: "REQUESTER", active: true } });
    if (chefias > 0) {
      return { error: `Há ${chefias} chefia(s) ativa(s) neste setor. Remaneje ou desative antes.` };
    }
  }
  await db.sector.update({ where: { id }, data: { active } });
  revalidatePath("/admin/setores");
  revalidatePath("/admin/usuarios");
  return { ok: true };
}
