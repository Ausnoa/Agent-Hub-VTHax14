export default function RunReceiptPanel({ rows }: { rows: { label: string; value: string }[] }) {
  return <div className="proof-panel">
    {rows.map((row) => <div className="proof-row" key={row.label}><span>{row.label}</span><span>{row.value}</span></div>)}
  </div>;
}
