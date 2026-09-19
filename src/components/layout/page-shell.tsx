export default function PageShell({ narrow, className = "", children }: { narrow?: boolean; className?: string; children: React.ReactNode }) {
  return <main className={`page-shell${narrow ? " page-shell--narrow" : ""} ${className}`}>{children}</main>;
}
