import test from 'node:test';
import assert from 'node:assert/strict';
import { lintView, buildViewDocument, normalizeViewHtml, appMessageSchema, inputKind, outputContract } from '../src/lib/agent-ui/view-bridge.ts';
import { capabilityConfigSchema, viewSchema, VIEW_HTML_LIMIT } from '../src/lib/capabilities/contracts.ts';
import { defaultUI } from '../src/lib/agent-ui/capability.ts';
import type { GeneralStep } from '../src/lib/general/contracts.ts';

const minimal = '<div id="app"></div><script>glorria.onRun(function(run){document.getElementById("app").textContent=run.status;});glorria.ready();</script>';
const transcribe: GeneralStep = { agentId: 'gemini:transcribe', geminiTask: 'transcribe', skill: 'transcribe', name: 'Transcript', endpoint: 'gemini:transcribe', metadataUrl: 'gemini:transcribe', format: 'audio', inputFrom: 'original', instruction: '' };
const cards: GeneralStep = { ...transcribe, agentId: 'gemini:flashcards', geminiTask: 'flashcards', skill: 'flashcards', name: 'Cards', endpoint: 'gemini:flashcards', metadataUrl: 'gemini:flashcards', format: 'text', inputFrom: 'previous', inputStep: 0 };

test('a minimal generated app passes lint; network, host access, storage, and dynamic code do not', () => {
  assert.deepEqual(lintView(minimal), []);
  const svg = minimal + '<svg xmlns="http://www.w3.org/2000/svg"></svg><script>const parent=document.body;parent.appendChild(document.createElement("p"));const location={x:1};</script>';
  assert.deepEqual(lintView(svg), [], 'ordinary DOM code and SVG namespaces are allowed');
  for (const [code, reason] of [
    ['fetch("/api/general")', /network/], ['new XMLHttpRequest()', /network/], ['<script src="x.js"></script>', /external or document/],
    ['<img src="https://tracker.example/p.gif">', /external URLs/], ['eval("1")', /dynamic code/], ['window.parent.document', /host page/],
    ['window.top.location', /host page/], ['localStorage.setItem("a","b")', /storage/], ['document.cookie', /storage/],
    ['window.parent.postMessage({},"*")', /host page|direct messaging/], ['window.location.href="/x"', /navigation/], ['<meta http-equiv="refresh">', /document-level/],
  ] as const) assert.ok(lintView(minimal + `<script>${code}</script>`).some(p => reason.test(p)), `rejects ${code}`);
  assert.ok(lintView('<div></div>').includes('Never calls glorria.ready()'));
  assert.ok(lintView(minimal + 'x'.repeat(VIEW_HTML_LIMIT)).some(p => /limit/.test(p)));
});

test('the host document always carries its CSP and bridge, whatever the model returned', () => {
  const hostile = '<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src *"><style>.a{color:red}</style></head><body><p>Hi</p></body></html>';
  const doc = buildViewDocument(hostile, { '--g-accent': '#0ff', '--g-bad;x': 'red', '--g-bg': 'red;}body{x' } as never);
  assert.ok(doc.startsWith('<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src'), 'the host CSP comes first');
  assert.match(doc, /window\.glorria=Object\.freeze/);
  assert.match(doc, /--g-accent:#0ff/);
  assert.doesNotMatch(doc, /--g-bad|red;\}body/, 'theme values cannot inject CSS');
  assert.equal(normalizeViewHtml(hostile), '<style>.a{color:red}</style>\n<p>Hi</p>', 'a full document is reduced to its styles and body');
});

test('bridge messages from the app are validated', () => {
  assert.equal(appMessageSchema.safeParse({ type: 'glorria:ready' }).success, true);
  assert.equal(appMessageSchema.safeParse({ type: 'glorria:requestRun', requestId: 'q1', input: { type: 'text', value: 'x' } }).success, true);
  assert.equal(appMessageSchema.safeParse({ type: 'glorria:invoke', url: '/api' }).success, false);
  assert.equal(appMessageSchema.safeParse({ type: 'glorria:resize', height: Infinity }).success, false);
  assert.equal(appMessageSchema.safeParse({ type: 'glorria:openRun', runId: 'x'.repeat(65) }).success, false);
});

test('the app contract states the real input and exact output shapes', async () => {
  assert.equal(inputKind([transcribe, cards]), 'audio');
  assert.equal(inputKind([{ ...cards, inputFrom: 'original', format: 'json' }]), 'json');
  const contract = outputContract([transcribe, cards]);
  assert.equal(contract.outputs[0].shape, 'string');
  assert.equal(contract.outputs[1].shape, '{ cards: [{ front: string, back: string }] }', 'the app receives parsed data, never a wrapper');
  const { outputData } = await import('../src/lib/agent-ui/view-bridge.ts');
  assert.deepEqual(outputData([{ type: 'text', value: 'T' }, { type: 'json', value: { cards: [] } }, { type: 'audio', value: 'AAAA' }]), ['T', { cards: [] }, null]);
});

