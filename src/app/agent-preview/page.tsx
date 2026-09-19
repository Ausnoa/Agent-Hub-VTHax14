import BuilderAccess from "./builder-access";
export const dynamic = "force-dynamic";
export default function Page() {
  return <BuilderAccess enabled={Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_MODEL)} hostedTestsEnabled={process.env.HOSTED_AGENT_TESTS_ENABLED === "true"} />;
}
