import { agentCard } from "../../../lib/owned-agent/summary.ts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET() {
  try { return Response.json(agentCard(), { headers: { "Cache-Control": "no-store" } }); }
  catch { return Response.json({ error: "Agent public origin is not configured" }, { status: 503 }); }
}
