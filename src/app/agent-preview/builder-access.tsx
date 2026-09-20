"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { hostedApi } from '../../lib/hosted/browser';
import { useAccount } from '../../lib/hosted/use-account';
import SummaryPreview from './summary-preview';
import SegmentedControl from '../../components/ui/segmented-control';
export default function BuilderAccess({enabled,hostedTestsEnabled}:{enabled:boolean;hostedTestsEnabled:boolean}){
  const account=useAccount();
  const [local,setLocal]=useState<boolean>(),[mode,setMode]=useState<'local'|'hosted'>('hosted');
  useEffect(()=>{const isLocal=['localhost','127.0.0.1'].includes(location.hostname);setLocal(isLocal);setMode(isLocal&&!new URLSearchParams(location.search).has('agent')?'local':'hosted');},[]);
  if(local===undefined||!account.ready)return <main className="page-shell"><p role="status">Loading your workspace…</p></main>;
  // Account chrome (signed-in email, sign out) now lives on /profile/settings; this page keeps
  // only what belongs to building an agent, so nothing pushes "Your purpose. Your agent." down
  // when there is nothing else to show.
  const showBar=local||(mode==='hosted'&&!account.session)||account.error;
  return <>
    {showBar&&<div className="page-shell page-shell--narrow">
      {local&&<div className="workspace-toggle">
        <span className="eyebrow"><span className="line" />Local dev</span>
        <SegmentedControl
          label="Workspace"
          value={mode}
          onChange={setMode}
          options={[{value:'local',label:'Local workspace'},{value:'hosted',label:'My hosted account'}]}
        />
      </div>}
      {mode==='hosted'&&!account.session&&<p><Link href="/login?next=/agent-preview">Sign in or create an account</Link> to save and test your agents.</p>}
      {account.error&&<p role="alert">{account.error}</p>}
    </div>}
    <SummaryPreview key={mode==='local'?'local':account.session?.user.id??'signed-out'} enabled={mode==='local'?enabled:enabled&&hostedTestsEnabled} hosted={mode==='hosted'} canSave={mode==='local'||Boolean(account.session)} request={mode==='hosted'?hostedApi:undefined}/>
  </>;
}
