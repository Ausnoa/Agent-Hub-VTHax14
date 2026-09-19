import type { HTMLAttributes } from "react";

export default function Card({ active, tight, className = "", ...rest }: HTMLAttributes<HTMLDivElement> & {
  active?: boolean;
  tight?: boolean;
}) {
  const classes = ["card", active ? "card--active" : "", tight ? "panel-tight" : "panel", className].filter(Boolean).join(" ");
  return <div className={classes} {...rest} />;
}

export function CardHead({ index, badge, children }: { index?: string; badge?: React.ReactNode; children: React.ReactNode }) {
  return <div className="card-head">
    {index && <span className="card-index">{index}</span>}
    <h2>{children}</h2>
    {badge}
  </div>;
}
