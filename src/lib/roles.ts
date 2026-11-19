// Sem dependência do Prisma: usado também no proxy e em Client Components.
export const ROLES = ["ADMIN", "REQUESTER"] as const;
export type AppRole = (typeof ROLES)[number];

export const ROLE_LABELS: Record<AppRole, string> = {
  ADMIN: "Administrador (Faturamento/Compras)",
  REQUESTER: "Chefia de setor",
};

export function homePathFor(role: AppRole | undefined) {
  return role === "ADMIN" ? "/dashboard" : "/chamados";
}
