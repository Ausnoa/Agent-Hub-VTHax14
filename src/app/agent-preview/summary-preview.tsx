"use client";
import { useState } from "react";
import Link from "next/link";
import Button from "../../components/ui/button";
import Card from "../../components/ui/card";
import "./preview.css";

const sample = "Product meeting — September 19\n\nWe agreed to focus the first release on summarizing supplied text. Maya will send the updated design draft by Friday. Leo will review the API contract on Monday. The public launch date is still undecided because domain verification is pending. The budget remains unchanged. We discussed adding document uploads later, but made no commitment.";
export default function SummaryPreview({ enabled }: { enabled: boolean }) {
  const [text, setText] = useState(sample);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true); setError(""); setResult("");
    try {
      const response = await fetch("/a2a", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: crypto.randomUUID(), method: "message/send", params: { message: { kind: "message", role: "user", messageId: crypto.randomUUID(), parts: [{ kind: "text", text }] } } }), signal: AbortSignal.timeout(55000) });
      const body = await response.json();
      if (!response.ok || body.error) throw new Error(body.error?.message ?? "The agent could not complete this request.");
      const output = body.result?.parts?.filter((part: { kind: string }) => part.kind === "text").map((part: { text: string }) => part.text).join("\n");
      if (!output) throw new Error("The agent returned no summary.");
      setResult(output);
    } catch (reason) { setError(reason instanceof Error && reason.name === "TimeoutError" ? "The request timed out. You can try again." : reason instanceof Error ? reason.message : "Unable to reach the agent."); }
    finally { setBusy(false); }
  }
  return <main className="brief-preview">
    <div className="brief-eyebrow">YOUR FIRST AGENT <span>VERSION 1.0.0</span></div>
    <div className="brief-hero"><div><h1>Less reading.<br /><em>More clarity.</em></h1><p>Meet Glorria Brief. Turn your notes into a concise brief, key points, and the next steps actually mentioned.</p></div><div className="brief-identity"><span className="brief-symbol">G.</span><strong>Glorria Brief</strong><span>Text summary agent</span><small>ANS registration pending</small></div></div>
    <div className="brief-workspace">
      <Card><div className="brief-panel-title"><h2>01 / Your source</h2><Button size="sm" disabled={busy} onClick={() => { setText(sample); setResult(""); setError(""); }}>Load example</Button></div><label htmlFor="source-notes">Notes, a meeting transcript, or a short document</label><textarea id="source-notes" maxLength={12000} value={text} disabled={busy} onChange={event => { setText(event.target.value); setResult(""); setError(""); }} /><div className="brief-counter">{text.length.toLocaleString()} / 12,000 characters</div><p className="brief-caption">Your text is sent to OpenAI to generate the summary. This agent does not browse the web.</p>{!enabled && <p role="status" className="brief-notice">Live generation is disabled on this deployment. Enable the agent and configure its model on the server to try it.</p>}<Button variant="primary" block disabled={!enabled || busy || !text.trim()} onClick={run}>{busy ? "Creating your brief…" : "Create brief →"}</Button></Card>
      <Card><div className="brief-panel-title"><h2>02 / Your brief</h2><span>{busy ? "WORKING" : result ? "READY" : "PREVIEW"}</span></div><div aria-live="polite" aria-busy={busy}>{error ? <p role="alert" className="brief-notice">{error}</p> : result ? <div className="brief-result">{result}</div> : <div className="brief-empty"><span>✦</span><h3>{busy ? "Finding what matters" : "A clear view of what’s next"}</h3><p>{busy ? "Reading your source and extracting explicit actions. This may take up to 45 seconds." : "Your summary will appear here. Owners, dates, and decisions stay grounded in your source."}</p></div>}</div></Card>
    </div><footer className="brief-footer"><span>Supplied text only · Review important details · ANS registration pending</span><Link href="/.well-known/agent-card.json">View A2A agent card ↗</Link></footer>
  </main>;
}
