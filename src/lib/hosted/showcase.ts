import type {Selection} from '../general/contracts.ts';
export const showcaseAgents=[
  {key:'brief',name:'Glorria Brief',id:'2076c6a9-5114-42c8-8d63-c76eabcea804',origin:'https://www.gloryforglorria.us',skill:'summarize-text',purpose:'Turn a wall of text into a clear brief.',role:'The storyteller'},
  {key:'extract',name:'Glorria Extract',id:'39f5e2f3-7b54-4153-8757-0fe0733c5393',origin:'https://extract.gloryforglorria.us',skill:'extract-information',purpose:'Pull exact details from source text. Leave missing facts unknown.',role:'The detail detective'},
  {key:'answers',name:'Glorria Answers',id:'51d689d3-146f-41d6-91dd-0966fc4d7aaa',origin:'https://ask.gloryforglorria.us',skill:'answer-from-reference',purpose:'Answer from your reference, with evidence you can check.',role:'The fact checker'},
] as const;
export const demoMenu='DEMO MENU — fictional brewery\nRiverlight Pale Ale: $7, 5.2% ABV.\nOrchard Cider: $8, 4.5% ABV, gluten-free.\nGarden Burger: $14, vegetarian.\nKitchen closes at 9 PM.';
export function showcaseDraft(key:string){
  const chosen=key==='all'?[showcaseAgents[1],showcaseAgents[0],showcaseAgents[2]]:showcaseAgents.filter(a=>a.key===key);
  if(!chosen.length)return undefined;
  const steps:Selection[]=chosen.map((a,i)=>({agentId:a.id,skill:a.skill,format:'text',inputFrom:key==='all'&&i===1?'previous':'original',instruction:a.key==='extract'?'Fields: pale ale price, cider price, gluten-free drink, vegetarian food, kitchen closing time\nSource:':a.key==='answers'?'Question: Which drink is explicitly gluten-free, and when does the kitchen close?\nReference:':'Summarize the supplied details. Do not add facts.'}));
  return {name:key==='all'?'Brewery menu · Three-agent demo':`${chosen[0].name} · Menu demo`,steps,input:demoMenu};
}
