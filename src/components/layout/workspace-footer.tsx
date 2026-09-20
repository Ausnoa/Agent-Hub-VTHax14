import { Network, Shield } from "lucide-react";

export default function WorkspaceFooter() {
  return <footer className="workspace-footer">
    <span><Network size={12} /> AGENT GLORRIA · A2A WORKSPACE</span>
    <span><Shield size={12} /> Identity verification pending</span>
  </footer>;
}