test('capability configs with and without a generated app both parse', () => {
  const base = { version: 1, intent: 'Study', ui: defaultUI('Study', [transcribe]), suggestions: [], unresolved: [], generation: 'specialists' };
  assert.equal(capabilityConfigSchema.safeParse(base).success, true);
  const view = { version: 1, html: minimal, generatedAt: new Date().toISOString(), sample: [{ type: 'text', value: 'Sample transcript' }] };
  assert.equal(capabilityConfigSchema.safeParse({ ...base, view }).success, true);
  assert.equal(viewSchema.safeParse({ ...view, sample: [{ type: 'text', value: 'x'.repeat(2900) }, { type: 'text', value: 'x'.repeat(2900) }, { type: 'text', value: 'x'.repeat(2900) }] }).success, false, 'samples stay small');
});

function team(options: { html?: string; revised?: string; approve?: boolean; sample?: unknown[]; fail?: string } = {}) {
  const calls: string[] = []; let inFlight = 0, overlap = 0;
  const generate = (async (input: string, rules: string, schema: { parse: (value: unknown) => unknown }) => {
    const role = rules.includes('Revise your app') ? 'revise' : rules.includes('reviewing') ? (rules.startsWith('You are the backend') ? 'backend-review' : 'product-review')
      : rules.startsWith('You are the frontend') ? 'frontend' : rules.startsWith('You are the backend') ? 'backend' : 'product';
    calls.push(role); inFlight++; overlap = Math.max(overlap, inFlight);
    await new Promise(resolve => setTimeout(resolve, 5)); inFlight--;
    if (options.fail === role) throw new Error('provider overloaded');
    if (role === 'product') return schema.parse({ journey: 'Record, then study', modes: [{ name: 'Flashcards', purpose: 'Recall' }], interactions: ['flip'], states: 'Clear', feel: 'Like a study app' });
    if (role === 'backend') return schema.parse({ allowed: ['flip cards'], excluded: [{ interaction: 'Ask the tutor', reason: 'No answer step' }], notes: 'cards live in value.cards', sample: options.sample ?? ['Sample transcript', JSON.stringify({ cards: [{ front: 'Q', back: 'A' }] })] });
    if (role === 'frontend') return schema.parse({ html: options.html ?? minimal, summary: 'Study app' });
    if (role === 'revise') { assert.ok(JSON.parse(input).issues.length, 'revision receives the reviewers\' issues'); return schema.parse({ html: options.revised ?? minimal, summary: 'Revised' }); }
    return schema.parse({ approved: options.approve ?? true, issues: options.approve === false ? ['Quiz answers are not scored'] : [] });
  }) as never;
  return { generate, calls, overlap: () => overlap };
}
const designInput = async (generate: never) => {
  const { designView } = await import('../src/lib/capabilities/view-design.ts');
  return designView({ intent: 'Study lectures', name: 'Study', steps: [transcribe, cards], ui: defaultUI('Study', [transcribe, cards]), generate });
};

test('specialists brief and review in parallel, and the frontend revises only when a reviewer objects', async () => {
  const approved = team();
  const view = await designInput(approved.generate);
  assert.ok(view);
  assert.deepEqual(approved.calls.slice(0, 2).sort(), ['backend', 'product']);
  assert.equal(approved.calls[2], 'frontend');
  assert.deepEqual(approved.calls.slice(3).sort(), ['backend-review', 'product-review']);
  assert.equal(approved.overlap(), 2, 'round 1 and the review round each run two specialists at once');
  assert.equal(view.sample.length, 2);
  const objection = team({ approve: false, revised: minimal.replace('run.status', 'run.status+" (revised)"') });
  const revised = await designInput(objection.generate);
  assert.equal(objection.calls.at(-1), 'revise');
  assert.match(revised!.html, /revised/);
});

test('an app that fails lint, or a failing specialist, leaves the component interface in place', async () => {
  assert.equal(await designInput(team({ html: minimal + '<script>fetch("/api/general")</script>', revised: minimal + '<script>fetch("/x")</script>' }).generate), undefined);
  const fixed = team({ html: minimal + '<script>fetch("/api/general")</script>' });
  assert.ok(await designInput(fixed.generate), 'lint problems are sent back for one revision');
  assert.equal(fixed.calls.at(-1), 'revise');
  assert.equal(await designInput(team({ fail: 'frontend' }).generate), undefined);
});

test('preview samples must match each real output shape exactly', async () => {
  const wrong = await designInput(team({ sample: ['Transcript', 'not cards'] }).generate);
  assert.ok(wrong); assert.deepEqual(wrong.sample, [], 'mismatched samples are dropped, the app is kept');
});
