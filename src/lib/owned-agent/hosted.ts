import { agentCard, handleSummary } from "./summary.ts";
import { definitionSchema, type Definition } from "./templates.ts";
import { runDefinition } from "./run.ts";
import { handleTextAgent, InputError } from "./transport.ts";

export type HostedKind = "summary" | "extract" | "qa";
type Origins = Partial<Record<HostedKind, string>>;
export const hostedAgents = {
  summary: { name: "Glorria Brief", skill: "summarize-text" },
  extract: { name: "Glorria Extract", skill: "extract-information" },
  qa: { name: "Glorria Answers", skill: "answer-from-reference" },
} as const;
export function configuredOrigins(): Origins {
  return { summary: process.env.AGENT_PUBLIC_ORIGIN, extract: process.env.EXTRACT_AGENT_PUBLIC_ORIGIN, qa: process.env.QA_AGENT_PUBLIC_ORIGIN };
}
export function hostedTarget(request: Request, origins = configuredOrigins()): { kind: HostedKind; origin: string } | undefined {
  const host = (request.headers.get("host") ?? new URL(request.url).host).toLowerCase();
  const matches = Object.entries(origins).filter(([, origin]) => origin && new URL(origin).host.toLowerCase() === host);
  if (matches.length !== 1) return undefined;
  const [kind, origin] = matches[0];
  // Reuse canonical origin validation; client headers never become card URLs.
  agentCard(origin);
  return { kind: kind as HostedKind, origin: origin! };
}
export function hostedCard(kind: HostedKind, origin: string) {
  const card = agentCard(origin);
  if (kind === "summary") return card;
  const spec = hostedAgents[kind];
  const description = kind === "extract"
    ? "Extract literal source values for requested fields; missing values are null. Send Fields: owner, deadline followed by a newline, Source: and the source text. Plain text defaults to owner, deadline, decision."
    : "Answer only from supplied reference text, with literal evidence. Send Question: your question followed by a newline, Reference: and the reference text. Missing information stays unknown.";
  return { ...card, name: spec.name, description, skills: [{ id: spec.skill, name: spec.name, description,
    tags: kind === "extract" ? ["extraction", "text", "fields"] : ["question-answering", "reference", "documents"],
    examples: [kind === "extract" ? "Fields: owner, deadline\nSource:\nMaya will send the draft Friday." : "Question: Who owns the draft?\nReference:\nMaya will send the draft Friday."] }] };
}
export function parseHostedInput(kind: Exclude<HostedKind, "summary">, text: string): { definition: Definition; source: string } {
  let fields = ["owner", "deadline", "decision"], source = text, reference = "";
  if (kind === "extract" && /^Fields:/i.test(text)) {
    const parts = /^Fields:[ \t]*([^\r\n]+)\r?\nSource:[ \t]*\r?\n?([\s\S]+)$/i.exec(text);
    if (!parts) throw new InputError("Use Fields: name, name followed by a newline, Source: and source text");
    fields = parts[1].split(",").map(value => value.trim()); source = parts[2].trim();
  }
  if (kind === "qa") {
    const parts = /^Question:[ \t]*([\s\S]+?)\r?\nReference:[ \t]*\r?\n?([\s\S]+)$/i.exec(text);
    if (!parts) throw new InputError("Use Question: your question followed by a newline, Reference: and reference text");
    source = parts[1].trim(); reference = parts[2].trim(); fields = [];
  }
  const definition = definitionSchema.safeParse({ name: hostedAgents[kind].name, template: kind, instructions: "", fields, reference });
  if (!definition.success || !source || source.length > 12000) throw new InputError("Supply nonempty source/reference and 1–12 distinct field names where applicable");
  return { definition: definition.data, source };
}
export async function handleHosted(request: Request, kind: HostedKind, options: { enabled?: boolean; run?: typeof runDefinition } = {}) {
  if (kind === "summary") return handleSummary(request, { enabled: options.enabled });
  return handleTextAgent(request, async text => {
    const { definition, source } = parseHostedInput(kind, text);
    return (options.run ?? runDefinition)(definition, source);
  }, { enabled: options.enabled });
}
