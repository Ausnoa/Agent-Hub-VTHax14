"use client";
import "./login.css";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { browserAuth } from '../../lib/hosted/browser';
import { useAccount } from '../../lib/hosted/use-account';
import { loginTarget } from '../../lib/hosted/login-target';
import PageShell from '../../components/layout/page-shell';
import PageHeader from '../../components/layout/page-header';
import Card from '../../components/ui/card';
import Button from '../../components/ui/button';
export default function LoginPage(){
  const account=useAccount();const router=useRouter();
  const [email,setEmail]=useState(''),[password,setPassword]=useState('');
  const [signup,setSignup]=useState(false),[busy,setBusy]=useState(false);
  const [message,setMessage]=useState(''),[error,setError]=useState('');
  useEffect(()=>{if(account.session)router.replace(loginTarget(new URLSearchParams(location.search).get('next')));},[account.session,router]);
  async function submit(){
    setBusy(true);setError('');setMessage('');
    try{
      const client=browserAuth();if(!client)throw new Error('Not configured');
      const result=signup?await client.auth.signUp({email,password,options:{emailRedirectTo:`${location.origin}/dashboard`}}):await client.auth.signInWithPassword({email,password});
      if(result.error)throw result.error;
      setPassword('');if(signup&&!result.data.session)setMessage('Check your email to confirm your account, then sign in.');
    }catch{setError(signup?'Could not create the account. Check your details and try again.':'Could not sign in. Check your email, password, and email confirmation.');}
    finally{setBusy(false);}
  }
  return <PageShell narrow className="login-page"><PageHeader eyebrow="YOUR AGENT WORKSPACE" title={signup?'Create your account':'Welcome back'} description="Save your agents, test them, and keep your results in one private workspace."/>
    <Card>{!account.ready?<p role="status">Loading sign-in…</p>:!account.configured?<p>Hosted accounts are not configured yet.</p>:account.session?<p role="status">Opening your workspace…</p>:<form onSubmit={event=>{event.preventDefault();void submit();}}>
      <label>Email<input type="email" autoComplete="email" required value={email} disabled={busy} onChange={event=>setEmail(event.target.value)}/></label>
      <label>Password<input type="password" autoComplete={signup?'new-password':'current-password'} minLength={8} required value={password} disabled={busy} onChange={event=>setPassword(event.target.value)}/></label>
      <Button variant="primary" block type="submit" disabled={busy}>{busy?'Please wait…':signup?'Create account':'Sign in'}</Button>
      <Button type="button" disabled={busy} onClick={()=>{setSignup(!signup);setError('');setMessage('');}}>{signup?'Already have an account? Sign in':'Create an account'}</Button>
    </form>}{(error||account.error)&&<p role="alert">{error||account.error}</p>}{message&&<p role="status">{message}</p>}</Card>
    <Link href="/agent-preview">Explore templates without signing in →</Link>
  </PageShell>;
}
