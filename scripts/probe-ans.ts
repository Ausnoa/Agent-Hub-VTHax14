import { discoverAgents, type DiscoveredAgent } from "../src/lib/ans/client.ts";

const MAX_PAGES = Number(process.env.ANS_PROBE_MAX_PAGES ?? "5");

try {
  const query = process.argv.slice(2).join(" ");
  const agents: DiscoveredAgent[] = [];
  let pageToken: string | undefined;
  let pagesFetched = 0;
  let hasMore = false;
  do {
    const page = await discoverAgents({
      query,
      baseUrl: process.env.ANS_BASE_URL,
      authorization: process.env.ANS_AUTHORIZATION,
      pageToken,
    });
    agents.push(...page.agents);
    pagesFetched += 1;
    hasMore = page.hasMore;
    pageToken = page.nextPageToken;
  } while (hasMore && pageToken && pagesFetched < MAX_PAGES);
  console.log(JSON.stringify({ source: "live-ans", agents, hasMore, pagesFetched }, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : "ANS probe failed");
  process.exitCode = 1;
}
