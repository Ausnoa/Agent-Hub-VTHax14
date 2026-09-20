import { randomUUID } from "node:crypto";
import { z } from "zod";
import { ModelProviderError, ModelServiceError } from "../planner/index.ts";

const envelope = z.object({ jsonrpc: z.literal("2.0"), id: z.union([z.string().max(200), z.number().finite()]), method: z.string() });
const paramsSchema = z.object({ message: z.object({ kind: z.literal("message").optional(), role: z.literal("user"), messageId: z.string().min(1).max(200),
  parts: z.array(z.object({ kind: z.literal("text"), text: z.string().min(1).max(12000) })).min(1).max(16),
  taskId: z.never().optional(), contextId: z.never().optional(),
}), configuration: z.object({ acceptedOutputModes: z.array(z.string()).optional() }).optional() });
function reply(value: unknown, status = 200) { return Response.json(value, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } }); }
function error(id: string | number | null, code: number, message: string, status = 200) { return reply({ jsonrpc: "2.0", id, error: { code, message } }, status); }

export class InputError extends Error {}

export async function handleTextAgent(request: Request, generate: (text: string) => Promise<string>, options: { enabled?: boolean; failure?: string } = {}) {
  if (!(options.enabled ?? process.env.AGENT_ENABLED === "true")) return error(null, -32000, "Agent is not enabled", 503);
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") return error(null, -32600, "Use application/json", 415);
  let raw: unknown;
  const reader = request.body?.getReader();
  if (!reader) return error(null, -32700, "JSON body required");
  try {
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > 32000) { await reader.cancel(); return error(null, -32600, "Request exceeds 32 KB", 413); }
      chunks.push(value);
    }
    raw = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch { return error(null, -32700, "Invalid JSON"); }
  finally { reader.releaseLock(); }
  const rpc = envelope.safeParse(raw);
  if (!rpc.success) return error(null, -32600, "Expected a JSON-RPC request with an id");
  const { id, method } = rpc.data;
  if (method !== "message/send") return error(id, -32601, "Only message/send is supported");
  const params = paramsSchema.safeParse((raw as Record<string, unknown>).params);
  if (!params.success) return error(id, -32602, "Send a new user message containing only text parts");
  const modes = params.data.configuration?.acceptedOutputModes;
  if (modes?.length && !modes.includes("text/plain")) return error(id, -32005, "Only text/plain output is supported");
  const text = params.data.message.parts.map(part => part.text).join("\n\n").trim();
  if (!text || text.length > 12000) return error(id, -32602, "Supply 1–12000 characters of text");
  try {
    const output = await generate(text);
    return reply({ jsonrpc: "2.0", id, result: { kind: "message", role: "agent", messageId: randomUUID(), parts: [{ kind: "text", text: output }] } });
  } catch (reason) {
    if (reason instanceof InputError) return error(id, -32602, reason.message);
    if (reason instanceof ModelServiceError) return error(id, -32603, reason.message);
    if (reason instanceof ModelProviderError) return error(id, -32603, `Agent generation unavailable (model provider HTTP ${reason.status}).`);
    return error(id, -32603, options.failure ?? "Agent generation failed; no result was produced");
  }
}
