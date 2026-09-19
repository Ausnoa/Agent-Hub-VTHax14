import { hostedCard, hostedTarget } from "../../../lib/owned-agent/hosted.ts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  try {
    const target = hostedTarget(request);
    if (target) return Response.json(hostedCard(target.kind, target.origin), { headers: { "Cache-Control": "no-store" } });
  } catch { /* Fail closed for invalid configuration. */ }
  return Response.json({ error: "No agent is configured for this host" }, { status: 503 });
}
