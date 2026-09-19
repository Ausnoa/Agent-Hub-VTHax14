export interface AnsSkill { id: string; name: string; tags: string[] }

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
  skills?: AnsSkill[];
  trustScore?: number | null;
}

export function discoveryAuthorization(): string | undefined {
  return process.env.ANS_AUTHENTICATED_DISCOVERY === "true" ? process.env.ANS_AUTHORIZATION : undefined;
}

export interface RegistryFunction { id: string; name: string | null; tags: string[] }

export interface RegistryEndpoint {
  protocol: string;
  url: string;
  metadataUrl: string | null;
  documentationUrl: string | null;
  transports: string[];
  functions: RegistryFunction[];
}

/** One ANS registration as returned by the registry, validated and normalized but otherwise complete. */
export interface RegistryRecord {
  agentId: string;
  ansName: string;
  host: string;
  version: string | null;
  providerId: string | null;
  displayName: string;
  description: string | null;
  status: string;
  expiresAt: string | null;
  trustScore: number | null;
  logId: string | null;
  leafIndex: number | null;
  indexedAt: string | null;
  endpoints: RegistryEndpoint[];
  raw: unknown;
}

export interface RegistryPage {
  items: unknown[];
  hasMore: boolean;
  nextPageToken?: string;
  rateLimit: { remaining: number | null; resetSeconds: number | null };
}

export class AnsHttpError extends Error {
  status: number;
  resetSeconds: number | null;
  constructor(message: string, status: number, resetSeconds: number | null) {
    super(message);
    this.status = status;
    this.resetSeconds = resetSeconds;
  }
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

function httpsUrl(value: unknown, base?: string): string {
  const url = new URL(requiredString(value), base);
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error("ANS returned an unsupported endpoint URL");
  }
  return url.href;
}

/** Registry-supplied links are optional: a relative path resolves against the endpoint, anything unusable becomes null. */
function optionalHttpsUrl(value: unknown, base?: string): string | null {
  try { return httpsUrl(value, base); } catch { return null; }
}

function timestamp(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim() !== "") : [];
}

function registryEndpoint(value: unknown): RegistryEndpoint | null {
  const endpoint = record(value);
  if (typeof endpoint.protocol !== "string") return null;
  const url = optionalHttpsUrl(endpoint.agentUrl);
  if (!url) return null;
  const functions = new Map<string, RegistryFunction>();
  for (const item of Array.isArray(endpoint.functions) ? endpoint.functions : []) {
    if (!item || typeof item !== "object") continue;
    const fn = item as Record<string, unknown>;
    const id = optionalString(fn.id);
    if (id && !functions.has(id)) functions.set(id, { id, name: optionalString(fn.name), tags: strings(fn.tags) });
  }
  return {
    protocol: endpoint.protocol,
    url,
    metadataUrl: optionalHttpsUrl(endpoint.metaDataUrl, url),
    documentationUrl: optionalHttpsUrl(endpoint.documentationUrl),
    transports: strings(endpoint.transports),
    functions: [...functions.values()],
  };
}

/** Throws when a record lacks the fields needed to identify the agent; tolerates gaps observed in live data. */
export function parseRegistryRecord(item: unknown): RegistryRecord {
  const agent = record(item);
  if (!Array.isArray(agent.endpoints)) throw new Error("ANS agent is missing endpoints");
  const endpoints: RegistryEndpoint[] = [];
  const seen = new Set<string>();
  for (const value of agent.endpoints) {
    const endpoint = registryEndpoint(value);
    const key = endpoint && `${endpoint.protocol} ${endpoint.url}`;
    if (endpoint && key && !seen.has(key)) { seen.add(key); endpoints.push(endpoint); }
  }
  if (!endpoints.length) throw new Error("ANS agent has no usable endpoints");
  const scores = agent.scores && typeof agent.scores === "object" ? agent.scores as Record<string, unknown> : {};
  const trust = scores.trustScore ?? agent.trustScore;
  return {
    agentId: requiredString(agent.agentId),
    ansName: requiredString(agent.ansName),
    host: optionalString(agent.agentHost) ?? new URL(endpoints[0].url).hostname,
    version: optionalString(agent.agentVersion),
    providerId: optionalString(agent.providerId),
    displayName: requiredString(agent.agentDisplayName),
    description: optionalString(agent.agentDescription),
    status: requiredString(record(agent.lifecycle).status),
    expiresAt: timestamp(agent.expiresAt),
    trustScore: typeof trust === "number" && Number.isFinite(trust) ? trust : null,
    logId: optionalString(agent.logId),
    leafIndex: Number.isSafeInteger(agent.leafIndex) ? agent.leafIndex as number : null,
    indexedAt: timestamp(agent.indexedAt),
    endpoints,
    raw: item,
  };
}

