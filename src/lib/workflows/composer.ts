import { randomUUID } from "node:crypto";
import { capabilities, type Proposal, type SelectedAgent, type Plan } from "../contracts/index.ts";
import { planDescription } from "../planner/index.ts";
import { inspectAgent } from "../a2a/client.ts";
import { SqliteAgentCatalog, type AgentCatalog } from "../gateways/catalog.ts";
import { developmentAgents } from "../gateways/development-agents.ts";
import { RegistryAgentCatalog } from "../gateways/registry-catalog.ts";

export const localSteps = developmentAgents;

export function validatePlan(plan: Plan): string[] {
  const blockers = plan.unsupported.map((capability) => `Unsupported capability: ${capability}`);
  if (!plan.capabilities.length) blockers.push("No supported capabilities were requested");
  if (plan.capabilities[0] !== "company-research") blockers.push("The supported report adapter requires company research first");
  const indices = plan.capabilities.map((capability) => capabilities.indexOf(capability));
  if (indices.some((index, position) => position > 0 && index <= indices[position - 1])) blockers.push("Capabilities must be unique and in dependency order");
  return blockers;
}

export async function compose(description: string, mode: "live" | "demo" | "pilot", dependencies: {
  catalog?: AgentCatalog; planner?: typeof planDescription; inspect?: typeof inspectAgent;
} = {}): Promise<Proposal> {
  const plan = mode === "demo" ? { name: "Company briefing", description: "Organize supplied notes, flag risk signals, and produce a concise briefing.", capabilities: [...capabilities], unsupported: [] } : await (dependencies.planner ?? planDescription)(description);
  const proposal: Proposal = { id: randomUUID(), createdAt: new Date().toISOString(), originalPrompt: description, mode, planner: mode === "demo" ? "demo-template" : "llm", plan, steps: [], blockers: validatePlan(plan) };
  if (mode === "demo") { proposal.steps = localSteps(); return proposal; }
  if (proposal.blockers.length) return proposal;
  const ownedCatalog = dependencies.catalog ? undefined : mode === "live" ? new RegistryAgentCatalog() : new SqliteAgentCatalog();
  const catalog = dependencies.catalog ?? ownedCatalog!;
  try {
    for (const capability of plan.capabilities) {
      const candidates = await catalog.candidates(capability, mode === "pilot" ? "local-fixture" : "ans");
      let selected: SelectedAgent | undefined;
      for (const candidate of candidates) {
        if (candidate.source !== (mode === "pilot" ? "local-fixture" : "ans") || candidate.capability !== capability) continue;
        try {
          const card = await (dependencies.inspect ?? inspectAgent)(candidate);
          if (card.skills.some((skill) => skill.id === capability)) { selected = candidate; break; }
        } catch { continue; }
      }
      if (selected) proposal.steps.push(selected);
      else proposal.blockers.push(mode === "pilot"
        ? `No running pilot agent for ${capability}. Start the local agent services and build again.`
        : `No fresh, configured, reachable registry match for ${capability}. Sync the main registry and configure a tested report adapter. Workflows are saved only on this site; ANS registration is not required.`);
    }
    return proposal;
  } finally { ownedCatalog?.close(); }
}
