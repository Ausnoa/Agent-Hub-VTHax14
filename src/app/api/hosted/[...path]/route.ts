import { handleHostedApi } from '../../../../lib/hosted/handler.ts';
import { handleWorkflowApi } from '../../../../lib/hosted/workflow-handler.ts';
import { handleProfileApi } from '../../../../lib/hosted/profile-handler.ts';
import { handleDiscoverApi } from '../../../../lib/hosted/discover-handler.ts';
import { handleSavedApi } from '../../../../lib/hosted/saved-handler.ts';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;
async function handle(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const {path}=await context.params;
  if (['registry','workflows'].includes(path[0])) return handleWorkflowApi(request,path);
  if (['profile','profiles'].includes(path[0])) return handleProfileApi(request,path);
  if (path[0]==='discover') return handleDiscoverApi(request,path);
  if (path[0]==='saved') return handleSavedApi(request,path);
  return handleHostedApi(request,path);
}
export const GET = handle;
export const POST = handle;
export const DELETE = handle;
