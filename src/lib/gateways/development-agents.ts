import { capabilities, type SelectedAgent } from "../contracts/index.ts";

export function developmentAgents(): SelectedAgent[] {
  return capabilities.map((capability, index) => ({
    ansId: `fixture:${capability}`,
    name: ["Notes researcher", "Risk signal analyst", "Executive summarizer"][index],
    endpoint: `http://127.0.0.1:${4311 + index}/a2a`,
    metadataUrl: `http://127.0.0.1:${4311 + index}/.well-known/agent-card.json`,
    capability, source: "local-fixture", identityStatus: "not-verified", protocolVersion: "0.3.0",
  }));
}
