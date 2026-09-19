export type LogLine = { time: string; text: string; emphasis?: string };

export default function TerminalLogFeed({ lines }: { lines: LogLine[] }) {
  return <div className="log-feed" aria-live="polite">
    {lines.length === 0 && <div className="log-line">Waiting for the first A2A message…</div>}
    {lines.map((line, index) => <div className="log-line" key={index}>
      [{line.time}] {line.emphasis && <strong>{line.emphasis} </strong>}{line.text}
    </div>)}
  </div>;
}
