import { z } from "zod";
import { planSchema, type Plan } from "../contracts/index.ts";

export async function planDescription(description: string): Promise<Plan> {
  return structuredPlan(description, "Plan a sequential company-research workflow. Supported capabilities in order are company-research, risk-analysis, summarization. Choose only necessary steps. Research must be first. Never choose agents or URLs. Put any unsupported requested capabilities in unsupported. For an entirely unsupported request return an empty capabilities list. Do not invent research or claim execution.", planSchema);
}

export async function structuredPlan<Schema extends z.ZodType>(input: string, instructions: string, schema: Schema): Promise<z.output<Schema>> {
  if (!process.env.OPENAI_API_KEY || !process.env.OPENAI_MODEL) throw new Error("Live planning needs OPENAI_API_KEY and OPENAI_MODEL. Use the labeled local demo to test the workflow.");
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model: process.env.OPENAI_MODEL, store: false,
      instructions, input,
      text: { format: { type: "json_schema", name: "workflow_plan", strict: true, schema: z.toJSONSchema(schema) } },
    }), signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) throw new Error(`Planner request failed (HTTP ${response.status})`);
  const payload = await response.json();
  if (payload.status !== "completed") throw new Error("Planner did not complete; try again");
  const output = payload.output?.flatMap((item: { content?: { type: string; text?: string }[] }) => item.content ?? []).find((item: { type: string }) => item.type === "output_text")?.text;
  if (typeof output !== "string") throw new Error("Planner returned no usable plan");
  return schema.parse(JSON.parse(output));
}
