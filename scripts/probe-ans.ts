import { discoverAgents } from "../src/lib/ans/client.ts";

try {
  const result = await discoverAgents({
    query: process.argv.slice(2).join(" "),
    baseUrl: process.env.ANS_BASE_URL,
    authorization: process.env.ANS_AUTHORIZATION,
  });
  console.log(JSON.stringify({ source: "live-ans", ...result }, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : "ANS probe failed");
  process.exitCode = 1;
}
