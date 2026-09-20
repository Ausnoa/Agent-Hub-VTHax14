"use client";
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAccount } from '../../lib/hosted/use-account';
import { hostedApi } from '../../lib/hosted/browser';
import PageShell from '../layout/page-shell';
import PageHeader from '../layout/page-header';
import Avatar from './avatar';
import PublicAgentCard, { type PublicAgentSummary } from './public-agent-card';
import './hosted.css';

type Profile = { userId: string; username: string; displayName: string; avatarUrl: string | null; bio: string };

export default function PublicProfilePage() {
  const account = useAccount();
  const params = useParams<{ username: string }>();
  if (!account.ready) return <PageShell><p role="status">Loading…</p></PageShell>;
  if (!account.configured) return <PageShell narrow><PageHeader eyebrow="PROFILE" title="Profile" description="Hosted accounts are not configured yet." /></PageShell>;
  if (!account.session) return <PageShell narrow><PageHeader eyebrow="PROFILE" title="Profile" description="Sign in to view member profiles." /><Link href={`/login?next=/profile/${params.username}`}>Sign in or create an account →</Link>{account.error && <p role="alert">{account.error}</p>}</PageShell>;
  return <ProfileBody key={`${account.session.user.id}:${params.username}`} username={params.username} myUserId={account.session.user.id} />;
}

function ProfileBody({ username, myUserId }: { username: string; myUserId: string }) {
  const [profile, setProfile] = useState<Profile>();
  const [agents, setAgents] = useState<PublicAgentSummary[]>();
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const found = await hostedApi<Profile>(`profiles/${username}`);
        if (!active) return;
        setProfile(found);
        setAgents(await hostedApi<PublicAgentSummary[]>(`discover/by-owner/${found.userId}`));
      } catch (reason) { if (active) setError(reason instanceof Error ? reason.message : 'Could not load this profile'); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [username]);

  if (loading) return <PageShell><p role="status">Loading profile…</p></PageShell>;
  if (error || !profile) return <PageShell><div role="alert" className="alert"><strong>Something needs attention</strong><p>{error || 'Profile not found'}</p></div></PageShell>;

  return <PageShell>
    <div className="profile-header">
      <Avatar url={profile.avatarUrl} name={profile.displayName || profile.username} />
      <div><h1>{profile.displayName || `@${profile.username}`}</h1><p className="hint" style={{ margin: 0 }}>@{profile.username}</p></div>
    </div>
    {profile.userId === myUserId && <p><Link href="/profile/settings">Edit your profile →</Link></p>}
    {profile.bio && <p>{profile.bio}</p>}
    <h2 style={{ marginTop: 24 }}>Public agents</h2>
    {!agents?.length && <p className="empty">{profile.displayName || `@${profile.username}`} hasn&rsquo;t published any public agents yet.</p>}
    {!!agents?.length && <div className="discover-grid">{agents.map((agent) => <PublicAgentCard key={`${agent.kind}:${agent.id}`} agent={agent} />)}</div>}
  </PageShell>;
}
