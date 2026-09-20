export default function Avatar({ url, name, small }: { url?: string | null; name: string; small?: boolean }) {
  const classes = `avatar-circle${small ? " avatar-circle--sm" : ""}`;
  if (url) return <img src={url} alt="" className={classes} />;
  return <span className={`${classes} avatar-fallback`}>{(name.trim()[0] ?? "?").toUpperCase()}</span>;
}
