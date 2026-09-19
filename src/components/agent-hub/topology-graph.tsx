"use client";

import { useEffect, useRef, useState } from "react";

export type TopologyNode = {
  id: string;
  label: string;
  sublabel?: string;
  angle: number;
  radius: number;
  tone?: "accent" | "violet" | "amber" | "green";
};

type Edge = { id: string; x1: number; y1: number; x2: number; y2: number };

function position(angle: number, radius: number): { left: string; top: string } {
  const radians = (angle * Math.PI) / 180;
  const left = 50 + Math.cos(radians) * radius * 42;
  const top = 50 + Math.sin(radians) * radius * 42;
  return { left: `${left}%`, top: `${top}%` };
}

// Each edge runs from the core's rim to the facing border of its node box, measured from the
// rendered layout, so lines never cross the core's label or a node's text.
function measureEdges(container: HTMLElement, core: HTMLElement, boxes: Map<string, HTMLElement>, nodes: TopologyNode[]): Edge[] {
  const frame = container.getBoundingClientRect();
  const cx = core.offsetLeft + core.offsetWidth / 2;
  const cy = core.offsetTop + core.offsetHeight / 2;
  const coreRadius = core.offsetWidth / 2;
  return nodes.flatMap((node) => {
    const box = boxes.get(node.id)?.getBoundingClientRect();
    if (!box) return [];
    const nx = box.left + box.width / 2 - frame.left;
    const ny = box.top + box.height / 2 - frame.top;
    const dx = nx - cx;
    const dy = ny - cy;
    const length = Math.hypot(dx, dy);
    if (!length) return [];
    // Fraction of the center-to-center vector that lies inside the box, measured back from its center.
    const inside = Math.min(dx ? box.width / 2 / Math.abs(dx) : Infinity, dy ? box.height / 2 / Math.abs(dy) : Infinity);
    const x2 = nx - dx * inside;
    const y2 = ny - dy * inside;
    const x1 = cx + (dx / length) * coreRadius;
    const y1 = cy + (dy / length) * coreRadius;
    // Skip when the box overlaps the core and there is no gap to draw across.
    if ((x2 - x1) * dx + (y2 - y1) * dy <= 0) return [];
    return [{ id: node.id, x1, y1, x2, y2 }];
  });
}

export default function TopologyGraph({ coreLabel, coreSublabel, nodes, animated }: {
  coreLabel: string;
  coreSublabel?: string;
  nodes: TopologyNode[];
  animated?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const coreRef = useRef<HTMLDivElement>(null);
  const boxRefs = useRef(new Map<string, HTMLElement>());
  const [edges, setEdges] = useState<Edge[]>([]);
  // Callers pass a fresh array each render; re-measure only when the layout inputs change.
  const layoutKey = nodes.map((node) => `${node.id}:${node.angle}:${node.radius}:${node.label}:${node.sublabel ?? ""}`).join("|");

  useEffect(() => {
    const container = containerRef.current;
    const core = coreRef.current;
    if (!container || !core) return;
    const update = () => setEdges(measureEdges(container, core, boxRefs.current, nodes));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    for (const box of boxRefs.current.values()) observer.observe(box);
    return () => observer.disconnect();
  }, [layoutKey]);

  return <div className="topology" ref={containerRef}>
    <div className="topology-orbit" style={{ width: "62%", height: "62%" }} />
    <div className="topology-orbit" style={{ width: "88%", height: "88%" }} />
    <svg className="topology-edges" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} aria-hidden="true">
      {edges.map((edge) => <line
        key={edge.id}
        x1={edge.x1} y1={edge.y1} x2={edge.x2} y2={edge.y2}
        stroke="var(--accent)" strokeOpacity={0.4} strokeWidth={1}
        strokeDasharray={animated ? "4 4" : undefined}
        style={animated ? { animation: "dash-flow 1.4s linear infinite" } : undefined}
      />)}
    </svg>
    <div className="topology-core" ref={coreRef}>
      <div>
        <strong style={{ display: "block", fontSize: 11 }}>{coreLabel}</strong>
        {coreSublabel && <span style={{ fontSize: 9, opacity: 0.85 }}>{coreSublabel}</span>}
      </div>
    </div>
    {nodes.map((node) => {
      const { left, top } = position(node.angle, node.radius);
      return <div
        key={node.id}
        ref={(element) => { if (element) boxRefs.current.set(node.id, element); else boxRefs.current.delete(node.id); }}
        className="topology-node"
        style={{ left, top, transform: "translate(-50%, -50%)", borderColor: node.tone ? `var(--${node.tone})` : undefined }}
      >
        <strong>{node.label}</strong>
        {node.sublabel && <span className="ans-id">{node.sublabel}</span>}
      </div>;
    })}
  </div>;
}
