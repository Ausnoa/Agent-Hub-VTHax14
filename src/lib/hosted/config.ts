export function hostedConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return undefined;
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) throw new Error('Invalid hosted configuration');
  // Only public client keys belong here. Secret/service-role credentials bypass RLS.
  if (key.startsWith('sb_secret_')) throw new Error('Use a Supabase publishable key');
  if (!key.startsWith('sb_publishable_')) throw new Error('Use the Supabase publishable key from project API settings');
  return { url: parsed.origin, key };
}
