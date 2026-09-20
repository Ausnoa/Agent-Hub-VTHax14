import { handleHostedApi } from '../../../../lib/hosted/handler.ts';
import { handleWorkflowApi } from '../../../../lib/hosted/workflow-handler.ts';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;
async function handle(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const {path}=await context.params;
  return ['registry','workflows'].includes(path[0]) ? handleWorkflowApi(request,path) : handleHostedApi(request,path);
}
export const GET = handle;
export const POST = handle;
