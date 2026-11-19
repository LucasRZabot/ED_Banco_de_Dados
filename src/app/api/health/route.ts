import { getHealthSnapshot } from "@/lib/health";

export async function GET(request: Request) {
  const deep = new URL(request.url).searchParams.get("deep") === "1";
  const snap = await getHealthSnapshot({ deep });
  return Response.json(snap, {
    status: snap.ok ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
