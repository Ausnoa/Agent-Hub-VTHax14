"use client";

import { useState, type ReactNode } from "react";
import { Maximize, Minus, Plus } from "lucide-react";

/** View controls change presentation only; workflow definitions remain untouched. */
export default function GraphViewport({ children, label = "Pipeline canvas" }: { children: ReactNode; label?: string }) {
  const [zoom, setZoom] = useState(100);
  return <section className="graph-viewport" aria-label={label}>
    <div className="graph-toolbar">
      <span>WORKFLOW TOPOLOGY</span>
      <div role="group" aria-label="Graph view controls">
        <button type="button" aria-label="Zoom out graph" disabled={zoom <= 60} onClick={() => setZoom(value => value - 20)}><Minus size={14}/></button>
        <output aria-live="polite">{zoom}%</output>
        <button type="button" aria-label="Zoom in graph" disabled={zoom >= 160} onClick={() => setZoom(value => value + 20)}><Plus size={14}/></button>
        <button type="button" aria-label="Reset graph view" onClick={() => setZoom(100)}><Maximize size={14}/></button>
      </div>
    </div>
    <div className="graph-scroll" tabIndex={0} role="region" aria-label={`${label}, scroll to explore`}>
      <div className="graph-content" style={{ zoom: zoom / 100 }}>{children}</div>
    </div>
  </section>;
}
