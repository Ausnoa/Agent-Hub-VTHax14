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

test('the app contract states the real input and exact output shapes', () => {
  assert.equal(inputKind([transcribe, cards]), 'audio');
  assert.equal(inputKind([{ ...cards, inputFrom: 'original', format: 'json' }]), 'json');
  const contract = outputContract([transcribe, cards]);
  assert.equal(contract.outputs[0].shape, '{ type: "text", value: string }');
  assert.match(contract.outputs[1].shape, /cards: \[\{ front: string, back: string \}\]/);
});

test('capability configs with and without a generated app both parse', () => {
  const base = { version: 1, intent: 'Study', ui: defaultUI('Study', [transcribe]), suggestions: [], unresolved: [], generation: 'specialists' };
  assert.equal(capabilityConfigSchema.safeParse(base).success, true);
  const view = { version: 1, html: minimal, generatedAt: new Date().toISOString(), sample: [{ type: 'text', value: 'Sample transcript' }] };
  assert.equal(capabilityConfigSchema.safeParse({ ...base, view }).success, true);
  assert.equal(viewSchema.safeParse({ ...view, sample: [{ type: 'text', value: 'x'.repeat(2900) }, { type: 'text', value: 'x'.repeat(2900) }, { type: 'text', value: 'x'.repeat(2900) }] }).success, false, 'samples stay small');
});
