// Inline <script> that runs during HTML parsing. Per the Next.js "preventing flash before hydration"
// guide: text/javascript on the server so the browser executes it, text/plain on the client so React
// neither re-runs nor warns about it, and suppressHydrationWarning for that intentional difference.
export default function InlineScript({ html }: { html: string }) {
  return <script
    type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
    suppressHydrationWarning
    dangerouslySetInnerHTML={{ __html: html }}
  />;
}
