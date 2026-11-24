"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { requireAdmin } from "@/lib/dal";
import { db } from "@/lib/db";
import { log } from "@/lib/log";
import { generateTemporaryPassword, hashPassword } from "@/lib/password";
import { ROLES } from "@/lib/roles";

export type UserFormState =
  | {
      ok?: boolean;
      error?: string;
      fieldErrors?: Record<string, string[] | undefined>;
      temporaryPassword?: string;
      email?: string;
    }
  | undefined;

const userSchema = z
  .object({
    name: z.string().trim().min(3, "Informe o nome completo.").max(120),
    email: z.email("E-mail inválido.").transform((v) => v.trim().toLowerCase()),
    role: z.enum(ROLES),
    sectorId: z.string().trim().optional().transform((v) => v || null),
  })
  .refine((d) => d.role !== "REQUESTER" || d.sectorId, {
    path: ["sectorId"],
    message: "Chefia precisa estar vinculada a um setor.",
  });

async function assertSectorActive(sectorId: string | null) {
  if (!sectorId) return true;
  const sector = await db.sector.findUnique({ where: { id: sectorId }, select: { active: true } });
  return !!sector?.active;
}

/** Impede que a última conta ADMIN ativa seja rebaixada ou desativada. */
async function wouldRemoveLastAdmin(userId: string) {
  const target = await db.user.findUnique({ where: { id: userId }, select: { role: true, active: true } });
  if (!target || target.role !== "ADMIN" || !target.active) return false;
  const activeAdmins = await db.user.count({ where: { role: "ADMIN", active: true } });
  return activeAdmins <= 1;
}

export async function createUser(_prev: UserFormState, formData: FormData): Promise<UserFormState> {
  await requireAdmin();
  const parsed = userSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const data = parsed.data;

  if (!(await assertSectorActive(data.sectorId))) return { fieldErrors: { sectorId: ["Setor inválido ou inativo."] } };

  const temporaryPassword = generateTemporaryPassword();
  try {
    await db.user.create({
      data: {
        name: data.name,
        email: data.email,
        role: data.role,
        sectorId: data.sectorId,
        passwordHash: await hashPassword(temporaryPassword),
        mustChangePassword: true,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { fieldErrors: { email: ["Já existe um usuário com este e-mail."] } };
    }
    throw err;
  }

  revalidatePath("/admin/usuarios");
  return { ok: true, temporaryPassword, email: data.email };
}

export async function updateUser(_prev: UserFormState, formData: FormData): Promise<UserFormState> {
  const admin = await requireAdmin();
  const id = z.string().min(1).parse(formData.get("id"));
  const parsed = userSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const data = parsed.data;

  if (!(await assertSectorActive(data.sectorId))) return { fieldErrors: { sectorId: ["Setor inválido ou inativo."] } };
  if (data.role !== "ADMIN" && (id === admin.id || (await wouldRemoveLastAdmin(id)))) {
    return { error: "Não é possível remover o perfil de administrador desta conta." };
  }

  try {
    await db.user.update({
      where: { id },
      data: { name: data.name, email: data.email, role: data.role, sectorId: data.sectorId },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { fieldErrors: { email: ["Já existe um usuário com este e-mail."] } };
    }
    throw err;
  }

  revalidatePath("/admin/usuarios");
  return { ok: true };
}

export async function setUserActive(id: string, active: boolean): Promise<UserFormState> {
  const admin = await requireAdmin();
  if (!active && (id === admin.id || (await wouldRemoveLastAdmin(id)))) {
    return { error: "Você não pode desativar a própria conta nem o último administrador." };
  }
  await db.user.update({ where: { id }, data: { active } });
  revalidatePath("/admin/usuarios");
  return { ok: true };
}

export async function resetUserPassword(id: string): Promise<UserFormState> {
  const admin = await requireAdmin();
  const temporaryPassword = generateTemporaryPassword();
  const user = await db.user.update({
    where: { id },
    data: {
      passwordHash: await hashPassword(temporaryPassword),
      mustChangePassword: true,
      sessionVersion: { increment: 1 },
    },
    select: { id: true, email: true },
  });
  // A sessão atual continua sendo a da TI. Não chama signIn da conta redefinida.
  log.info("admin.password_reset", { actorId: admin.id, targetId: user.id });
  revalidatePath("/admin/usuarios");
  return { ok: true, temporaryPassword, email: user.email };
}
