"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAccount } from '../../../lib/hosted/use-account';
import { browserAuth, hostedApi } from '../../../lib/hosted/browser';
import PageShell from '../../../components/layout/page-shell';
import PageHeader from '../../../components/layout/page-header';
import Card from '../../../components/ui/card';
import Button from '../../../components/ui/button';
import Avatar from '../../../components/hosted/avatar';
import '../../../components/hosted/hosted.css';

type Profile = { userId: string; username: string; displayName: string; avatarUrl: string | null; bio: string; createdAt: string };

export default function ProfileSettingsPage() {
  const account = useAccount();
  const [signOutBusy, setSignOutBusy] = useState(false), [signOutError, setSignOutError] = useState('');
  async function signOut() {
    setSignOutBusy(true); setSignOutError('');
    try { const result = await browserAuth()!.auth.signOut(); if (result.error) throw result.error; }
    catch { setSignOutError('Could not sign out. Please try again.'); }
    finally { setSignOutBusy(false); }
  }
  if (!account.ready) return <PageShell><p role="status">Loading…</p></PageShell>;
  if (!account.configured) return <PageShell narrow><PageHeader eyebrow="YOUR PROFILE" title="Profile settings" description="Hosted accounts are not configured yet." /></PageShell>;
  if (!account.session) return <PageShell narrow><PageHeader eyebrow="YOUR PROFILE" title="Profile settings" description="Sign in to edit your public profile." /><Link href="/login?next=/profile/settings">Sign in or create an account →</Link>{account.error && <p role="alert">{account.error}</p>}</PageShell>;
  return <SettingsForm key={account.session.user.id} email={account.session.user.email ?? ''} signOut={signOut} signOutBusy={signOutBusy} signOutError={signOutError || account.error} />;
}

function SettingsForm({ email, signOut, signOutBusy, signOutError }: { email: string; signOut: () => void; signOutBusy: boolean; signOutError: string }) {
  const [profile, setProfile] = useState<Profile>();
  const [username, setUsername] = useState(''), [displayName, setDisplayName] = useState(''), [avatarUrl, setAvatarUrl] = useState(''), [bio, setBio] = useState('');
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(''), [saved, setSaved] = useState(false);
  useEffect(() => {
    let active = true;
    hostedApi<Profile>('profile').then((data) => { if (active) { setProfile(data); setUsername(data.username); setDisplayName(data.displayName); setAvatarUrl(data.avatarUrl ?? ''); setBio(data.bio); } })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'Could not load your profile'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  async function save() {
    setBusy(true); setError(''); setSaved(false);
    try { const result = await hostedApi<Profile>('profile', { username, displayName, avatarUrl, bio }); setProfile(result); setSaved(true); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save your profile'); }
    finally { setBusy(false); }
  }
  return <PageShell narrow>
    <PageHeader eyebrow="YOUR PROFILE" title="Profile settings" description="Choose how other members see you in Discover and on your public agents."
      action={profile && <Link href={`/profile/${profile.username}`}>View your public profile →</Link>} />
    <div className="account-bar">
      <p className="account-bar-user">Signed in as <strong>{email}</strong></p>
      <div className="account-bar-links">
        <Link href="/agents">My agents</Link>
        <Button variant="ghost" size="sm" disabled={signOutBusy} onClick={signOut}>Sign out</Button>
      </div>
    </div>
    {signOutError && <p role="alert">{signOutError}</p>}
    {loading && <p role="status">Loading your profile…</p>}
    {!loading && <Card>
      <div className="profile-header"><Avatar url={avatarUrl} name={displayName || username} /><div><strong>{displayName || username}</strong><p className="hint" style={{ margin: 0 }}>@{username}</p></div></div>
      <form className="hosted-form" onSubmit={(event) => { event.preventDefault(); void save(); }}>
        <label>Username<input value={username} maxLength={20} required pattern="[a-z0-9_]{3,20}" disabled={busy} onChange={(event) => { setUsername(event.target.value.toLowerCase()); setSaved(false); }} /></label>
        <p className="hint">3–20 lowercase letters, numbers, or underscores. Used in your profile link.</p>
        <label>Display name<input value={displayName} maxLength={60} disabled={busy} onChange={(event) => { setDisplayName(event.target.value); setSaved(false); }} /></label>
        <label>Avatar URL<input value={avatarUrl} maxLength={2000} placeholder="https://…" disabled={busy} onChange={(event) => { setAvatarUrl(event.target.value); setSaved(false); }} /></label>
        <p className="hint">Optional. Link to an image; leave blank to show your initial instead.</p>
        <label>Bio<textarea value={bio} maxLength={280} disabled={busy} onChange={(event) => { setBio(event.target.value); setSaved(false); }} /></label>
        <Button variant="primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</Button>
      </form>
      {error && <p role="alert">{error}</p>}{saved && !error && <p role="status">Saved.</p>}
    </Card>}
  </PageShell>;
}
