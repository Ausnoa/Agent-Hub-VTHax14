export default function PageShell({ narrow, children }: { narrow?: boolean; children: React.ReactNode }) {
  return <main className={`page-shell${narrow ? " page-shell--narrow" : ""}`}>{children}</main>;
}
