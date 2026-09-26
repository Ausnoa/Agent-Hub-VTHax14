"use client";

import { useEffect, useRef, useState } from "react";
import type { Variant } from "../../lib/agent-ui/variant";
import Mascot from "./mascot";

type Point = { x: number; y: number };
export type RunStatus = "idle" | "working" | "done" | "error";

const positionKey = (agentId: string) => `agent-glorria:avatar-position:${agentId}`;
const SLOT_GAP = 14;   // spacing between cats in the pack
const AVATAR_W = 64, AVATAR_H = 64;   // circular avatar button
const LABEL_H = 22;                   // hover name below it, kept on screen too
const DRAG_THRESHOLD = 4;

function clamp(point: Point): Point {
  return {
    x: Math.min(Math.max(point.x, 8), Math.max(8, window.innerWidth - AVATAR_W - 8)),
    y: Math.min(Math.max(point.y, 8), Math.max(8, window.innerHeight - AVATAR_H - LABEL_H - 8)),
  };
}

// Each cat gets its own slot along the bottom-right, so a new one never lands on another.
export function slotCorner(index: number): Point {
  return { x: window.innerWidth - AVATAR_W - 24 - index * (AVATAR_W + SLOT_GAP), y: window.innerHeight - AVATAR_H - LABEL_H - 20 };
}

// The persistent per-agent avatar: draggable, click to open the mini window.
// `inline`: hosted inside a CatAgentBar, so this cat has no free position of its own — grabbing it
// instead drags the whole bar (via onDragStart/onDragMove/onDragEnd), same click-vs-drag threshold as before.
export default function AgentAvatar({ agentId, name, variant, status, slot = 0, inline = false, dimmed, onOpen, onRemove, onPositionChange, onDragStart, onDragMove, onDragEnd, elementRef, children }: {
  agentId: string;
  name: string;
  variant: Variant;
  status: RunStatus;
  slot?: number;                // position in the pack, 0 = nearest the corner; unused when inline
  inline?: boolean;
  dimmed: boolean;              // another cat's window is open
  onOpen: () => void;
  onRemove: () => void;
  onPositionChange?: (agentId:string,position:Point)=>void;
  onDragStart?: () => void;             // inline only: this cat started dragging the bar
  onDragMove?: (dx: number, dy: number) => void;   // inline only: delta since the drag started
  onDragEnd?: () => void;               // inline only: drag finished, bar should persist its position
  // Inline mode has no position state of its own (the bar owns it via raw DOM style updates a
  // caller can't subscribe to), so a caller that needs this cat's live screen position — to
  // anchor a chat window to it — reads it straight from the DOM via this ref.
  elementRef?: (element: HTMLDivElement | null) => void;
  children?: React.ReactNode;   // the mini window renders alongside its own cat
}) {
  const [position, setPosition] = useState<Point>();
  useEffect(()=>{if(!inline&&position)onPositionChange?.(agentId,position);},[position,agentId,onPositionChange,inline]);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ dx: number; dy: number; moved: boolean }>(null);

  useEffect(() => {
    if (inline) return;
    let start: Point | undefined;
    try {
      const stored = localStorage.getItem(positionKey(agentId));
      if (stored) start = JSON.parse(stored);
    } catch { /* best-effort only */ }
    setPosition(clamp(start ?? slotCorner(slot)));
  }, [agentId, slot, inline]);

  useEffect(() => {
    if (inline) return;
    const onResize = () => setPosition((current) => current && clamp(current));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [inline]);

  const inlineDrag = useRef<{ x: number; y: number; moved: boolean } | null>(null);

  const onPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    if (inline) { inlineDrag.current = { x: event.clientX, y: event.clientY, moved: false }; return; }
    if (!position) return;
    drag.current = { dx: event.clientX - position.x, dy: event.clientY - position.y, moved: false };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (inline) {
      if (!inlineDrag.current) return;
      const dx = event.clientX - inlineDrag.current.x, dy = event.clientY - inlineDrag.current.y;
      if (!inlineDrag.current.moved && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
        inlineDrag.current.moved = true;
        setDragging(true);
        onDragStart?.();
      }
      if (inlineDrag.current.moved) onDragMove?.(dx, dy);
      return;
    }
    if (!drag.current || !position) return;
    const next = clamp({ x: event.clientX - drag.current.dx, y: event.clientY - drag.current.dy });
    if (!drag.current.moved && (Math.abs(next.x - position.x) > DRAG_THRESHOLD || Math.abs(next.y - position.y) > DRAG_THRESHOLD)) {
      drag.current.moved = true;
      setDragging(true);
    }
    if (drag.current.moved) setPosition(next);
  };

  const onPointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    if (inline) {
      const moved = inlineDrag.current?.moved ?? false;
      inlineDrag.current = null;
      setDragging(false);
      if (moved) { onDragEnd?.(); return; }   // a drag is never a click
      onOpen();
      return;
    }
    const moved = drag.current?.moved ?? false;
    drag.current = null;
    setDragging(false);
    if (moved) {
      setPosition((current) => {
        if (current) try { localStorage.setItem(positionKey(agentId), JSON.stringify(current)); } catch { /* best-effort only */ }
        return current;
      });
      return;   // a drag is never a click
    }
    onOpen();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (inline) return;
    const step = event.shiftKey ? 40 : 12;
    const moves: Record<string, Point> = { ArrowUp: { x: 0, y: -step }, ArrowDown: { x: 0, y: step }, ArrowLeft: { x: -step, y: 0 }, ArrowRight: { x: step, y: 0 } };
    const move = moves[event.key];
    if (!move || !position) return;
    event.preventDefault();
    const next = clamp({ x: position.x + move.x, y: position.y + move.y });
    setPosition(next);
    try { localStorage.setItem(positionKey(agentId), JSON.stringify(next)); } catch { /* best-effort only */ }
  };

  const statusLabel = { idle: "Ready", working: "Working", done: "Run complete", error: "Run failed" }[status];

  return <div
    ref={elementRef}
    className={`agent-avatar-layer${inline ? " inline" : ""}${dimmed ? " dimmed" : ""}`}
    data-agent-id={agentId}
    style={inline ? undefined : position ? { left: position.x, top: position.y } : { right: 24 + slot * (AVATAR_W + SLOT_GAP), bottom: 24 }}
  >
    {children}
    <button className="agent-dismiss" onClick={onRemove} aria-label={`Hide ${name}`} title={`Hide ${name} (the agent stays saved)`}>×</button>
    <button
      className={`avatar-button status-${status}${dragging ? " dragging" : ""}`}
      style={{ "--mascot-accent": variant.accent } as React.CSSProperties}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onKeyDown={onKeyDown}
      onClick={event=>{if(event.detail===0)onOpen();}}
      aria-label={inline ? `Open ${name}. Status: ${statusLabel}. Drag to move the bar.` : `Open ${name}. Status: ${statusLabel}. Drag to move, or use arrow keys.`}
      title={inline ? `${name} — ${statusLabel}. Click to open, drag to move the bar.` : `${name} — ${statusLabel}. Click to open, drag to move.`}
    >
      <Mascot width={44} variant={variant} asleep={status === "idle"} />
    </button>
    <span className="avatar-name">{name}</span>
  </div>;
}
