import { redirect } from 'next/navigation';

// The studio became the unified creation flow; saved agents live on their profile pages.
export default async function StudioPage({ searchParams }: { searchParams: Promise<{ agent?: string | string[] }> }) {
  const { agent } = await searchParams;
  redirect(typeof agent === 'string' && /^[0-9a-f-]{36}$/i.test(agent) ? `/agents/${agent}` : '/create');
}
