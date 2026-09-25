import { randomUUID } from "node:crypto";
import { setTimeout as pause } from "node:timers/promises";
import { SendMessageRequest, GetTaskRequest, TaskState, Role } from "@a2a-js/sdk";
import { LegacyJsonRpcTransport } from "@a2a-js/sdk/compat/v0_3/client";
import { z } from "zod";
import { makeAgentFetch } from "../a2a/network.ts";
import { valueSchema, type GeneralStep, type Value } from "./contracts.ts";

export async function inspectGeneral(step: GeneralStep, fetcher = makeAgentFetch(), audioMime?: string) {
  const response = await fetcher(step.metadataUrl);
  if (!response.ok) throw new Error("Agent card unavailable");
  const card = z.object({ url: z.string().url(), protocolVersion: z.literal("0.3.0"),
    preferredTransport: z.literal("JSONRPC").optional(), security: z.array(z.unknown()).optional(),
    authentication: z.unknown().optional(), securitySchemes: z.record(z.string(), z.unknown()).optional(),
    defaultInputModes: z.array(z.string()), defaultOutputModes: z.array(z.string()),
    skills: z.array(z.object({ id: z.string(), inputModes: z.array(z.string()).optional(), outputModes: z.array(z.string()).optional() })),
  }).parse(await response.json());
  if (card.url !== step.endpoint || card.security?.length || card.authentication || Object.keys(card.securitySchemes ?? {}).length) throw new Error("Endpoint mismatch or unsupported authentication");
  const skill = card.skills.find((entry) => entry.id === step.skill);
  if (!skill) throw new Error("Selected skill is no longer advertised");
  const inputModes = skill.inputModes ?? card.defaultInputModes;
  const inputMode = step.format === 'audio' ? undefined : step.format === "text" ? "text/plain" : "application/json";
  if (inputMode ? !inputModes.includes(inputMode) : !inputModes.some(mode => ['audio/webm', 'audio/ogg', 'audio/wav', 'audio/mpeg', 'audio/mp4'].includes(mode))) throw new Error("Selected input format is not advertised");
  if (!(skill.outputModes ?? card.defaultOutputModes).some((mode) => ["text/plain", "application/json"].includes(mode))) throw new Error("Agent does not advertise supported text/JSON output");
  if (audioMime && !inputModes.includes(audioMime)) throw new Error('This agent does not accept the recorded audio format. Upload audio in an advertised format.');
}

export async function invokeGeneral(step: GeneralStep, input: Value, fetcher = makeAgentFetch()): Promise<Value> {
  await inspectGeneral(step, fetcher, input.type === 'audio' ? input.mimeType : undefined);
  const transport = new LegacyJsonRpcTransport({ endpoint: step.endpoint, fetchImpl: fetcher });
  const signal = AbortSignal.timeout(60000);
  let result = await transport.sendMessage(SendMessageRequest.fromJSON({ message: { messageId: randomUUID(), role: "ROLE_USER",
    parts: [input.type === 'audio' ? { raw: input.value, mediaType: input.mimeType, filename: 'source-audio' } : input.type === "text" ? { text: input.value } : { data: input.value, mediaType: "application/json" }],
  } }), { signal });
  while ("status" in result) {
    if (result.status?.state === TaskState.TASK_STATE_COMPLETED) break;
    if (![TaskState.TASK_STATE_WORKING, TaskState.TASK_STATE_SUBMITTED].includes(result.status!.state)) throw new Error("Agent requires input/authentication or task failed; no automatic retry");
    await pause(500, undefined, { signal });
    result = await transport.getTask(GetTaskRequest.fromJSON({ id: result.id }), { signal });
  }
  let parts = "parts" in result ? result.parts : result.artifacts.flatMap((artifact) => artifact.parts);
  if (!parts.length && "status" in result && result.status?.message?.role === Role.ROLE_AGENT) parts = result.status.message.parts;
  if (!parts.length) throw new Error("Agent returned no output parts in its message, artifacts, or agent-authored completion message. Do not retry automatically; the external task may have completed.");
  if (parts.some((part) => !["text", "data"].includes(part.content?.$case ?? ""))) throw new Error("Agent returned file or unsupported output parts; this workflow supports only text or JSON objects.");
  if (parts.length === 1 && parts[0].content?.$case === "data") return valueSchema.parse({ type: "json", value: parts[0].content.value });
  if (parts.some((part) => part.content?.$case !== "text")) throw new Error("Mixed text/data output requires a dedicated adapter");
  return valueSchema.parse({ type: "text", value: parts.map((part) => part.content?.$case === "text" ? part.content.value : "").join("\n") });
}
