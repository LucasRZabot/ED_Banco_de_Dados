"use client";

import { markNotificationRead } from "../actions";
import { formatDateTime } from "@/lib/format";

export function NotificationRow({
  id,
  title,
  message,
  link,
  createdAt,
  unread,
}: {
  id: string;
  title: string;
  message: string;
  link: string | null;
  createdAt: string;
  unread: boolean;
}) {
  return (
    <a
      href={link ?? "/notificacoes"}
      className={`block p-4 hover:bg-muted/40 ${unread ? "bg-muted/30" : ""}`}
      onClick={() => {
        void markNotificationRead(id);
      }}
    >
      <p className={unread ? "text-sm font-medium" : "text-sm"}>{title}</p>
      <p className="text-sm text-muted-foreground">{message}</p>
      <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(createdAt)}</p>
    </a>
  );
}
