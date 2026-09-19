import { handleHostedApi } from '../../../../lib/hosted/handler.ts';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
async function handle(request: Request, context: { params: Promise<{ path: string[] }> }) {
  return handleHostedApi(request, (await context.params).path);
}
export const GET = handle;
export const POST = handle;
