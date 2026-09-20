// What a generated agent's interface is made of. A plain data spec — never generated code —
// rendered by the primitive registry into both the mini window and the full-screen workspace.
export const primitiveKinds = ["text_input", "file_upload", "audio_recording", "chat", "results", "editor", "table", "download"] as const;
export type PrimitiveKind = (typeof primitiveKinds)[number];

export type Primitive = {
  kind: PrimitiveKind;
  label: string;
  /** Set when the runtime cannot carry this capability yet; the UI renders it disabled with this reason. */
  unavailable?: string;
};

export type AgentUISpec = {
  agentId: string;
  name: string;
  description: string;
  /** The one primitive the mini window leads with. */
  primary: PrimitiveKind;
  primaryAction: string;
  primitives: Primitive[];
  capabilities: string[];
  variantSeed: string;
  /** Palette slot assigned when the agent joins the pack, so neighbours differ. */
  accentIndex?: number;
};

export const primitiveLabels: Record<PrimitiveKind, string> = {
  text_input: "Input", file_upload: "Upload", audio_recording: "Record", chat: "Chat",
  results: "Results", editor: "Editor", table: "Table", download: "Export",
};
