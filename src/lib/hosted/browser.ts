"use client";
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { hostedConfig } from './config';
let client: SupabaseClient | undefined;
export function browserAuth() {
  const config = hostedConfig();
  if (!config) return undefined;
  return client ??= createClient(config.url, config.key);
}
export async function hostedApi<T>(path: string, value?: unknown): Promise<T> {
  const auth = browserAuth();
  if (!auth) throw new Error('Hosted accounts are not configured yet');
  const { data, error } = await auth.auth.getSession();
  if (error || !data.session) throw new Error('Sign in to continue');
  const response = await fetch(`/api/hosted/${path.replace(/^owned/, 'agents')}`, {
    method: value === undefined ? 'GET' : 'POST',
    headers: { Authorization: `Bearer ${data.session.access_token}`, ...(value === undefined ? {} : { 'Content-Type': 'application/json' }) },
    ...(value === undefined ? {} : { body: JSON.stringify(value) }),
  });
  const result = await response.json();
  if(response.status===401){
    // A revoked/expired session must not keep redirecting the login page into a broken workspace.
    const current=await auth.auth.getSession();
    if(current.data.session?.access_token===data.session.access_token)await auth.auth.signOut({scope:'local'});
    throw new Error('Your session could not be verified. Please sign in again.');
  }
  if (!response.ok) throw new Error(result.error ?? 'Request failed');
  return result as T;
}
