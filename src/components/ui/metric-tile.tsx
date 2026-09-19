export default function MetricTile({ label, value, delta, down, icon }: {
  label: string;
  value: string;
  delta?: string;
  down?: boolean;
  icon?: React.ReactNode;
}) {
  return <div className="metric-tile">
    <div className="metric-tile-head">
      <div className="metric-tile-label">{label}</div>
      {icon}
    </div>
    <div className="metric-tile-value">{value}</div>
    {delta && <div className={`metric-tile-delta${down ? " down" : ""}`}>{delta}</div>}
  </div>;
}
