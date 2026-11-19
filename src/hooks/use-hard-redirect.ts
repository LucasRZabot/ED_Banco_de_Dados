"use client";

import { useEffect } from "react";

/**
 * Navegação completa entre os grupos (auth) e (app). A navegação do router entre eles após
 * mudança de sessão deixa a rota nova oculta (Activity do Cache Components), então evitamos.
 */
export function hardNavigate(target: string) {
  window.location.assign(target);
}

export function useHardRedirect(target: string | undefined) {
  useEffect(() => {
    if (target) hardNavigate(target);
  }, [target]);
}

export async function logoutAndReload(logout: () => Promise<{ redirectTo?: string } | undefined>) {
  const res = await logout();
  hardNavigate(res?.redirectTo ?? "/login");
}
