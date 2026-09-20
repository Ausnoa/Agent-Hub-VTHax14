"use client";
import {useEffect,useState} from 'react';
import {hostedApi} from '../../lib/hosted/browser';
import Button from '../ui/button';
export function ArchiveButton({kind,id,name,restore=false,onChanged}:{kind:'agents'|'workflows';id:string;name:string;restore?:boolean;onChanged?:()=>void}){
 const [confirm,setConfirm]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function change(){setBusy(true);setError('');try{await hostedApi(`${kind}/${id}/archive`,{archived:!restore});setConfirm(false);window.dispatchEvent(new Event('hosted-workspace-changed'));onChanged?.();}catch(e){setError(e instanceof Error?e.message:'Could not update archive');}finally{setBusy(false);}}
 return <div>{confirm?<div><p>Archive “{name}”? It will be hidden and made private. History stays saved; restore it below to use it again. Workflows using an archived agent cannot start new tests with it.</p><Button disabled={busy} onClick={()=>void change()}>{busy?'Archiving…':'Confirm archive'}</Button> <Button disabled={busy} onClick={()=>setConfirm(false)}>Cancel</Button></div>:<Button size="sm" disabled={busy} onClick={()=>restore?void change():setConfirm(true)}>{busy?'Restoring…':restore?'Restore':'Archive'}</Button>}{error&&<p role="alert">{error}</p>}</div>;
}
export function ArchivedItems({kind,onChanged}:{kind:'agents'|'workflows';onChanged?:()=>void}){
 const [items,setItems]=useState<{id:string;name?:string;definition?:{name:string}}[]>([]),[error,setError]=useState(''),[open,setOpen]=useState(false);
 useEffect(()=>{if(!open)return;let active=true;const refresh=()=>hostedApi<typeof items>(`${kind}?archived=true`).then(data=>{if(active){setItems(data);setError('');}}).catch(e=>{if(active)setError(e.message);});void refresh();window.addEventListener('hosted-workspace-changed',refresh);return()=>{active=false;window.removeEventListener('hosted-workspace-changed',refresh);};},[kind,open]);
 return <details style={{margin:'24px 0'}} onToggle={e=>setOpen(e.currentTarget.open)}><summary>Archived {kind}</summary><p className="hint">History is preserved. Restored items stay private until you publish them again.</p>{error&&<p role="alert">{error}</p>}{items.map(item=><div key={item.id} style={{padding:12}}><strong>{item.name??item.definition?.name}</strong><ArchiveButton kind={kind} id={item.id} name={item.name??item.definition?.name??'Item'} restore onChanged={onChanged}/></div>)}{!items.length&&!error&&<p>No archived {kind}.</p>}</details>;
}
