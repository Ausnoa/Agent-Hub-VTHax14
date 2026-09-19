import { randomUUID } from "node:crypto";
import { setTimeout as pause } from "node:timers/promises";
import { SendMessageRequest, GetTaskRequest, TaskState, type SendMessageResult } from "@a2a-js/sdk";
import { LegacyJsonRpcTransport } from "@a2a-js/sdk/compat/v0_3/client";
import { z } from "zod";
import { makeAgentFetch } from "./network.ts";
import { reportSchema, type SelectedAgent, type WorkflowState } from "../contracts/index.ts";

const cardSchema = z.object({
  name: z.string(), url: z.string().url(), protocolVersion: z.literal("0.3.0"),
  preferredTransport: z.enum(["JSONRPC"]).optional(),
  skills: z.array(z.object({ id: z.string(), name: z.string(), description: z.string().optional() })),
  security: z.array(z.unknown()).optional(),
});

export async function inspectAgent(agent: Pick<SelectedAgent, "metadataUrl" | "endpoint" | "source">) {
  const fetcher = makeAgentFetch(agent.source === "local-fixture");
  const response = await fetcher(agent.metadataUrl);
  if (!response.ok) throw new Error(`Agent card unavailable (HTTP ${response.status})`);
  const card = cardSchema.parse(await response.json());
  if (new URL(card.url).href !== new URL(agent.endpoint).href) throw new Error("Agent card endpoint differs from discovery; review required");
  if (card.security?.length) throw new Error("Agent requires authentication; no adapter is configured");
  return card;
}

function outputParts(result: SendMessageResult) {
  if ("parts" in result) return result.parts;
  return result.artifacts.flatMap((artifact) => artifact.parts);
}

export async function invokeAgent(agent: SelectedAgent, state: WorkflowState) {
  const card = await inspectAgent(agent);
  if (!card.skills.some((skill) => skill.id === agent.capability)) throw new Error("Agent no longer advertises the approved capability");
  const transport = new LegacyJsonRpcTransport({ endpoint: agent.endpoint, fetchImpl: makeAgentFetch(agent.source === "local-fixture") });
  const signal = AbortSignal.timeout(60_000);
  let result = await transport.sendMessage(SendMessageRequest.fromJSON({
    message: { messageId: randomUUID(), role: "ROLE_USER",
      parts: [{ data: state, mediaType: "application/json" }],
    },
  }), { signal });
  while ("status" in result) {
    const status = result.status?.state;
    if (status === TaskState.TASK_STATE_COMPLETED) break;
    if (status !== TaskState.TASK_STATE_WORKING && status !== TaskState.TASK_STATE_SUBMITTED) throw new Error("A2A task failed or requires additional input/authentication");
    await pause(400, undefined, { signal });
    result = await transport.getTask(GetTaskRequest.fromJSON({ id: result.id }), { signal });
  }
  const parts = outputParts(result);
  const data = parts.find((part) => part.content?.$case === "data");
  if (!data || data.content?.$case !== "data") throw new Error("Agent did not return the supported report data contract");
  const report = reportSchema.parse(data.content.value);
  if (report.company !== state.originalInput.company) throw new Error("Agent output company does not match the request");
  return report;
}
