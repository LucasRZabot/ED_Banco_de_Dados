import type { AppRole } from "@/lib/roles";

type Viewer = { id: string; role: AppRole };

/**
 * O FINANCEIRO vê tudo o que foi enviado. A chefia vê somente o que ela mesma criou
 * (chamado que abriu, nota que enviou, arquivo que anexou). O ADMIN não vê conteúdo.
 */
export function canViewOwnSubmission(viewer: Viewer, authorId: string) {
  if (viewer.role === "FINANCEIRO") return true;
  if (viewer.role === "REQUESTER") return viewer.id === authorId;
  return false;
}

export const canViewTicket = canViewOwnSubmission;
export const canViewInvoice = canViewOwnSubmission;

/** Boletos, orçamentos, contratos e dashboard: só a coordenação financeira. */
export function canViewBill(viewer: Viewer) {
  return viewer.role === "FINANCEIRO";
}

export const canViewQuote = canViewBill;
export const canViewContract = canViewBill;
