import { z } from "zod";
import { planSchema, type Plan } from "../contracts/index.ts";

export class ModelServiceError extends Error {
  code: 'timeout' | 'connection-failed' | 'not-configured' | 'incomplete' | 'output-limit' | 'invalid-output';
  constructor(code: ModelServiceError['code']) { super(`Model generation unavailable (${code}).`); this.code=code; }
}
export class ModelProviderError extends Error {
  status: number;
  constructor(status: number) { super(`Model provider request failed (HTTP ${status}). Check the deployment's model configuration and provider account.`); this.status = status; }
}

export async function planDescription(description: string): Promise<Plan> {
  return structuredPlan(description, "Plan a sequential company-research workflow. Supported capabilities in order are company-research, risk-analysis, summarization. Choose only necessary steps. Research must be first. Never choose agents or URLs. Put any unsupported requested capabilities in unsupported. For an entirely unsupported request return an empty capabilities list. Do not invent research or claim execution.", planSchema);
}

export async function structuredPlan<Schema extends z.ZodType>(input: string, instructions: string, schema: Schema, options: { maxOutputTokens?: number } = {}): Promise<z.output<Schema>> {
  if (!process.env.OPENAI_API_KEY || !process.env.OPENAI_MODEL) throw new ModelServiceError("not-configured");
  let response: Response;
  try { response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model: process.env.OPENAI_MODEL, store: false,
      instructions, input, ...(options.maxOutputTokens ? { max_output_tokens: options.maxOutputTokens } : {}),
      text: { format: { type: "json_schema", name: "workflow_plan", strict: true, schema: z.toJSONSchema(schema) } },
    }), signal: AbortSignal.timeout(45_000),
  });
  } catch (error) {
    throw new ModelServiceError(error instanceof Error && error.name === 'TimeoutError' ? 'timeout' : 'connection-failed');
  }
  if (!response.ok) {
    // Status is safe for diagnostics; never log the provider body, key, or user input.
    console.error(`[model-provider] HTTP ${response.status}`);
    throw new ModelProviderError(response.status);
  }
  const payload = await response.json();
  if (payload.status !== "completed") throw new ModelServiceError(payload.incomplete_details?.reason === "max_output_tokens" ? "output-limit" : "incomplete");
  const output = payload.output?.flatMap((item: { content?: { type: string; text?: string }[] }) => item.content ?? []).find((item: { type: string }) => item.type === "output_text")?.text;
  if (typeof output !== "string") throw new ModelServiceError("invalid-output");
  try { return schema.parse(JSON.parse(output)); } catch { throw new ModelServiceError("invalid-output"); }
}
