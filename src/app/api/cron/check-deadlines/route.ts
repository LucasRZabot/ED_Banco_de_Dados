import { runCheckDeadlines } from "@/server/jobs/check-deadlines";
import { env } from "@/lib/env";
import { log } from "@/lib/log";
import { bearerMatches } from "@/lib/timing-safe";

async function handle(request: Request) {
  if (!bearerMatches(request.headers.get("authorization"), env().CRON_SECRET)) {
    log.warn("cron.unauthorized");
    return Response.json({ error: "Não autorizado." }, { status: 401 });
  }
  const result = await runCheckDeadlines();
  log.info("cron.check-deadlines", result);
  return Response.json(result);
}

export function GET(request: Request) {
  return handle(request);
}

export function POST(request: Request) {
  return handle(request);
}
