import "server-only";
import type { NotificationSeverity, NotificationType } from "@/generated/prisma/enums";
import { financeUserIds, notifyUsers } from "@/features/notifications/create";
import { addDays, todayInTz, ymdInTz } from "@/lib/dates";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { formatBRL, formatDate } from "@/lib/format";

export type CheckDeadlinesResult = {
  today: string;
  billsMarkedOverdue: number;
  contractsExpired: number;
  notificationsCreated: number;
};

/**
 * Marca atrasados e gera alertas idempotentes (`dedupeKey` + skipDuplicates).
 * "Hoje" é o dia civil em APP_TIMEZONE (America/Sao_Paulo).
 * Fan-out só para FINANCEIRO ativo — ADMIN não vê dados financeiros.
 */
export async function runCheckDeadlines(now = new Date()): Promise<CheckDeadlinesResult> {
  const timeZone = env().APP_TIMEZONE;
  const warningDays = env().ALERT_WARNING_DAYS;
  const today = todayInTz(timeZone);
  const todayKey = ymdInTz(now, timeZone);
  const soonLimit = addDays(today, warningDays);

  return db.$transaction(async (tx) => {
    const overdue = await tx.bill.updateMany({
      where: { status: "TO_PAY", dueDate: { lt: today } },
      data: { status: "OVERDUE" },
    });

    const finance = await financeUserIds(tx);
    let notificationsCreated = 0;

    const bills = await tx.bill.findMany({
      where: { status: { in: ["TO_PAY", "OVERDUE"] }, dueDate: { lte: soonLimit } },
      include: { supplier: { select: { legalName: true } } },
    });

    for (const bill of bills) {
      const kind =
        bill.dueDate < today ? "OVERDUE" : bill.dueDate.getTime() === today.getTime() ? "TODAY" : "SOON";
      const type: NotificationType =
        kind === "OVERDUE" ? "BILL_OVERDUE" : kind === "TODAY" ? "BILL_DUE_TODAY" : "BILL_DUE_SOON";
      const severity: NotificationSeverity = kind === "SOON" ? "WARNING" : "CRITICAL";
      const title =
        kind === "OVERDUE"
          ? "Boleto atrasado"
          : kind === "TODAY"
            ? "Boleto vence hoje"
            : "Boleto próximo do vencimento";
      const result = await notifyUsers(
        {
          userIds: finance,
          type,
          severity,
          title,
          message: `${bill.supplier.legalName} · ${formatBRL(bill.amount)} · vence ${formatDate(bill.dueDate)}.`,
          link: `/boletos/${bill.id}`,
          billId: bill.id,
          dedupeKey: () => `bill:${bill.id}:${kind}:${todayKey}`,
        },
        tx,
      );
      notificationsCreated += result.count;
    }

    const contracts = await tx.contract.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        object: true,
        endDate: true,
        renewalDate: true,
        autoRenew: true,
        alertDaysBefore: true,
        supplier: { select: { legalName: true } },
      },
    });

    let contractsExpired = 0;
    for (const contract of contracts) {
      const alertOn = contract.renewalDate ?? contract.endDate;
      if (alertOn && addDays(alertOn, -contract.alertDaysBefore) <= today) {
        const result = await notifyUsers(
          {
            userIds: finance,
            type: "CONTRACT_EXPIRING",
            severity: "WARNING",
            title: "Contrato próximo do vencimento",
            message: `${contract.supplier.legalName} · ${contract.object.slice(0, 120)}`,
            link: `/contratos/${contract.id}`,
            contractId: contract.id,
            dedupeKey: () => `contract:${contract.id}:EXPIRING:${todayKey}`,
          },
          tx,
        );
        notificationsCreated += result.count;
      }
      if (contract.endDate && contract.endDate < today && !contract.autoRenew) {
        await tx.contract.update({ where: { id: contract.id }, data: { status: "EXPIRED" } });
        contractsExpired += 1;
        const result = await notifyUsers(
          {
            userIds: finance,
            type: "CONTRACT_EXPIRED",
            severity: "CRITICAL",
            title: "Contrato vencido",
            message: `${contract.supplier.legalName} · ${contract.object.slice(0, 120)}`,
            link: `/contratos/${contract.id}`,
            contractId: contract.id,
            dedupeKey: () => `contract:${contract.id}:EXPIRED:${todayKey}`,
          },
          tx,
        );
        notificationsCreated += result.count;
      }
    }

    const quotes = await tx.quote.findMany({
      where: { status: "PENDING", validUntil: { lte: soonLimit } },
      select: { id: true, amount: true, validUntil: true, supplier: { select: { legalName: true } } },
    });
    for (const quote of quotes) {
      const result = await notifyUsers(
        {
          userIds: finance,
          type: "QUOTE_EXPIRING",
          severity: "WARNING",
          title: "Orçamento próximo da validade",
          message: `${quote.supplier.legalName} · ${formatBRL(quote.amount)} · válido até ${formatDate(quote.validUntil)}.`,
          link: `/orcamentos/${quote.id}`,
          quoteId: quote.id,
          dedupeKey: () => `quote:${quote.id}:EXPIRING:${todayKey}`,
        },
        tx,
      );
      notificationsCreated += result.count;
    }

    return {
      today: todayKey,
      billsMarkedOverdue: overdue.count,
      contractsExpired,
      notificationsCreated,
    };
  });
}
