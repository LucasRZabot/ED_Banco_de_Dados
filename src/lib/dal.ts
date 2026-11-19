import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { homePathFor } from "@/lib/roles";

/**
 * Fonte de verdade da autorização: relê o usuário no banco a cada requisição, então
 * desativação ou troca de papel feitas pelo ADMIN valem na hora, mesmo com JWT ainda válido.
 */
export const getCurrentUser = cache(async () => {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;

  const user = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      mustChangePassword: true,
      sectorId: true,
      sector: { select: { id: true, name: true, costCenter: true } },
    },
  });
  if (!user || !user.active) return null;
  return user;
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

/** Para páginas e server actions. `allowPendingPassword` só na tela de troca de senha. */
export async function requireUser(opts: { allowPendingPassword?: boolean } = {}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?expirada=1");
  if (user.mustChangePassword && !opts.allowPendingPassword) redirect("/alterar-senha");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect(homePathFor(user.role));
  return user;
}

/** Para route handlers: devolve o usuário ou uma Response de erro pronta. */
export async function authenticateRequest():
  Promise<{ user: CurrentUser; error?: never } | { user?: never; error: Response }> {
  const user = await getCurrentUser();
  if (!user) return { error: Response.json({ error: "Não autenticado." }, { status: 401 }) };
  if (user.mustChangePassword) {
    return { error: Response.json({ error: "Troca de senha pendente." }, { status: 403 }) };
  }
  return { user };
}
