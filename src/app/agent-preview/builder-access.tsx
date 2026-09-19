"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { browserAuth, hostedApi } from '../../lib/hosted/browser';
import { useAccount } from '../../lib/hosted/use-account';
import SummaryPreview from './summary-preview';
import Button from '../../components/ui/button';
export default function BuilderAccess({enabled,hostedTestsEnabled}:{enabled:boolean;hostedTestsEnabled:boolean}){
  const account=useAccount();
  const [local,setLocal]=useState<boolean>(),[mode,setMode]=useState<'local'|'hosted'>('hosted');
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{const isLocal=['localhost','127.0.0.1'].includes(location.hostname);setLocal(isLocal);setMode(isLocal&&!new URLSearchParams(location.search).has('agent')?'local':'hosted');},[]);
  async function signOut(){setBusy(true);setError('');try{const result=await browserAuth()!.auth.signOut();if(result.error)throw result.error;}catch{setError('Could not sign out. Please try again.');}finally{setBusy(false);}}
  if(local===undefined||!account.ready)return <main className="page-shell"><p role="status">Loading your workspace…</p></main>;
  return <><div className="page-shell page-shell--narrow">
    {local&&<div className="filter-bar"><Button disabled={mode==='local'} onClick={()=>setMode('local')}>Local workspace</Button><Button disabled={mode==='hosted'} onClick={()=>setMode('hosted')}>My hosted account</Button></div>}
    {mode==='hosted'&&(account.session?<div><p>Signed in as {account.session.user.email}</p><Link href="/agents">My agents</Link> · <Link href="/execution">Test history</Link> <Button disabled={busy} onClick={signOut}>Sign out</Button></div>:<p><Link href="/login?next=/agent-preview">Sign in or create an account</Link> to save and test your agents.</p>)}
    {(error||account.error)&&<p role="alert">{error||account.error}</p>}
  </div><SummaryPreview key={mode==='local'?'local':account.session?.user.id??'signed-out'} enabled={mode==='local'?enabled:enabled&&hostedTestsEnabled} hosted={mode==='hosted'} canSave={mode==='local'||Boolean(account.session)} request={mode==='hosted'?hostedApi:undefined}/></>;
}
