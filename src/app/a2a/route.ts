import { handleHosted, hostedTarget } from "../../lib/owned-agent/hosted.ts";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    const target = hostedTarget(request);
    if (target) return handleHosted(request, target.kind);
  } catch { /* Fail closed for invalid configuration. */ }
  return Response.json({ error: "No agent is configured for this host" }, { status: 503 });
}
