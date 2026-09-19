"use client";
import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { browserAuth, hostedApi } from '../../lib/hosted/browser';
import SummaryPreview from './summary-preview';
import Card from '../../components/ui/card';
import Button from '../../components/ui/button';

export default function BuilderAccess({ enabled, hostedTestsEnabled }: { enabled: boolean; hostedTestsEnabled: boolean }) {
  const [local, setLocal] = useState<boolean>();
  const [mode, setMode] = useState<'local' | 'hosted'>('hosted');
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signup, setSignup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);
    setLocal(isLocal); setMode(isLocal ? 'local' : 'hosted');
    let active = true;
    try {
      const client = browserAuth();
      setConfigured(Boolean(client));
      if (!client) { setReady(true); return; }
      const { data: subscription } = client.auth.onAuthStateChange((_event, next) => { if (active) { setSession(next); setReady(true); } });
      client.auth.getSession().then(({ data, error: reason }) => { if (active) { setSession(data.session); setReady(true); if (reason) setError('Could not restore your session. Please sign in again.'); } }).catch(() => { if (active) { setReady(true); setError('Sign-in is unavailable. Please try again.'); } });
      return () => { active = false; subscription.subscription.unsubscribe(); };
    } catch { setError('Hosted accounts are not configured correctly.'); setReady(true); }
  }, []);
  async function signIn() {
    setBusy(true); setMessage(''); setError('');
    try {
      const client = browserAuth()!;
      const result = signup
        ? await client.auth.signUp({ email, password, options: { emailRedirectTo: `${location.origin}/agent-preview` } })
        : await client.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      setPassword('');
      if (signup && !result.data.session) setMessage('Check your email to confirm your account, then sign in.');
    } catch { setError(signup ? 'Could not create the account. Check your details and try again.' : 'Could not sign in. Check your email, password, and email confirmation.'); }
    finally { setBusy(false); }
  }
  async function signOut() {
    setBusy(true); setError('');
    try { const result = await browserAuth()!.auth.signOut(); if (result.error) throw result.error; setSession(null); setPassword(''); }
    catch { setError('Could not sign out. Please try again.'); }
    finally { setBusy(false); }
  }
  if (local === undefined || !ready) return <main className="page-shell"><p role="status">Loading your workspace…</p></main>;
  return <>
    <div className="page-shell page-shell--narrow">
      {local && <div className="filter-bar"><Button onClick={() => setMode('local')} disabled={mode === 'local'}>Local workspace</Button><Button onClick={() => setMode('hosted')} disabled={mode === 'hosted'}>My hosted account</Button></div>}
      {mode === 'hosted' && <Card>
        <h2>{session ? 'Your hosted account' : 'Save your agents online'}</h2>
        {!configured ? <p>Hosted accounts are not connected yet. You can explore the templates below.</p> : session ? <><p>Signed in as {session.user.email}. Your agents and test history are private to this account.</p><Button disabled={busy} onClick={signOut}>Sign out</Button></> : <form onSubmit={event => { event.preventDefault(); void signIn(); }}>
          <p>{signup ? 'Create an account and confirm your email to save and test agents.' : 'Sign in to create, save, and test your own agents.'}</p>
          <label>Email<input type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} disabled={busy} /></label>
          <label>Password<input type="password" autoComplete={signup ? 'new-password' : 'current-password'} minLength={8} required value={password} onChange={event => setPassword(event.target.value)} disabled={busy} /></label>
          <Button type="submit" disabled={busy}>{busy ? 'Please wait…' : signup ? 'Create account' : 'Sign in'}</Button>
          <Button type="button" disabled={busy} onClick={() => { setSignup(!signup); setMessage(''); setError(''); }}>{signup ? 'Already have an account? Sign in' : 'Create an account'}</Button>
        </form>}
        {message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}
      </Card>}
    </div>
    <SummaryPreview key={mode === 'local' ? 'local' : session?.user.id ?? 'signed-out'} enabled={mode === 'local' ? enabled : enabled && hostedTestsEnabled}
      hosted={mode === 'hosted'} canSave={mode === 'local' || Boolean(session)} request={mode === 'hosted' ? hostedApi : undefined} />
  </>;
}