/** Invalid records are skipped rather than failing the whole response. */
export function normalizeAgents(payload: unknown): DiscoveredAgent[] {
  const envelope = record(payload);
  if (!Array.isArray(envelope.items)) throw new Error("ANS response is missing items");
  const discoveredAt = new Date().toISOString();
  return envelope.items.flatMap((item) => {
    let agent: RegistryRecord;
    try { agent = parseRegistryRecord(item); } catch { return []; }
    if (agent.status !== "ACTIVE" || (agent.expiresAt && Date.parse(agent.expiresAt) <= Date.now())) return [];
    return agent.endpoints.filter((endpoint) => endpoint.protocol === "A2A").map((endpoint) => ({
      ansId: agent.agentId,
      name: agent.displayName,
      trustScore: agent.trustScore,
      description: agent.description,
      ansName: agent.ansName,
      endpoint: endpoint.url,
      metadataUrl: endpoint.metadataUrl ?? undefined,
      transports: endpoint.transports,
      discoveredAt,
      identityStatus: "not-verified" as const,
      skills: endpoint.functions.map((skill) => ({ id: skill.id, name: skill.name ?? skill.id, tags: skill.tags })),
    }));
  });
}

function headerNumber(response: Response, name: string): number | null {
  const value = Number(response.headers.get(name));
  return response.headers.has(name) && Number.isFinite(value) ? value : null;
}

/** Fetches one raw page of active A2A registrations, reporting the rate-limit headers ANS returns. */
export async function fetchRegistryPage(options: {
  query: string;
  pageSize?: number;
  baseUrl?: string;
  authorization?: string;
  fetcher?: typeof fetch;
  pageToken?: string;
  signal?: AbortSignal;
}): Promise<RegistryPage> {
  if (options.query.length > 256) throw new Error("Search query must be at most 256 characters");
  const pageSize = options.pageSize ?? 20;
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) throw new Error("Page size must be between 1 and 100");
  const base = new URL(options.baseUrl ?? "https://api.godaddy.com");
  if (base.protocol !== "https:" || base.username || base.password || base.pathname !== "/" || base.search || base.hash) {
    throw new Error("ANS base URL must be an HTTPS origin without credentials");
  }
  const url = new URL("/v1/ans/registered-agents", base);
  const params = new URLSearchParams({ query: options.query, protocols: "A2A", statuses: "ACTIVE", pageSize: String(pageSize) });
  if (options.pageToken) {
    params.set("pageToken", options.pageToken);
    params.set("pageTokenDirection", "forward");
  }
  url.search = params.toString();
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.authorization) headers.Authorization = options.authorization;
  const timeout = AbortSignal.timeout(15_000);
  const response = await (options.fetcher ?? fetch)(url, {
    headers,
    redirect: "error",
    signal: options.signal ? AbortSignal.any([timeout, options.signal]) : timeout,
  });
  const rateLimit = { remaining: headerNumber(response, "ratelimit-remaining"), resetSeconds: headerNumber(response, "ratelimit-reset") };
  if (!response.ok) throw new AnsHttpError(`ANS discovery failed (HTTP ${response.status})`, response.status, rateLimit.resetSeconds);
  const payload = record(await response.json());
  if (!Array.isArray(payload.items)) throw new Error("ANS response is missing items");
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
  return { items: payload.items, hasMore: Boolean(nextLink), nextPageToken, rateLimit };
}

export async function discoverAgents(options: {
  query: string;
  baseUrl?: string;
  authorization?: string;
  fetcher?: typeof fetch;
  pageToken?: string;
}): Promise<{ agents: DiscoveredAgent[]; hasMore: boolean; nextPageToken?: string; skippedRecords: number }> {
  const page = await fetchRegistryPage(options);
  const skippedRecords = page.items.filter((item) => {
    try { parseRegistryRecord(item); return false; } catch { return true; }
  }).length;
  return {
    skippedRecords,
    agents: normalizeAgents({ items: page.items }),
    hasMore: page.hasMore,
    nextPageToken: page.nextPageToken,
  };
}
