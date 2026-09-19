import { setTimeout as wait } from "node:timers/promises";
import { fetchRegistryPage, parseRegistryRecord, type RegistryRecord } from "../ans/client.ts";
import type { RegistryGateway, SyncTrigger } from "../gateways/registry.ts";

export interface SyncOptions {
  trigger: SyncTrigger;
  baseUrl?: string;
  authorization?: string;
  signal?: AbortSignal;
  fetchPage?: typeof fetchRegistryPage;
  pause?: (milliseconds: number, signal?: AbortSignal) => Promise<unknown>;
  /** Safety bound; at 100 agents per page this allows 100,000 registrations. */
  maxPages?: number;
}

/**
 * Copies every active A2A registration from live ANS into the local index.
 * Pages are fetched back to back, pausing only when the rate limit is exhausted, because the
 * page cursor may expire. A failure leaves already-written rows in place and delists nothing.
 */
export async function syncRegistry(gateway: RegistryGateway, options: SyncOptions) {
  const fetchPage = options.fetchPage ?? fetchRegistryPage;
  const pause = options.pause ?? ((milliseconds, signal) => wait(milliseconds, undefined, { signal }));
  const maxPages = options.maxPages ?? 1000;
  const syncId = gateway.startSync(options.trigger);
  let pageToken: string | undefined;
  try {
    for (let pages = 1; ; pages++) {
      options.signal?.throwIfAborted();
      const page = await fetchPage({ query: "", pageSize: 100, pageToken, baseUrl: options.baseUrl, authorization: options.authorization, signal: options.signal });
      const agents: RegistryRecord[] = [];
      let skipped = 0;
      for (const item of page.items) {
        try { agents.push(parseRegistryRecord(item)); } catch { skipped++; }
      }
      gateway.recordPage(syncId, agents, skipped);
      if (!page.hasMore) break;
      if (!page.nextPageToken) throw new Error("ANS reported more results without a page token");
      if (pages >= maxPages) throw new Error(`Stopped after ${maxPages} pages without reaching the end of the registry`);
      pageToken = page.nextPageToken;
      if (page.rateLimit.remaining === 0) await pause(((page.rateLimit.resetSeconds ?? 60) + 1) * 1000, options.signal);
    }
    const { delisted } = gateway.completeSync(syncId);
    return { ...gateway.sync(syncId)!, delisted };
  } catch (error) {
    gateway.failSync(syncId, error instanceof Error ? error.message : "Registry sync failed");
    throw error;
  }
}
