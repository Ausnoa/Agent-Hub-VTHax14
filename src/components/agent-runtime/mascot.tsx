import type { Variant } from "../../lib/agent-ui/variant";

// The original Agent Hub robocat: a compact head with pointed ears, a dark visor face and a
// dashed antenna. Ears, visor and colour vary per agent (variantFor), so every generated
// agent gets its own recognisable face inside the circular avatar button.
export default function Mascot({ width = 44, asleep = false, variant }: { width?: number; asleep?: boolean; variant?: Variant }) {
  const accent = variant?.accent ?? "var(--mascot-accent)";
  const ear = variant?.ear ?? "pointed";
  const visor = variant?.visor ?? "wide";

  return <svg width={width} height={width} viewBox="0 0 48 48" fill="none" aria-hidden="true" className="mascot">
    {/* ears */}
    {ear === "round"
      ? <>
          <circle cx="12" cy="11" r="5.5" fill="var(--mascot-ear)" />
          <circle cx="36" cy="11" r="5.5" fill="var(--mascot-ear)" />
          <circle cx="12" cy="11" r="2.4" fill={accent} />
          <circle cx="36" cy="11" r="2.4" fill={accent} />
        </>
      : ear === "tufted"
        ? <>
            <path d="M11 18 L8 5 L15 11 L19 16 Z" fill="var(--mascot-ear)" />
            <path d="M37 18 L40 5 L33 11 L29 16 Z" fill="var(--mascot-ear)" />
            <circle cx="8" cy="5" r="2" fill={accent} />
            <circle cx="40" cy="5" r="2" fill={accent} />
          </>
        : <>
            <path d="M11 7 L18 15 L11 18 Z" fill="var(--mascot-ear)" />
            <path d="M37 7 L30 15 L37 18 Z" fill="var(--mascot-ear)" />
            <circle cx="11" cy="7" r="2" fill={accent} />
            <circle cx="37" cy="7" r="2" fill={accent} />
          </>}

    {/* head */}
    <rect x="9" y="12" width="30" height="24" rx="9" fill="var(--mascot-body)" stroke="var(--mascot-line)" strokeWidth="1.4" />

    {/* visor */}
    {visor === "round"
      ? <rect x="13.5" y="15.5" width="21" height="17" rx="8.5" fill="var(--mascot-visor)" />
      : visor === "split"
        ? <>
            <rect x="12.5" y="15.5" width="10" height="17" rx="5" fill="var(--mascot-visor)" />
            <rect x="25.5" y="15.5" width="10" height="17" rx="5" fill="var(--mascot-visor)" />
          </>
        : <rect x="12.5" y="15.5" width="23" height="17" rx="6.5" fill="var(--mascot-visor)" />}

    {/* eyes */}
    {asleep
      ? <>
          <path d="M17 24 q2.5 2.5 5 0" stroke={accent} strokeWidth="1.8" strokeLinecap="round" fill="none" />
          <path d="M26 24 q2.5 2.5 5 0" stroke={accent} strokeWidth="1.8" strokeLinecap="round" fill="none" />
        </>
      : <>
          <ellipse cx="19.5" cy="23.5" rx="2.6" ry="3.4" fill={accent} />
          <ellipse cx="28.5" cy="23.5" rx="2.6" ry="3.4" fill={accent} />
        </>}

    {/* nose + smile */}
    <path d="M22.6 27.6 L25.4 27.6 L24 29.2 Z" fill="var(--mascot-line)" />
    <path d="M21 30.2 q3 2.4 6 0" stroke={accent} strokeWidth="1.4" strokeLinecap="round" fill="none" />

    {/* whiskers */}
    <path d="M5.5 22h4M5.5 26h4M38.5 22h4M38.5 26h4" stroke={accent} strokeWidth="1.2" strokeLinecap="round" opacity="0.75" />

    {/* antenna */}
    <path d="M39 20 q6 3 4 10" stroke={accent} strokeWidth="1.4" strokeDasharray="3 3" fill="none" />
    <circle cx="39.5" cy="19" r="2.4" fill={accent} />
  </svg>;
}
