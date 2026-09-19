import { randomUUID } from "node:crypto";
import { z } from "zod";
import { capabilities, type Capability, type Proposal, type SelectedAgent, type Plan } from "../contracts/index.ts";
import { planDescription } from "../planner/index.ts";
import { discoverAgents } from "../ans/client.ts";
import { inspectAgent } from "../a2a/client.ts";

export function localSteps(): SelectedAgent[] {
  return capabilities.map((capability, index) => ({ ansId: `fixture:${capability}`, name: ["Notes researcher", "Risk signal analyst", "Executive summarizer"][index], endpoint: `http://127.0.0.1:${4311 + index}/a2a`, metadataUrl: `http://127.0.0.1:${4311 + index}/.well-known/agent-card.json`, capability, source: "local-fixture", identityStatus: "not-verified", protocolVersion: "0.3.0" }));
}

export function validatePlan(plan: Plan): string[] {
  const blockers = plan.unsupported.map((capability) => `Unsupported capability: ${capability}`);
  if (!plan.capabilities.length) blockers.push("No supported capabilities were requested");
  if (plan.capabilities[0] !== "company-research") blockers.push("The supported report adapter requires company research first");
  const indices = plan.capabilities.map((capability) => capabilities.indexOf(capability));
  if (indices.some((index, position) => position > 0 && index <= indices[position - 1])) blockers.push("Capabilities must be unique and in dependency order");
  return blockers;
}

export async function compose(description: string, mode: "live" | "demo"): Promise<Proposal> {
  const plan = mode === "demo" ? { name: "Company briefing", description: "Organize supplied notes, flag risk signals, and produce a concise briefing.", capabilities: [...capabilities], unsupported: [] } : await planDescription(description);
  const proposal: Proposal = { id: randomUUID(), createdAt: new Date().toISOString(), originalPrompt: description, mode, planner: mode === "demo" ? "demo-template" : "llm", plan, steps: [], blockers: validatePlan(plan) };
  if (mode === "demo") { proposal.steps = localSteps(); return proposal; }
  if (proposal.blockers.length) return proposal;
  const allowlist = z.record(z.string(), z.array(z.string())).parse(JSON.parse(process.env.COMPATIBLE_AGENTS_JSON ?? "{}"));
  for (const capability of plan.capabilities) {
    const found = await discoverAgents({ query: capability.replaceAll("-", " "), baseUrl: process.env.ANS_BASE_URL, authorization: process.env.ANS_AUTHORIZATION });
    const candidates = found.agents.filter((agent) => allowlist[capability]?.includes(agent.ansId) && agent.metadataUrl);
    let selected: SelectedAgent | undefined;
    for (const candidate of candidates) {
      const step: SelectedAgent = { ansId: candidate.ansId, name: candidate.name, endpoint: candidate.endpoint, metadataUrl: candidate.metadataUrl!, capability: capability as Capability, source: "ans", identityStatus: "not-verified", protocolVersion: "0.3.0" };
      try { const card = await inspectAgent(step); if (card.skills.some((skill) => skill.id === capability)) { selected = step; break; } } catch { continue; }
    }
    if (selected) proposal.steps.push(selected);
    else proposal.blockers.push(`No tested, reachable adapter match for ${capability} among this page of ANS results${found.hasMore ? "; additional pages exist" : ""}.`);
  }
  return proposal;
}
