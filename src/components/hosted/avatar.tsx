import { UserRound } from "lucide-react";

export default function Avatar({ url, name, small }: { url?: string | null; name: string; small?: boolean }) {
  const classes = `avatar-circle${small ? " avatar-circle--sm" : ""}`;
  if (url) return <img src={url} alt="" className={classes} />;
  // Decorative: every caller renders the member's name beside the avatar, so the
  // silhouette carries no information a screen reader needs to hear twice.
  return <span className={`${classes} avatar-fallback`} aria-hidden="true" title={name}>
    <UserRound size={small ? 18 : 30} fill="currentColor" stroke="none" />
  </span>;
}
