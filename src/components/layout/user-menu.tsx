"use client";

import { ChevronsUpDown, KeyRound, LogOut } from "lucide-react";
import { logout } from "@/app/(auth)/actions";
import { logoutAndReload } from "@/hooks/use-hard-redirect";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";

export type UserMenuUser = { name: string | null; email: string; subtitle: string };

function initials(name: string | null, email: string) {
  const base = (name ?? email).trim();
  const parts = base.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts.at(-1)![0] : "")).toUpperCase() || "?";
}

export function UserMenu({ user }: { user: UserMenuUser }) {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger render={<SidebarMenuButton size="lg" />}>
            <Avatar className="size-8 rounded-lg">
              <AvatarFallback className="rounded-lg">{initials(user.name, user.email)}</AvatarFallback>
            </Avatar>
            <span className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{user.name ?? user.email}</span>
              <span className="truncate text-xs text-muted-foreground">{user.subtitle}</span>
            </span>
            <ChevronsUpDown className="ml-auto size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="min-w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="truncate">{user.email}</DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            {/* Navegação completa: sai do grupo (app) para o (auth). */}
            <DropdownMenuItem render={<a href="/alterar-senha" />}>
              <KeyRound />
              Alterar senha
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => logoutAndReload(logout)}>
              <LogOut />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
