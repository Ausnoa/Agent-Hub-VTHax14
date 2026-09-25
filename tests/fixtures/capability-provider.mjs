// Manual browser acceptance fixture. Never loaded by application code.
// Run with NODE_OPTIONS="--import ./tests/fixtures/capability-provider.mjs",
// CAPABILITY_TEST_FIXTURE=1, and an isolated COMPOSER_DB.
if (process.env.CAPABILITY_TEST_FIXTURE !== '1' || !process.env.COMPOSER_DB?.includes('capability-browser')) {
  throw new Error('Capability browser fixture requires an explicitly isolated test database');
}
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  const address = String(url instanceof Request ? url.url : url);
  if (address.startsWith('https://api.godaddy.com/v1/ans/')) return Response.json({ items: [] });
  if (!address.startsWith('https://generativelanguage.googleapis.com/')) return originalFetch(url, init);
  const body = JSON.parse(String(init?.body));
  const rules = body.systemInstruction.parts[0].text;
  const input = JSON.parse(body.contents[0].parts[0].text);
  let result;
  if (rules.startsWith('Decompose')) {
    const base = input.existingSteps.length;
    const request = input.request.toLowerCase();
    const tasks = request.includes('flashcard') ? ['flashcards'] : request.includes('quiz') ? ['quiz'] : request.includes('speech') || request.includes('study') ? ['transcribe','summarize'] : request.includes('extract') ? ['extract'] : ['summarize'];
    result = { name: '[Fixture] Study tool', capabilities: tasks.map((task,i) => ({label:task,query:task,task,format:task==='transcribe'?'audio':'text',inputStep:base ? Math.min(1,base-1) : i-1,instruction:''})) };
  } else if (rules.includes('agent/product specialist')) {
    result = { workflow: 'Source, summary, and practice', suggestions: ['Generate flashcards','Generate a practice quiz'] };
  } else if (rules.includes('frontend specialist')) {
    result = { ...input.baseline, description:'Deterministic browser fixture — no live provider calls.', panels:input.baseline.panels.map(panel=>({...panel,title:panel.title[0].toUpperCase()+panel.title.slice(1)})) };
  } else if (rules.includes('backend specialist')) result = input.proposedUI;
  else if (rules.startsWith('Create useful')) result = {cards:[{front:'What drives evaporation?',back:'Energy from the sun.'}]};
  else if (rules.startsWith('Create practice')) result = {questions:[{question:'What drives evaporation?',options:['Sunlight','Gravity'],answer:0,explanation:'The fixture lecture describes solar energy.'}]};
  else if (rules.startsWith('Transcribe')) result = {text:'[Fixture transcript] Sunlight drives evaporation in the water cycle.'};
  else result = {text:`[Fixture output] ${String(input.source).slice(0,500)}`};
  return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(result)}]}}]});
};
