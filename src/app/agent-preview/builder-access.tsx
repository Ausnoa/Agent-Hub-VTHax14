"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { browserAuth, hostedApi } from '../../lib/hosted/browser';
import { useAccount } from '../../lib/hosted/use-account';
import SummaryPreview from './summary-preview';
import Button from '../../components/ui/button';
import SegmentedControl from '../../components/ui/segmented-control';
export default function BuilderAccess({enabled,hostedTestsEnabled}:{enabled:boolean;hostedTestsEnabled:boolean}){
  const account=useAccount();
  const [local,setLocal]=useState<boolean>(),[mode,setMode]=useState<'local'|'hosted'>('hosted');
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{const isLocal=['localhost','127.0.0.1'].includes(location.hostname);setLocal(isLocal);setMode(isLocal&&!new URLSearchParams(location.search).has('agent')?'local':'hosted');},[]);
  async function signOut(){setBusy(true);setError('');try{const result=await browserAuth()!.auth.signOut();if(result.error)throw result.error;}catch{setError('Could not sign out. Please try again.');}finally{setBusy(false);}}
  if(local===undefined||!account.ready)return <main className="page-shell"><p role="status">Loading your workspace…</p></main>;
  return <><div className="page-shell page-shell--narrow">
    {local&&<div className="workspace-toggle">
      <span className="eyebrow"><span className="line" />Local dev</span>
      <SegmentedControl
        label="Workspace"
        value={mode}
        onChange={setMode}
        options={[{value:'local',label:'Local workspace'},{value:'hosted',label:'My hosted account'}]}
      />
    </div>}
    {mode==='hosted'&&(account.session?<div className="account-bar">
      <p className="account-bar-user">Signed in as <strong>{account.session.user.email}</strong></p>
      <div className="account-bar-links">
        <Link href="/agents">My agents</Link>
        <Link href="/execution">Test history</Link>
        <Button variant="ghost" size="sm" disabled={busy} onClick={signOut}>Sign out</Button>
      </div>
    </div>:<p><Link href="/login?next=/agent-preview">Sign in or create an account</Link> to save and test your agents.</p>)}
    {(error||account.error)&&<p role="alert">{error||account.error}</p>}
  </div><SummaryPreview key={mode==='local'?'local':account.session?.user.id??'signed-out'} enabled={mode==='local'?enabled:enabled&&hostedTestsEnabled} hosted={mode==='hosted'} canSave={mode==='local'||Boolean(account.session)} request={mode==='hosted'?hostedApi:undefined}/></>;
}
