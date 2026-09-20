import { z } from 'zod';
import { HostedError, type Identity } from './server.ts';
import { workflowRowSchema,workflowRunSchema,hostedWorkflowSchema } from './workflow-contracts.ts';
const columns='id,definition,created_at,visibility,owner_id,archived';
export function workflowRepository({client,userId}:Identity){
  const unavailable=()=>new HostedError(503,'Workflow storage is unavailable. Apply the hosted workflow migration in Supabase.');
  return {
    async budget(action:'search'|'plan'){
      const {data,error}=await client.rpc('reserve_workflow_budget',{action});
      if(error)throw unavailable();
      if(!data)throw new HostedError(429,`Daily ${action} limit reached. Try again tomorrow UTC.`);
    },
    async list(archived=false){const {data,error}=await client.from('hosted_workflows').select(columns).eq('owner_id',userId).eq('archived',archived).order('created_at',{ascending:false}).limit(50);if(error)throw unavailable();return z.array(workflowRowSchema).parse(data);},
    // Not scoped to owner_id: RLS allows the owner or any signed-in user when the
    // workflow is public, so someone else's published composite can be opened and run.
    async get(id:string){const {data,error}=await client.from('hosted_workflows').select(columns).eq('id',id).maybeSingle();if(error)throw unavailable();if(!data)throw new HostedError(404,'Workflow not found');return workflowRowSchema.parse(data);},
    async save(input:unknown){const definition=hostedWorkflowSchema.parse(input);const {data,error}=await client.from('hosted_workflows').insert({owner_id:userId,definition}).select(columns).single();if(error)throw unavailable();return workflowRowSchema.parse(data);},
    async setArchived(id:string,archived:boolean){const {data,error}=await client.from('hosted_workflows').update({archived,...(archived?{visibility:'private'}:{})}).eq('owner_id',userId).eq('id',id).select(columns).maybeSingle();if(error)throw new HostedError(503,'Could not archive or restore workflow. Apply the archive migration in Supabase.');if(!data)throw new HostedError(404,'Workflow not found');return workflowRowSchema.parse(data);},
    async setVisibility(id:string,visibility:'public'|'private'){const {data,error}=await client.from('hosted_workflows').update({visibility}).eq('owner_id',userId).eq('id',id).select(columns).maybeSingle();if(error)throw unavailable();if(!data)throw new HostedError(404,'Workflow not found');return workflowRowSchema.parse(data);},
    async runs(){const {data,error}=await client.from('hosted_workflow_runs').select('id,workflow_id,input,status,outputs,error,started_at,created_at').eq('owner_id',userId).order('created_at',{ascending:false}).limit(20);if(error)throw unavailable();return z.array(workflowRunSchema).parse(data);},
    async run(id:string){const {data,error}=await client.from('hosted_workflow_runs').select('id,workflow_id,input,status,outputs,error,started_at,created_at').eq('owner_id',userId).eq('id',id).maybeSingle();if(error)throw unavailable();if(!data)throw new HostedError(404,'Run not found');return workflowRunSchema.parse(data);},
    async start(requestId:string,workflowId:string,input:unknown){const {data,error}=await client.rpc('start_hosted_workflow',{request_id:requestId,target_workflow:workflowId,source_input:input});if(error)throw new HostedError(409,'Could not start this run. Refresh its status before trying again.');if(!data)throw new HostedError(429,'Daily workflow limit reached (10 new runs).');return z.uuid().parse(data);},
    async claim(id:string,step:number){const {data,error}=await client.rpc('claim_hosted_step',{target_run:id,expected_step:step});if(error)throw unavailable();return data?z.uuid().parse(data):null;},
    async finish(id:string,token:string,output:unknown,failure:string|null){const {data,error}=await client.rpc('finish_hosted_step',{target_run:id,token,result_output:output,failure});if(error||!data)throw new HostedError(503,'Could not save step result. Refresh status; do not repeat the external action.');},
  };
}
export type WorkflowRepository=ReturnType<typeof workflowRepository>;
