export type PillTone = "neutral" | "accent" | "violet" | "green" | "amber" | "red";

export default function StatusPill({ tone = "neutral", running, children }: {
  tone?: PillTone;
  running?: boolean;
  children: React.ReactNode;
}) {
  const classes = ["pill", tone !== "neutral" ? `pill-${tone}` : "", running ? "pill-running" : ""].filter(Boolean).join(" ");
  return <span className={classes}><span className="pill-dot" />{children}</span>;
}

export function toneForRunStatus(status: string): PillTone {
  if (status === "completed") return "green";
  if (status === "failed") return "red";
  if (status === "running") return "accent";
  return "neutral";
}
