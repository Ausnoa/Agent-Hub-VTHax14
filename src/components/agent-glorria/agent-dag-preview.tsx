export interface DagNode {
  id: string;
  name: string;
  status?: "active" | "standby" | "tripped" | "completed";
  latency?: string;
  // Optional styling hint for the connector leading into this node — e.g. a capability tag.
  // Purely cosmetic; unrecognized or absent values fall back to the default connector look.
  kind?: string;
}

export interface AgentDagProps {
  nodes: DagNode[];
  flowSummary?: string;
  metricBadge?: string;
  variant?: "nodes-flow" | "wave-mesh" | "ast-graph";
}

// Deterministic per-node jitter (not Math.random) so layout is stable across server/client
// render and reloads, while still varying by the node's real id instead of just its index.
function hashCode(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) | 0;
  return Math.abs(hash);
}

function nodeCenter(node: DagNode, index: number, total: number) {
  const x = ((index + 0.5) / total) * 1000;
  if (total === 1) return { x, y: 50 };
  const zigzag = index % 2 === 0 ? -16 : 16;
  const jitter = (hashCode(node.id) % 9) - 4;
  return { x, y: Math.max(20, Math.min(80, 50 + zigzag + jitter)) };
}

// Connector shape/color varies by the destination node's `kind` (usually a capability tag), so a
// risk-analysis step reads as a direct, urgent line while a summarization step reads as a wide,
// synthesizing curve. Unknown kinds fall back to the neutral default — never a hard error.
const connectorStyles: Record<string, { className: string; curviness: number }> = {
  "risk-analysis": { className: "dag-line-risk", curviness: 0.18 },
  summarization: { className: "dag-line-synthesis", curviness: 0.82 },
  "company-research": { className: "dag-line-research", curviness: 0.5 },
};
const defaultConnectorStyle = { className: "", curviness: 0.5 };

function connectorStyleFor(kind?: string) {
  return (kind && connectorStyles[kind]) || defaultConnectorStyle;
}

export default function AgentDagPreview({ nodes, flowSummary, metricBadge }: AgentDagProps) {
  if (!nodes.length) return null;

  const centers = nodes.map((node, index) => nodeCenter(node, index, nodes.length));
  const segments = nodes.slice(0, -1).map((node, index) => {
    const next = nodes[index + 1];
    const a = centers[index];
    const b = centers[index + 1];
    const style = connectorStyleFor(next.kind);
    const cx1 = a.x + (b.x - a.x) * style.curviness;
    const cx2 = b.x - (b.x - a.x) * style.curviness;
    return {
      key: `${node.id}-${next.id}`,
      d: `M ${a.x} ${a.y} C ${cx1} ${a.y}, ${cx2} ${b.y}, ${b.x} ${b.y}`,
      active: node.status === "active" || next.status === "active",
      className: style.className,
    };
  });

  return <div className="dag-preview">
    <div className="dag-preview-flow-row">
      <svg className="dag-preview-lines" viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true">
        {segments.map((segment) => <path
          key={segment.key}
          d={segment.d}
          className={`dag-line${segment.className ? ` ${segment.className}` : ""}${segment.active ? " dag-line-active" : ""}`}
        />)}
      </svg>
      {nodes.map((node, index) => {
        const center = centers[index];
        return <div
          key={node.id}
          className={`dag-node dag-node-${node.status ?? "standby"}`}
          style={{ left: `${center.x / 10}%`, top: `${center.y}%` }}
        >
          <span className="dag-node-dot" />
          <span className="dag-node-label">{node.name}</span>
          {node.latency && <span className="dag-node-latency">{node.latency}</span>}
        </div>;
      })}
    </div>
    <div className="dag-preview-overlay">
      {flowSummary && <span className="dag-preview-flow">{flowSummary}</span>}
      {metricBadge && <span className="dag-preview-metric">{metricBadge}</span>}
    </div>
  </div>;
}
