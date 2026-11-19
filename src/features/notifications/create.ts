import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { NotificationSeverity, NotificationType } from "@/generated/prisma/enums";
import { db } from "@/lib/db";

type NotifyInput = {
  userIds: string[];
  type: NotificationType;
  severity?: NotificationSeverity;
  title: string;
  message: string;
  link?: string;
  ticketId?: string;
  dedupeKey: (userId: string) => string;
};

export async function notifyUsers(input: NotifyInput, tx: Prisma.TransactionClient = db) {
  if (!input.userIds.length) return;
  await tx.notification.createMany({
    skipDuplicates: true,
    data: input.userIds.map((userId) => ({
      userId,
      type: input.type,
      severity: input.severity ?? "INFO",
      title: input.title,
      message: input.message,
      link: input.link,
      ticketId: input.ticketId,
      dedupeKey: input.dedupeKey(userId),
    })),
  });
}

export async function financeUserIds(tx: Prisma.TransactionClient = db) {
  const users = await tx.user.findMany({
    where: { role: "FINANCEIRO", active: true },
    select: { id: true },
  });
  return users.map((u) => u.id);
}
