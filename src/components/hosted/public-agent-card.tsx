import Link from 'next/link';
import Card from '../ui/card';
import StatusPill from '../ui/status-pill';

export type PublicAgentSummary = { kind: 'template' | 'workflow'; id: string; name: string; description: string };
export default function PublicAgentCard({ agent, footer }: { agent: PublicAgentSummary; footer?: React.ReactNode }) {
  return <Card>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
      <h2 style={{ margin: 0 }}>{agent.name}</h2>
      <StatusPill tone={agent.kind === 'workflow' ? 'violet' : 'accent'}>{agent.kind === 'workflow' ? 'Composite' : 'Template'}</StatusPill>
    </div>
    <p>{agent.description}</p>
    {footer}
    <p><Link href={`/agents/${agent.id}`}>Open agent →</Link></p>
  </Card>;
}
