export default function MetricTile({ label, value, delta, down }: {
  label: string;
  value: string;
  delta?: string;
  down?: boolean;
}) {
  return <div className="metric-tile">
    <div className="metric-tile-label">{label}</div>
    <div className="metric-tile-value">{value}</div>
    {delta && <div className={`metric-tile-delta${down ? " down" : ""}`}>{delta}</div>}
  </div>;
}
