import { lookup } from "node:dns/promises";
import ipaddr from "ipaddr.js";
import { Agent, fetch as request } from "undici";

export function isPublicAddress(address: string): boolean {
  return ipaddr.isValid(address) && ipaddr.process(address).range() === "unicast";
}

export function makeAgentFetch(allowLocalFixtures = false): typeof fetch {
  return async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const local = allowLocalFixtures && url.protocol === "http:" && url.hostname === "127.0.0.1" && ["4311", "4312", "4313"].includes(url.port);
    if (url.username || url.password || url.hash || (!local && (url.protocol !== "https:" || (url.port && url.port !== "443")))) {
      throw new Error("Agent URL is outside the supported network policy");
    }
    const addresses = await lookup(url.hostname.replace(/^\[|\]$/g, ""), { all: true });
    if (!addresses.length || (!local && addresses.some(({ address }) => !isPublicAddress(address)))) {
      throw new Error("Agent URL resolves to a non-public address");
    }
    const selected = addresses[0];
    const dispatcher = new Agent({ connect: { lookup: (_hostname, options, callback) => {
      if (options.all) callback(null, [selected]);
      else callback(null, selected.address, selected.family);
    } } });
    try {
      const response = await request(url, {
        method: init?.method ?? "GET", headers: init?.headers as Record<string, string>,
        body: init?.body as string | undefined, redirect: "error", dispatcher,
        signal: AbortSignal.any([AbortSignal.timeout(45_000), ...(init?.signal ? [init.signal] : [])]),
      });
      const chunks: Uint8Array[] = [];
      let size = 0;
      if (response.body) for await (const chunk of response.body) {
        size += chunk.length;
        if (size > 1_000_000) throw new Error("Agent response exceeds the 1 MB limit");
        chunks.push(chunk);
      }
      return new Response(Buffer.concat(chunks), { status: response.status, headers: { "content-type": response.headers.get("content-type") ?? "application/json" } });
    } catch (error) {
      if (error instanceof TypeError) throw new Error("Agent is unavailable. Check that its service is running, then retry the failed step.");
      if (error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name)) throw new Error("Agent request timed out. Check the service before retrying.");
      throw error;
    } finally {
      await dispatcher.close();
    }
  };
}
