import { z } from "zod";
export const templates = [
  { id: "summary", name: "Summarizer", skill: "summarize-text", description: "A brief, key points, and explicitly stated action items.", example: "Maya will send the draft Friday. Leo will review it Monday. The launch date is undecided." },
  { id: "extract", name: "Information extractor", skill: "extract-information", description: "Extract your chosen fields. Missing details stay unknown.", example: "Invoice INV-104 from Acme Studio is for $250. Payment is due October 1." },
  { id: "qa", name: "Document Q&A", skill: "answer-from-reference", description: "Answer questions from reference text you provide.", example: "What is the return window?" },
] as const;
export const definitionSchema = z.object({
  name: z.string().trim().min(1).max(64), template: z.enum(["summary", "extract", "qa"]),
  instructions: z.string().trim().max(2000),
  fields: z.array(z.string().trim().min(1).max(60)).max(12),
  reference: z.string().trim().max(12000),
}).superRefine((value, ctx) => {
  if (value.template === "extract" && (!value.fields.length || new Set(value.fields.map(f=>f.toLowerCase())).size !== value.fields.length)) ctx.addIssue({ code:"custom", message:"Provide 1–12 distinct field names", path:["fields"] });
  if (value.template === "qa" && !value.reference) ctx.addIssue({ code:"custom", message:"Reference text is required for document Q&A", path:["reference"] });
});
export type Definition = z.infer<typeof definitionSchema>;
export type OwnedAgent = Definition & { id: string; createdAt: string; visibility: "public" | "private"; ownerId: string };
export const templateFor = (id: Definition["template"]) => templates.find(t => t.id === id)!;
