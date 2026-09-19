import type { AnsSkill, DiscoveredAgent } from "./client.ts";

export interface RankedAgent {
  agent: DiscoveredAgent;
  /** Best-matching ANS skill; the reason the agent ranked where it did. */
  skill: AnsSkill;
  /** Fraction of the wanted capability's words found in that skill (0–1]. */
  coverage: number;
  score: number;
}

// Where a word matched. Skill id and name describe what the skill does;
// tags are looser labels, so they count for less.
const FIELD_WEIGHT = { id: 3, name: 2, tag: 1 } as const;

function words(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 1);
}

// Crude suffix stemming so "summarize" ~ "summarization" ~ "summary", "analysis" ~ "analyze",
// "risk" ~ "risks". Shared prefixes are not enough: "company" and "comparison" share "compa".
const SUFFIXES = ["ization", "isation", "ation", "ition", "ings", "ing", "izes", "ize", "ise", "ysis", "yze", "yse", "ers", "er", "ies", "es", "s", "y", "e"];

function stem(word: string): string {
  for (const suffix of SUFFIXES) {
    if (word.endsWith(suffix) && word.length - suffix.length >= 3) return word.slice(0, -suffix.length);
  }
  return word;
}

function sameWord(a: string, b: string): boolean {
  return a === b || stem(a) === stem(b);
}

function scoreSkill(wanted: string[], skill: AnsSkill): { coverage: number; score: number } {
  const fields: [keyof typeof FIELD_WEIGHT, string[]][] = [
    ["id", words(skill.id)],
    ["name", words(skill.name)],
    ["tag", skill.tags.flatMap(words)],
  ];
  let matched = 0;
  let score = 0;
  for (const word of wanted) {
    const best = Math.max(0, ...fields.filter(([, found]) => found.some((candidate) => sameWord(word, candidate))).map(([field]) => FIELD_WEIGHT[field]));
    if (best) {
      matched += 1;
      score += best;
    }
  }
  return { coverage: matched / wanted.length, score };
}

/**
 * Ranks agents by how well their ANS-reported skills match a capability such as
 * "company-research". The agent's display name and description are ignored: registry
 * names like "Sum Fish Marketing Customer Support Agent" match text search but not skills.
 * Agents with no matching skill are dropped. Ties break on ANS trust score.
 */
export function rankBySkill(agents: DiscoveredAgent[], capability: string): RankedAgent[] {
  const wanted = [...new Set(words(capability))];
  if (!wanted.length) return [];
  return agents
    .flatMap((agent) => {
      let best: RankedAgent | undefined;
      for (const skill of agent.skills ?? []) {
        const { coverage, score } = scoreSkill(wanted, skill);
        if (coverage && (!best || coverage > best.coverage || (coverage === best.coverage && score > best.score))) {
          best = { agent, skill, coverage, score };
        }
      }
      return best ? [best] : [];
    })
    .sort((a, b) => b.coverage - a.coverage || b.score - a.score || (b.agent.trustScore ?? 0) - (a.agent.trustScore ?? 0));
}
