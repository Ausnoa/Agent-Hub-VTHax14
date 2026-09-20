import { z } from 'zod';
import { ModelProviderError,ModelServiceError } from '../planner/index.ts';
import { authenticate,repository,HostedError } from './server.ts';
import { readBody,respond,checkOrigin } from './handler.ts';
import { workflowRepository } from './workflow-store.ts';
import { prepareHosted,searchHosted,suggestHosted,advanceHosted,workflowServices } from './workflow-service.ts';
import { valueSchema } from '../general/contracts.ts';
export const hostedWorkflowDependencies={authenticate,agents:repository,workflows:workflowRepository,services:workflowServices,enabled:()=>process.env.HOSTED_AGENT_TESTS_ENABLED==='true'};
export async function handleWorkflowApi(request:Request,path:string[],deps=hostedWorkflowDependencies){
  try{
    checkOrigin(request);
    const identity=await deps.authenticate(request),agents=deps.agents(identity),store=deps.workflows(identity);
    if(path.join('/')==='registry/search'&&request.method==='POST'){
      const input=z.object({query:z.string().trim().max(256),pageToken:z.string().max(4000).optional()}).parse(await readBody(request));
      await store.budget('search');return respond(await searchHosted(input.query,input.pageToken,agents,deps.services));
    }
    if(path.join('/')==='workflows/suggest'&&request.method==='POST'){
      if(!deps.enabled())throw new HostedError(503,'Hosted model requests are not enabled');
      const input=z.object({description:z.string().trim().min(10).max(2000),query:z.string().trim().max(256)}).parse(await readBody(request));
      await store.budget('plan');await store.budget('search');
      const results=await searchHosted(input.query,undefined,agents,deps.services);
      // Own templates are always available to the planner, even if the search phrase differs.
      const own=await agents.list();
      const {templateFor}=await import('../owned-agent/templates.ts');
      for(const agent of own)if(!results.candidates.some(c=>c.agentId===`template:${agent.id}`))results.candidates.push({agentId:`template:${agent.id}`,name:agent.name,description:agent.instructions||templateFor(agent.template).description,source:'template',skills:[{id:templateFor(agent.template).skill,name:templateFor(agent.template).name,tags:[]}]});
      return respond({draft:await suggestHosted(input.description,results.candidates,deps.services),candidates:results.candidates});
    }
    if(path.join('/')==='workflows'){
      if(request.method==='GET')return respond(await store.list(new URL(request.url).searchParams.get('archived')==='true'));
      if(request.method==='POST')return respond(await store.save(await prepareHosted(await readBody(request),agents,deps.services)),201);
    }
    if(path[0]==='workflows'&&path.length===3&&path[2]==='archive'&&request.method==='POST'){const {archived}=z.object({archived:z.boolean()}).parse(await readBody(request));return respond(await store.setArchived(z.uuid().parse(path[1]),archived));}
    if(path.join('/')==='workflows/runs'&&request.method==='GET')return respond(await store.runs());
    if(path[0]==='workflows'&&path[1]==='runs'&&path.length>=3){
      const id=z.uuid().parse(path[2]);const run=await store.run(id);
      if(path.length===3&&request.method==='GET')return respond(run);
      if(path.length===4&&path[3]==='advance'&&request.method==='POST'){
        if(!deps.enabled())throw new HostedError(503,'Hosted execution is not enabled');
        const input=z.object({expectedStep:z.number().int().min(0).max(8),confirmExternalExecution:z.literal(true)}).parse(await readBody(request));
        return respond(await advanceHosted(run,input.expectedStep,store,agents,deps.services));
      }
    }
    if(path[0]==='workflows'&&path.length===3&&path[2]==='invoke'&&request.method==='POST'){
      if(!deps.enabled())throw new HostedError(503,'Hosted execution is not enabled');
      const id=z.uuid().parse(path[1]);await store.get(id);
      const input=z.object({requestId:z.uuid(),input:valueSchema,confirmExternalExecution:z.literal(true)}).parse(await readBody(request));
      const runId=await store.start(input.requestId,id,input.input);return respond(await store.run(runId),201);
    }
    if(path[0]==='workflows'&&path.length===3&&path[2]==='visibility'&&request.method==='POST'){
      const id=z.uuid().parse(path[1]);
      const {visibility}=z.object({visibility:z.enum(['public','private'])}).parse(await readBody(request));
      return respond(await store.setVisibility(id,visibility));
    }
    if(path[0]==='workflows'&&path.length===2&&path[1]!=='runs'&&request.method==='GET'){
      return respond(await store.get(z.uuid().parse(path[1])));
    }
    throw new HostedError(404,'Route not found');
  }catch(error){
    if(error instanceof ModelProviderError || error instanceof ModelServiceError)return respond({error:error.message},503);
    if(error instanceof HostedError)return respond({error:error.message},error.status);
    if(error instanceof z.ZodError)return respond({error:'Invalid workflow input or incompatible response'},400);
    return respond({error:'Workflow request failed. Check ANS availability and server configuration; no automatic retry.'},502);
  }
}
