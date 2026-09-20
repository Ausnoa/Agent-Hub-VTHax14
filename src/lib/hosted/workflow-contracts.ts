import { z } from 'zod';
import { selectionSchema, valueSchema } from '../general/contracts.ts';
export const hostedWorkflowSchema = z.object({
  name:z.string().trim().min(1).max(100),
  steps:z.array(selectionSchema.extend({name:z.string().max(200),endpoint:z.string().max(2000),metadataUrl:z.string().max(2000)})).min(1).max(8),
}).refine(value=>value.steps[0].inputFrom==='original','First step needs original input');
export const workflowRowSchema=z.object({id:z.uuid(),definition:hostedWorkflowSchema,created_at:z.string()});
export const workflowRunSchema=z.object({id:z.uuid(),workflow_id:z.uuid(),input:valueSchema,status:z.enum(['ready','running','completed','failed']),outputs:z.array(valueSchema).max(8),error:z.string().nullable(),started_at:z.string().nullable(),created_at:z.string()});
export type HostedWorkflow=z.infer<typeof workflowRowSchema>;
export type HostedRun=z.infer<typeof workflowRunSchema>;
export type Candidate={agentId:string;name:string;description:string|null;skills:{id:string;name:string;tags:string[]}[];source:'template'|'ans';endpoint?:string};
