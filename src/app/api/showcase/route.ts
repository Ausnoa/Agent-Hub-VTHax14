import {showcaseAgents} from '../../../lib/hosted/showcase';
export const runtime='nodejs';
export async function GET(){
  const agents=await Promise.all(showcaseAgents.map(async agent=>{
    let live=false;
    try{const response=await fetch(`${agent.origin}/.well-known/agent-card.json`,{redirect:'error',signal:AbortSignal.timeout(5000),next:{revalidate:60}});if(response.ok){const card=await response.json();live=card.url===`${agent.origin}/a2a`&&card.protocolVersion==='0.3.0'&&card.skills?.some((s:{id:string})=>s.id===agent.skill);}}catch{}
    return {key:agent.key,live};
  }));
  return Response.json({agents,checkedAt:new Date().toISOString()});
}
