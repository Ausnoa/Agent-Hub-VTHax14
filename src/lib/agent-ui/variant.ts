// Every generated agent gets its own robocat. The look is derived from the agent id, so the
// same agent always appears the same and two agents rarely look alike.
export type Variant = {
  accent: string;        // CSS colour token
  ear: "pointed" | "round" | "tufted";
  visor: "wide" | "round" | "split";
  glyph: ">" | "~" | "#" | "*";
  glow: string;
};

const palettes = [
  { accent: "var(--accent)", glow: "var(--accent-glow)" },
  { accent: "var(--violet)", glow: "var(--violet-soft)" },
  { accent: "var(--green)", glow: "var(--green-soft)" },
  { accent: "var(--amber)", glow: "var(--amber-soft)" },
] as const;
const ears = ["pointed", "round", "tufted"] as const;
const visors = ["wide", "round", "split"] as const;
const glyphs = [">", "~", "#", "*"] as const;

function hash(seed: string): number {
  let value = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    value ^= seed.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return Math.abs(value);
}

export const paletteCount = palettes.length;

/**
 * `accentIndex` is assigned by the provider so no two cats on screen share a colour;
 * without one the colour falls back to the id hash.
 */
export function variantFor(seed: string, accentIndex?: number): Variant {
  const value = hash(seed || "agent");
  const palette = palettes[(accentIndex ?? value) % palettes.length];
  return {
    accent: palette.accent,
    glow: palette.glow,
    ear: ears[Math.floor(value / 7) % ears.length],
    visor: visors[Math.floor(value / 13) % visors.length],
    glyph: glyphs[Math.floor(value / 17) % glyphs.length],
  };
}
