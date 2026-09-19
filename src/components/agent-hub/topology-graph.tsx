export type TopologyNode = {
  id: string;
  label: string;
  sublabel?: string;
  angle: number;
  radius: number;
  tone?: "accent" | "violet" | "amber" | "green";
};

function position(angle: number, radius: number): { left: string; top: string } {
  const radians = (angle * Math.PI) / 180;
  const left = 50 + Math.cos(radians) * radius * 42;
  const top = 50 + Math.sin(radians) * radius * 42;
  return { left: `${left}%`, top: `${top}%` };
}

export default function TopologyGraph({ coreLabel, coreSublabel, nodes, animated }: {
  coreLabel: string;
  coreSublabel?: string;
  nodes: TopologyNode[];
  animated?: boolean;
}) {
  return <div className="topology">
    <div className="topology-orbit" style={{ width: "62%", height: "62%" }} />
    <div className="topology-orbit" style={{ width: "88%", height: "88%" }} />
    <svg className="topology-edges" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} aria-hidden="true">
      {nodes.map((node) => {
        const from = position(node.angle, 0);
        const to = position(node.angle, node.radius);
        return <line
          key={node.id}
          x1={from.left} y1={from.top} x2={to.left} y2={to.top}
          stroke="var(--accent)" strokeOpacity={0.4} strokeWidth={1}
          strokeDasharray={animated ? "4 4" : undefined}
          style={animated ? { animation: "dash-flow 1.4s linear infinite" } : undefined}
        />;
      })}
    </svg>
    <div className="topology-core">
      <div>
        <strong style={{ display: "block", fontSize: 11 }}>{coreLabel}</strong>
        {coreSublabel && <span style={{ fontSize: 9, opacity: 0.85 }}>{coreSublabel}</span>}
      </div>
    </div>
    {nodes.map((node) => {
      const { left, top } = position(node.angle, node.radius);
      return <div key={node.id} className="topology-node" style={{ left, top, transform: "translate(-50%, -50%)", borderColor: node.tone ? `var(--${node.tone})` : undefined }}>
        <strong>{node.label}</strong>
        {node.sublabel && <span className="ans-id">{node.sublabel}</span>}
      </div>;
    })}
  </div>;
}
