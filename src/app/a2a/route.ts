import { handleSummary } from "../../lib/owned-agent/summary.ts";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) { return handleSummary(request); }
