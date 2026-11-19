import { runCheckDeadlines } from "@/server/jobs/check-deadlines";
import { env } from "@/lib/env";
import { bearerMatches } from "@/lib/timing-safe";

export const dynamic = "force-dynamic";

async function handle(request: Request) {
  if (!bearerMatches(request.headers.get("authorization"), env().CRON_SECRET)) {
    return Response.json({ error: "Não autorizado." }, { status: 401 });
  }
  const result = await runCheckDeadlines();
  return Response.json(result);
}

export function GET(request: Request) {
  return handle(request);
}

export function POST(request: Request) {
  return handle(request);
}
