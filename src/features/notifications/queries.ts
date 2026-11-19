import "server-only";
import type { CurrentUser } from "@/lib/dal";
import { db } from "@/lib/db";

export async function listNotifications(user: CurrentUser, take = 30) {
  return db.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take,
  });
}

export async function unreadNotificationCount(user: CurrentUser) {
  return db.notification.count({ where: { userId: user.id, readAt: null } });
}
