"use client";
import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { browserAuth } from './browser';
export function useAccount() {
  const [session,setSession]=useState<Session|null>(null);
  const [ready,setReady]=useState(false);
  const [configured,setConfigured]=useState(false);
  const [error,setError]=useState('');
  useEffect(()=>{
    let active=true;
    try {
      const client=browserAuth();setConfigured(Boolean(client));
      if(!client){setReady(true);return;}
      const {data}=client.auth.onAuthStateChange((_event,next)=>{if(active){setSession(next);setReady(true);}});
      client.auth.getSession().then(({data,error})=>{if(active){setSession(data.session);setReady(true);if(error)setError('Please sign in again.');}}).catch(()=>{if(active){setReady(true);setError('Sign-in is unavailable. Please try again.');}});
      return()=>{active=false;data.subscription.unsubscribe();};
    }catch{setReady(true);setError('Hosted accounts are not configured correctly.');}
  },[]);
  return {session,ready,configured,error};
}
