export interface DiscoveredAgent {
  ansId: string;
  name: string;
  description: string | null;
  ansName: string;
  endpoint: string;
  metadataUrl?: string;
  transports: string[];
  discoveredAt: string;
  identityStatus: "not-verified";
  skills?: { id: string; name: string; tags: string[] }[];
}

export function discoveryAuthorization(): string | undefined {
  return process.env.ANS_AUTHENTICATED_DISCOVERY === "true" ? process.env.ANS_AUTHORIZATION : undefined;
}

export async function resolveAgent(id: string): Promise<DiscoveredAgent[]> {
  const base = new URL(process.env.ANS_BASE_URL ?? "https://api.godaddy.com");
  if (base.protocol !== "https:" || base.username || base.password) throw new Error("Invalid ANS base URL");
  const headers: Record<string, string> = { Accept: "application/json" };
  const authorization = discoveryAuthorization();
  if (authorization) headers.Authorization = authorization;
  const response = await fetch(new URL(`/v1/ans/registered-agents/${encodeURIComponent(id)}`, base), { headers, redirect: "error", signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`ANS resolution failed (HTTP ${response.status})`);
  return normalizeAgents({ items: [await response.json()] });
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("ANS returned an invalid record");
  }
  return value as Record<string, unknown>;
}

function requiredString(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("ANS returned a missing or invalid string");
  }
  return value;
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function httpsUrl(value: unknown): string {
  const url = new URL(requiredString(value));
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error("ANS returned an unsupported endpoint URL");
  }
  return url.href;
}

export function normalizeAgents(payload: unknown): DiscoveredAgent[] {
  const envelope = record(payload);
  if (!Array.isArray(envelope.items)) throw new Error("ANS response is missing items");
  const discoveredAt = new Date().toISOString();
  return envelope.items.flatMap((item) => {
    const agent = record(item);
    if (record(agent.lifecycle).status !== "ACTIVE") return [];
    if (!Array.isArray(agent.endpoints)) throw new Error("ANS agent is missing endpoints");
    return agent.endpoints.flatMap((item) => {
      const endpoint = record(item);
      if (endpoint.protocol !== "A2A") return [];
      if (!Array.isArray(endpoint.transports) || !endpoint.transports.every((value) => typeof value === "string")) {
        throw new Error("ANS endpoint has invalid transports");
      }
      return [{
        ansId: requiredString(agent.agentId),
        name: requiredString(agent.agentDisplayName),
        description: optionalString(agent.agentDescription),
        ansName: requiredString(agent.ansName),
        endpoint: httpsUrl(endpoint.agentUrl),
        metadataUrl: endpoint.metaDataUrl ? httpsUrl(endpoint.metaDataUrl) : undefined,
        transports: endpoint.transports as string[],
        discoveredAt,
        identityStatus: "not-verified" as const,
        skills: Array.isArray(endpoint.functions) ? endpoint.functions.flatMap((item) => {
          const skill = record(item);
          if (typeof skill.id !== "string" || typeof skill.name !== "string") return [];
          return [{ id: skill.id, name: skill.name, tags: Array.isArray(skill.tags) ? skill.tags.filter((tag): tag is string => typeof tag === "string") : [] }];
        }) : [],
      }];
    });
  });
}

export async function discoverAgents(options: {
  query: string;
  baseUrl?: string;
  authorization?: string;
  fetcher?: typeof fetch;
  pageToken?: string;
}): Promise<{ agents: DiscoveredAgent[]; hasMore: boolean; nextPageToken?: string; skippedRecords: number }> {
  if (options.query.length > 256) throw new Error("Search query must be at most 256 characters");
  const base = new URL(options.baseUrl ?? "https://api.godaddy.com");
  if (base.protocol !== "https:" || base.username || base.password || base.pathname !== "/" || base.search || base.hash) {
    throw new Error("ANS base URL must be an HTTPS origin without credentials");
  }
  const url = new URL("/v1/ans/registered-agents", base);
  const params = new URLSearchParams({ query: options.query, protocols: "A2A", statuses: "ACTIVE", pageSize: "20" });
  if (options.pageToken) {
    params.set("pageToken", options.pageToken);
    params.set("pageTokenDirection", "forward");
  }
  url.search = params.toString();
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.authorization) headers.Authorization = options.authorization;
  const response = await (options.fetcher ?? fetch)(url, {
    headers,
    redirect: "error",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`ANS discovery failed (HTTP ${response.status})`);
  const payload = record(await response.json());
  if (!Array.isArray(payload.items)) throw new Error("ANS response is missing items");
  let skippedRecords = 0;
  const agents = payload.items.flatMap((item) => {
    try {
      return normalizeAgents({ items: [item] });
    } catch {
      skippedRecords += 1;
      return [];
    }
  });
  const nextLink = Array.isArray(payload.links) ? payload.links.find((link) => record(link).rel === "next") : undefined;
  let nextPageToken: string | undefined;
  const nextHref = nextLink ? record(nextLink).href : undefined;
  if (typeof nextHref === "string") {
    try {
      nextPageToken = new URL(nextHref).searchParams.get("pageToken") ?? undefined;
    } catch {
      // Malformed pagination link; treat as no further pages available via token.
    }
  }
  return {
    agents,
    skippedRecords,
    hasMore: Boolean(nextLink),
    nextPageToken,
  };
}
