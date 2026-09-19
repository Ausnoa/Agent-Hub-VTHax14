import assert from "node:assert/strict";
import test from "node:test";
import { discoverAgents, normalizeAgents } from "../src/lib/ans/client.ts";

const agent = {
  agentId: "fixture-agent",
  agentDisplayName: "Fixture research agent",
  agentDescription: "Synthetic fixture that researches companies.",
  ansName: "ans://v1.0.0.fixture.example",
  lifecycle: { status: "ACTIVE" },
  endpoints: [{ protocol: "A2A", agentUrl: "https://fixture.example/a2a", transports: ["JSON-RPC"] }],
};

test("keeps only active A2A endpoints and never infers identity verification", () => {
  const agents = normalizeAgents({ items: [agent, { ...agent, lifecycle: { status: "REVOKED" } }, { ...agent, endpoints: [{ protocol: "MCP" }] }] });
  assert.equal(agents.length, 1);
  assert.equal(agents[0].endpoint, agent.endpoints[0].agentUrl);
  assert.equal(agents[0].identityStatus, "not-verified");
});

test("keeps the ANS description and uses null when it is absent", () => {
  const [described, undescribed] = normalizeAgents({ items: [agent, { ...agent, agentDescription: undefined }] });
  assert.equal(described.description, agent.agentDescription);
  assert.equal(undescribed.description, null);
});

test("rejects malformed responses and unsafe endpoint schemes", () => {
  assert.throws(() => normalizeAgents({}));
  assert.throws(() => normalizeAgents({ items: [{ ...agent, endpoints: [{ ...agent.endpoints[0], agentUrl: "file:///etc/passwd" }] }] }));
});

test("sends documented filters and reports incomplete pagination", async () => {
  const result = await discoverAgents({
    query: "company research",
    fetcher: (async (input, init) => {
      const url = new URL(String(input));
      assert.equal(url.pathname, "/v1/ans/registered-agents");
      assert.equal(url.searchParams.get("protocols"), "A2A");
      assert.equal(url.searchParams.get("statuses"), "ACTIVE");
      assert.equal(init?.redirect, "error");
      return Response.json({ items: [agent], links: [{ rel: "next" }] });
    }) as typeof fetch,
  });
  assert.equal(result.hasMore, true);
  assert.equal(result.agents.length, 1);
});

test("HTTP errors do not expose response bodies or credentials", async () => {
  await assert.rejects(discoverAgents({ query: "", fetcher: (async () => new Response("sensitive body", { status: 401 })) as typeof fetch }), /^Error: ANS discovery failed \(HTTP 401\)$/);
});

test("forwards an opaque page token and extracts the next one from the response", async () => {
  const result = await discoverAgents({
    query: "company research",
    pageToken: "prior-token",
    fetcher: (async (input) => {
      const url = new URL(String(input));
      assert.equal(url.searchParams.get("pageToken"), "prior-token");
      assert.equal(url.searchParams.get("pageTokenDirection"), "forward");
      return Response.json({
        items: [agent],
        links: [{ rel: "next", href: "https://api.godaddy.com/v1/ans/registered-agents?pageToken=next-token&pageTokenDirection=forward" }],
      });
    }) as typeof fetch,
  });
  assert.equal(result.hasMore, true);
  assert.equal(result.nextPageToken, "next-token");
});
