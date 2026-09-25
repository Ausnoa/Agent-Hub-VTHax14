import { z } from 'zod';
import { selectionSchema, valueSchema, draftSchema } from '../general/contracts.ts';
import { capabilityConfigSchema, revisionSchema } from '../capabilities/contracts.ts';
import { validateUI } from '../agent-ui/capability.ts';
export const hostedWorkflowSchema = z.object({
  name:z.string().trim().min(1).max(100),
  description:z.string().trim().max(300).default(''),
  steps:z.array(selectionSchema.extend({name:z.string().max(200),endpoint:z.string().max(2000),metadataUrl:z.string().max(2000)})).min(1).max(8),
  capability: capabilityConfigSchema.optional(),
  revision: revisionSchema.optional(),
}).superRefine((value,ctx)=>{
  if(!draftSchema.safeParse(value).success)ctx.addIssue({code:'custom',message:'Invalid capability graph'});
  if(value.capability){try{validateUI(value.capability.ui,value.steps);}catch{ctx.addIssue({code:'custom',message:'Invalid capability interface bindings'});}}
});
export const workflowRowSchema=z.object({id:z.uuid(),definition:hostedWorkflowSchema,created_at:z.string(),visibility:z.enum(['public','private']),owner_id:z.uuid(),archived:z.boolean().default(false)});
export const workflowRunSchema=z.object({id:z.uuid(),workflow_id:z.uuid(),input:valueSchema,status:z.enum(['ready','running','completed','failed']),outputs:z.array(valueSchema).max(8),error:z.string().nullable(),started_at:z.string().nullable(),created_at:z.string()});
export type HostedWorkflow=z.infer<typeof workflowRowSchema>;
export type HostedRun=z.infer<typeof workflowRunSchema>;
export type Candidate={agentId:string;name:string;description:string|null;skills:{id:string;name:string;tags:string[]}[];source:'template'|'ans';endpoint?:string};
