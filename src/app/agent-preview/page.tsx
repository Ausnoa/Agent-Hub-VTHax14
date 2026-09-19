import SummaryPreview from "./summary-preview";
export const dynamic = "force-dynamic";
export default function Page() {
  return <SummaryPreview enabled={process.env.AGENT_ENABLED === "true" && Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_MODEL)} />;
}
