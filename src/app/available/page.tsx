"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PageShell from "../../components/layout/page-shell";
import Card from "../../components/ui/card";
import Button from "../../components/ui/button";
import { api } from "../../lib/api-client";
import type { GeneralStep } from "../../lib/general/contracts";

type Entry = { agentId: string; name: string; description: string | null; endpoint: string; skills: { id: string; name: string }[] };
type Results = { agents: Entry[]; hasMore: boolean; status: { listedAgents: number; latest: { status: string } | null } };
export default function AvailablePage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [results, setResults] = useState<Results>();
  const [format, setFormat] = useState<"text" | "json">("text");
  const [checks, setChecks] = useState<Record<string, { step?: GeneralStep; message: string }>>({});
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true; setResults(undefined); setError("");
    api<Results>(`general/available?query=${encodeURIComponent(search)}&offset=${offset}`).then((data) => { if(active) setResults(data); }).catch((reason) => { if(active) setError(reason.message); });
    return () => { active=false; };
  }, [search, offset]);
  async function check(agent: Entry, skill: string, key: string) {
    setBusy(key);
    try { const result = await api<{step: GeneralStep; checkedAt: string}>("general/check", {agentId: agent.agentId, skill, format});
      setChecks((previous) => ({ ...previous, [key]: { step: result.step, message: `Card compatible · ${new Date(result.checkedAt).toLocaleTimeString()}` } }));
    } catch(reason) { setChecks((previous) => ({ ...previous, [key]: {message: reason instanceof Error ? reason.message : "Check failed"} })); }
    finally { setBusy(""); }
  }
  return <PageShell narrow><div className="compose-hero"><h1>Available agent candidates</h1><p>Browse our supported registry subset, then check a skill before using it.</p><Link href="/general">Open general builder</Link></div>
    <Card><p>Fresh, active, unexpired A2A entries with a card URL and declared JSON-RPC transport. Cards must also pass A2A 0.3, no-authentication, and text/JSON checks. Identity and task behavior remain unverified.</p>
      <label>Search names and skills<input value={query} maxLength={256} onChange={(event)=>setQuery(event.target.value)} /></label><Button onClick={()=>{setOffset(0);setSearch(query.trim());}}>Search</Button>
      <label>Input format<select value={format} onChange={(event)=>setFormat(event.target.value as "text"|"json")}><option value="text">Text</option><option value="json">JSON object</option></select></label>
      {results && <p>{results.status.listedAgents.toLocaleString()} indexed registrations · latest sync: {results.status.latest?.status ?? "never"}. Showing up to 20 candidate endpoints, not a count of verified connections.</p>}
    </Card>{error && <p role="alert">{error}</p>}{!results && !error && <p>Loading candidates…</p>}
    {results?.agents.length===0 && <Card><p>No matching eligible candidates. Try another search or refresh the registry. No incompatible agents are substituted.</p></Card>}
    {results?.agents.map((agent)=><Card key={`${agent.agentId}|${agent.endpoint}`}><h2>{agent.name}</h2><p>{agent.description}</p><p style={{overflowWrap:"anywhere"}}>{agent.endpoint}</p><p>Registry candidate · identity unverified</p>
      {agent.skills.map((skill)=>{const key=`${agent.agentId}|${agent.endpoint}|${skill.id}|${format}`;const result=checks[key];return <div key={skill.id}><h3>{skill.name}</h3><p>{skill.id}</p><Button disabled={Boolean(busy)} onClick={()=>check(agent,skill.id,key)}>{busy===key?"Checking card…":"Check compatibility"}</Button>
        {result && <p role="status">{result.message}</p>}{result?.step && <><p style={{overflowWrap:"anywhere"}}>Checked endpoint: {result.step.endpoint}</p><Button onClick={()=>{sessionStorage.setItem("general-workflow-step",JSON.stringify(result.step));router.push("/general");}}>Use in new workflow</Button></>}</div>;})}
    </Card>)}<Button disabled={!results || offset===0} onClick={()=>setOffset(Math.max(0,offset-20))}>Previous</Button><Button disabled={!results?.hasMore} onClick={()=>setOffset(offset+20)}>Next</Button>
    <p>Compatibility checks only read cards; they do not execute tasks. Use still requires workflow review and explicit execution authorization.</p>
  </PageShell>;
}
