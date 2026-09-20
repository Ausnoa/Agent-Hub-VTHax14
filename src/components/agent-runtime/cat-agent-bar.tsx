"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";

type Point = { x: number; y: number };
type Candidate = { id: string; name: string };
type Selection = { mode: "recent" } | { mode: "custom"; ids: string[] };

const BAR_LIMIT = 4;
const DRAG_THRESHOLD = 4;
// Anything interactive (or the open management panel) starts its own action, never a bar drag.
const NO_DRAG_SELECTOR = "button, a, input, textarea, .agent-mini, .cat-agent-bar-manage-panel";

function clampToBar(point: Point, size: { width: number; height: number }): Point {
  return {
    x: Math.min(Math.max(point.x, 8), Math.max(8, window.innerWidth - size.width - 8)),
    y: Math.min(Math.max(point.y, 8), Math.max(8, window.innerHeight - size.height - 8)),
  };
}

function loadSelection(key: string): Selection {
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed?.mode === "custom" && Array.isArray(parsed.ids)) return { mode: "custom", ids: parsed.ids.filter((id: unknown) => typeof id === "string") };
    }
  } catch { /* best-effort only */ }
  return { mode: "recent" };
}

// Groups the existing cat avatars into one persistent, draggable strip instead of each
// floating independently. Cats themselves (AgentAvatar) are unchanged, just laid out here.
export default function CatAgentBar({ storageKey, candidates, renderCat }: {
  storageKey: string;                          // namespaces this bar's saved position + selection ("local" or "hosted:<userId>")
  candidates: Candidate[];                     // every selectable cat, ordered newest first
  renderCat: (id: string) => React.ReactNode;  // renders that cat's existing <AgentAvatar inline .../>
}) {
  const positionKey = `agent-hub:cat-bar-position:${storageKey}`;
  const selectionKey = `agent-hub:cat-bar-selection:${storageKey}`;

  const [selection, setSelection] = useState<Selection>({ mode: "recent" });
  const [ready, setReady] = useState(false);
  useEffect(() => { setSelection(loadSelection(selectionKey)); setReady(true); }, [selectionKey]);
  useEffect(() => { if (ready) try { localStorage.setItem(selectionKey, JSON.stringify(selection)); } catch { /* best-effort only */ } }, [selection, selectionKey, ready]);

  const visibleIds = useMemo(() => {
    const known = new Set(candidates.map((candidate) => candidate.id));
    if (selection.mode === "custom") {
      const ids = selection.ids.filter((id) => known.has(id)).slice(0, BAR_LIMIT);
      if (ids.length) return ids;
    }
    return candidates.slice(0, BAR_LIMIT).map((candidate) => candidate.id);
  }, [candidates, selection]);

  const [position, setPosition] = useState<Point>();
  useEffect(() => {
    try {
      const stored = localStorage.getItem(positionKey);
      if (stored) setPosition(JSON.parse(stored));
    } catch { /* best-effort only */ }
  }, [positionKey]);

  const barRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ dx: number; dy: number; moved: boolean } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest(NO_DRAG_SELECTOR)) return;
    const bar = barRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { dx: event.clientX - rect.left, dy: event.clientY - rect.top, moved: false };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current || !barRef.current) return;
    const rect = barRef.current.getBoundingClientRect();
    const next = clampToBar({ x: event.clientX - drag.current.dx, y: event.clientY - drag.current.dy }, { width: rect.width, height: rect.height });
    if (!drag.current.moved && (Math.abs(next.x - rect.left) > DRAG_THRESHOLD || Math.abs(next.y - rect.top) > DRAG_THRESHOLD)) {
      drag.current.moved = true;
      setDragging(true);
    }
    if (drag.current.moved) setPosition(next);
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const moved = drag.current?.moved ?? false;
    drag.current = null;
    setDragging(false);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    if (moved) setPosition((current) => {
      if (current) try { localStorage.setItem(positionKey, JSON.stringify(current)); } catch { /* best-effort only */ }
      return current;
    });
  };

  useEffect(() => {
    const onResize = () => {
      const bar = barRef.current;
      if (!bar) return;
      setPosition((current) => current && clampToBar(current, bar.getBoundingClientRect()));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const toggleCustom = useCallback((id: string) => {
    setSelection((current) => {
      const base = current.mode === "custom" ? current.ids : visibleIds;
      const next = base.includes(id) ? base.filter((existing) => existing !== id) : base.length >= BAR_LIMIT ? base : [...base, id];
      return { mode: "custom", ids: next };
    });
  }, [visibleIds]);

  if (!candidates.length) return null;

  return <div
    ref={barRef}
    className={`cat-agent-bar${position ? "" : " default-corner"}${dragging ? " dragging" : ""}`}
    style={position ? { left: position.x, top: position.y } : undefined}
    role="group"
    aria-label="Cat agent bar. Drag to move."
    onPointerDown={onPointerDown}
    onPointerMove={onPointerMove}
    onPointerUp={onPointerUp}
  >
    <div className="cat-agent-bar-cats">{visibleIds.map((id) => <div className="cat-agent-bar-slot" key={id}>{renderCat(id)}</div>)}</div>
    <button className="cat-agent-bar-manage" onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen} aria-label="Choose which cat agents appear in this bar" title="Choose cat agents">
      <SlidersHorizontal size={13} />
    </button>
    {menuOpen && <div className="cat-agent-bar-manage-panel" role="dialog" aria-label="Cat agent bar selection">
      <div className="cat-agent-bar-manage-head">
        <strong>Cat agent bar</strong>
        <button onClick={() => setMenuOpen(false)} aria-label="Close">
          <X size={14} />
        </button>
      </div>
      <p className="hint">Pick up to {BAR_LIMIT}, or follow your most recent.</p>
      <ul className="cat-agent-bar-manage-list">
        {candidates.map((candidate) => {
          const checked = visibleIds.includes(candidate.id);
          const atLimit = visibleIds.length >= BAR_LIMIT && !checked;
          return <li key={candidate.id}>
            <label>
              <input type="checkbox" checked={checked} disabled={atLimit} onChange={() => toggleCustom(candidate.id)} />
              {candidate.name}
            </label>
          </li>;
        })}
      </ul>
      {selection.mode === "custom" && <button className="cat-agent-bar-reset" onClick={() => setSelection({ mode: "recent" })}>Use most recent instead</button>}
    </div>}
  </div>;
}
