import { randomUUID } from "node:crypto";
import { setTimeout as pause } from "node:timers/promises";
import { SendMessageRequest, GetTaskRequest, TaskState } from "@a2a-js/sdk";
import { LegacyJsonRpcTransport } from "@a2a-js/sdk/compat/v0_3/client";
import { z } from "zod";
import { makeAgentFetch } from "../a2a/network.ts";
import { valueSchema, type GeneralStep, type Value } from "./contracts.ts";

export async function inspectGeneral(step: GeneralStep, fetcher = makeAgentFetch()) {
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
  const inputMode = step.format === "text" ? "text/plain" : "application/json";
  if (!(skill.inputModes ?? card.defaultInputModes).includes(inputMode)) throw new Error("Selected input format is not advertised");
  if (!(skill.outputModes ?? card.defaultOutputModes).some((mode) => ["text/plain", "application/json"].includes(mode))) throw new Error("Agent does not advertise supported text/JSON output");
}

export async function invokeGeneral(step: GeneralStep, input: Value, fetcher = makeAgentFetch()): Promise<Value> {
  await inspectGeneral(step, fetcher);
  const transport = new LegacyJsonRpcTransport({ endpoint: step.endpoint, fetchImpl: fetcher });
  const signal = AbortSignal.timeout(60000);
  let result = await transport.sendMessage(SendMessageRequest.fromJSON({ message: { messageId: randomUUID(), role: "ROLE_USER",
    parts: [input.type === "text" ? { text: input.value } : { data: input.value, mediaType: "application/json" }],
  } }), { signal });
  while ("status" in result) {
    if (result.status?.state === TaskState.TASK_STATE_COMPLETED) break;
    if (![TaskState.TASK_STATE_WORKING, TaskState.TASK_STATE_SUBMITTED].includes(result.status!.state)) throw new Error("Agent requires input/authentication or task failed; no automatic retry");
    await pause(500, undefined, { signal });
    result = await transport.getTask(GetTaskRequest.fromJSON({ id: result.id }), { signal });
  }
  const parts = "parts" in result ? result.parts : result.artifacts.flatMap((artifact) => artifact.parts);
  if (!parts.length || parts.some((part) => !["text", "data"].includes(part.content?.$case ?? ""))) throw new Error("Unsupported or empty output; files are not supported");
  if (parts.length === 1 && parts[0].content?.$case === "data") return valueSchema.parse({ type: "json", value: parts[0].content.value });
  if (parts.some((part) => part.content?.$case !== "text")) throw new Error("Mixed text/data output requires a dedicated adapter");
  return valueSchema.parse({ type: "text", value: parts.map((part) => part.content?.$case === "text" ? part.content.value : "").join("\n") });
}
