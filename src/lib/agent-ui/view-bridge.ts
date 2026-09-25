import { z } from 'zod';
import { VIEW_HTML_LIMIT } from '../capabilities/contracts.ts';
import type { GeneralStep } from '../general/contracts.ts';

// A generated app is untrusted code. It runs in an opaque-origin iframe (sandbox="allow-scripts",
// no allow-same-origin) under a host-written CSP with no network, and talks to Glorria only
// through the messages below. It can present outputs and ask for a run; only the host runs.

export type InputKind = 'audio' | 'json' | 'text';
/** What the first step really accepts; a run request must match it. */
export function inputKind(steps: Pick<GeneralStep, 'inputFrom' | 'format'>[]): InputKind {
  const original = steps.filter(step => step.inputFrom === 'original');
  return original.some(step => step.format === 'audio') ? 'audio' : original.some(step => step.format === 'json') ? 'json' : 'text';
}

/** Exact runtime shape of run.data[i] as the app receives it: already parsed, never wrapped. */
const shapes = {
  text: 'string',
  flashcards: '{ cards: [{ front: string, back: string }] }',
  quiz: '{ questions: [{ question: string, options: string[], answer: number /* zero-based index into options */, explanation: string }] }',
} as const;
/** The app sees plain output data; the typed Value wrapper stays on the host side. */
export const outputData = (outputs: { type: string; value: unknown }[]) => outputs.map(output => output.type === 'audio' ? null : output.value);
export type OutputContract = { input: InputKind; outputs: { index: number; name: string; source: string; shape: string }[] };
export function outputContract(steps: GeneralStep[]): OutputContract {
  return {
    input: inputKind(steps),
    outputs: steps.map((step, index) => ({
      index, name: step.name,
      source: step.geminiTask ? `gemini:${step.geminiTask}` : 'external ANS agent (free-form text)',
      shape: step.geminiTask === 'flashcards' ? shapes.flashcards : step.geminiTask === 'quiz' ? shapes.quiz : shapes.text,
    })),
  };
}

/** The API the frontend specialist writes against. Kept next to the shim that implements it. */
export const BRIDGE_API = `The app runs in a sandboxed iframe with no network. Use only window.glorria:
- glorria.onInit(fn): fn({ mode: "full"|"compact", preview: boolean, agent: { title, input: "audio"|"json"|"text", outputs: [{ index, name, shape }] }, savedState: any|null, history: [{ id, status, createdAt }] })
- glorria.onRun(fn): fn({ id, status: "idle"|"queued"|"running"|"ready"|"completed"|"failed", data: any[], error: string|null }). data[i] is agent.outputs[i]'s content, already parsed, in exactly its shape (a string for text outputs, an object for structured ones; never a JSON string, never wrapped). data is shorter while running and may be empty. Called for new runs, progress, and when a past run is opened.
- glorria.requestRun(input): Promise<{ result: "accepted"|"declined"|"error", message? }>. input must match agent.input: { type: "text", value: string } | { type: "json", value: object } | the audio object returned by glorria.readAudioFile/recordAudio (pass it through unchanged). Glorria shows its own confirmation before anything runs.
- glorria.readAudioFile(file: File): Promise<Value> (WebM, Ogg, WAV, MP3, or MP4, at most 1 MB; rejects otherwise).
- glorria.recordAudio(): Promise<Value|null> (Glorria's recorder, up to 60 seconds).
- glorria.openRun(runId): load a past run; delivered through onRun.
- glorria.saveState(json): persist small per-viewer state (progress, starred items, settings), returned as savedState next time.
- glorria.download(filename, content, mimeType): save a file the app builds from run data (mimeType "text/plain"|"text/markdown"|"text/csv"|"application/json"). The sandbox blocks direct downloads.
- glorria.copy(text): copy text to the clipboard. The sandbox blocks direct clipboard access.
- glorria.ready(): call once when your UI is set up (before or inside onInit). If it is never called, Glorria replaces the app with its standard interface.
Theme variables: --g-bg, --g-surface, --g-surface-2, --g-text, --g-muted, --g-border, --g-accent, --g-accent-soft, --g-agent, --g-good, --g-warn, --g-bad, --g-radius, --g-font, --g-font-display, --g-font-mono.`;

const idSchema = z.string().min(1).max(64);
/** Every message the app may send. Anything else is ignored. */
export const appMessageSchema = z.discriminatedUnion('type', [
  // Sent by the host-written shim when the document loads; the host answers with init and run.
  z.object({ type: z.literal('glorria:hello') }),
  z.object({ type: z.literal('glorria:ready') }),
  z.object({ type: z.literal('glorria:resize'), height: z.number().finite().min(0).max(20000) }),
  z.object({ type: z.literal('glorria:saveState'), state: z.unknown() }),
  z.object({ type: z.literal('glorria:requestRun'), requestId: idSchema, input: z.unknown() }),
  z.object({ type: z.literal('glorria:openRun'), runId: idSchema }),
  z.object({ type: z.literal('glorria:recordAudio'), requestId: idSchema }),
  z.object({ type: z.literal('glorria:error'), message: z.string().max(500) }),
  z.object({ type: z.literal('glorria:download'), filename: z.string().trim().min(1).max(100).regex(/^[^\\/:*?"<>|]+$/), content: z.string().max(500_000), mimeType: z.enum(['text/plain', 'text/markdown', 'text/csv', 'application/json']) }),
  z.object({ type: z.literal('glorria:copy'), text: z.string().max(200_000) }),
]);
export type AppMessage = z.infer<typeof appMessageSchema>;
export const MAX_VIEW_STATE = 50_000;

/**
 * Models often return a whole document. Keep the body and any head styles; the host supplies
 * the real document (and its CSP) around them.
 */
export function normalizeViewHtml(html: string): string {
  const body = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html);
  if (!body) return html.replace(/<!doctype[^>]*>|<\/?html[^>]*>|<\/?head[^>]*>|<\/?body[^>]*>/gi, '').trim();
  const head = html.slice(0, body.index);
  return [...head.matchAll(/<style[^>]*>[\s\S]*?<\/style>/gi)].map(m => m[0]).join('\n') + '\n' + body[1].trim();
}

const forbidden: [RegExp, string][] = [
  [/\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|importScripts|\bimport\s*\(/, 'network access'],
  [/<script[^>]*\bsrc\s*=|<link\b|<iframe\b|<object\b|<embed\b|<base\b|<meta\b/i, 'external or document-level elements'],
  [/https?:\/\/(?!www\.w3\.org\/)/i, 'external URLs'],
  [/\beval\s*\(|new\s+Function\b|setTimeout\s*\(\s*['"`]|setInterval\s*\(\s*['"`]/, 'dynamic code'],
  [/(?:window|self|globalThis|frames)\s*\.\s*(?:top|parent|opener)\b/, 'access to the host page'],
  [/\bpostMessage\s*\(/, 'direct messaging (use window.glorria)'],
  [/document\.cookie|\b(?:localStorage|sessionStorage|indexedDB)\b|serviceWorker|\bWorker\s*\(/, 'browser storage or workers (use glorria.saveState)'],
  [/(?:window|document|self)\s*\.\s*location\b|\blocation\s*\.\s*(?:href|assign|replace)\b|window\.open\s*\(|<form[^>]*\baction\s*=/i, 'navigation'],
];
/** Defense in depth: the sandbox and CSP already block these; lint rejects apps that rely on them. */
export function lintView(html: string): string[] {
  const problems = forbidden.filter(([pattern]) => pattern.test(html)).map(([, reason]) => `Uses ${reason}`);
  if (html.length > VIEW_HTML_LIMIT) problems.push(`Is ${html.length} characters; the limit is ${VIEW_HTML_LIMIT}`);
  if (!/glorria\s*\.\s*ready\s*\(/.test(html)) problems.push('Never calls glorria.ready()');
  if (!/glorria\s*\.\s*onRun\s*\(/.test(html)) problems.push('Never renders runs (glorria.onRun)');
  return problems;
}

export type ViewTheme = Record<`--g-${string}`, string>;
const CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; font-src data:";
// Host-authored; the generated app cannot change it. Messages go only to the embedding page.
const SHIM = `(function(){
var last={},handlers={init:[],run:[]},waiting={},seq=0,ready=false,host=window.parent;
function send(m){host.postMessage(m,'*');}
function report(e){send({type:'glorria:error',message:String((e&&e.message)||e).slice(0,500)});}
window.addEventListener('error',function(e){report(e.error||e.message);});
window.addEventListener('unhandledrejection',function(e){report(e.reason);});
document.addEventListener('DOMContentLoaded',function(){send({type:'glorria:hello'});});
window.addEventListener('message',function(e){
  if(e.source!==host||!e.data||typeof e.data.type!=='string')return;var d=e.data,k=d.type.slice(8);
  if(k==='runResult'||k==='audio'){var w=waiting[d.requestId];if(w){delete waiting[d.requestId];w(k==='audio'?d.value:d);}return;}
  if(!handlers[k])return;last[k]=d.payload;handlers[k].forEach(function(h){try{h(d.payload);}catch(err){report(err);}});
});
function request(type,extra){var id='q'+(++seq);return new Promise(function(res){waiting[id]=res;var m={type:type,requestId:id};for(var key in extra)m[key]=extra[key];send(m);});}
var size=0;function measure(){var h=Math.ceil(document.documentElement.scrollHeight);if(h!==size){size=h;send({type:'glorria:resize',height:h});}}
window.glorria=Object.freeze({
  onInit:function(h){handlers.init.push(h);if(last.init)h(last.init);},
  onRun:function(h){handlers.run.push(h);if(last.run)h(last.run);},
  ready:function(){if(ready)return;ready=true;send({type:'glorria:ready'});if(window.ResizeObserver)new ResizeObserver(measure).observe(document.documentElement);measure();},
  requestRun:function(input){return request('glorria:requestRun',{input:input});},
  recordAudio:function(){return request('glorria:recordAudio',{});},
  openRun:function(id){send({type:'glorria:openRun',runId:String(id)});},
  saveState:function(s){send({type:'glorria:saveState',state:s});},
  download:function(name,content,mime){send({type:'glorria:download',filename:String(name),content:String(content),mimeType:mime||'text/plain'});},
  copy:function(text){send({type:'glorria:copy',text:String(text)});},
  readAudioFile:function(file){return new Promise(function(res,rej){
    var types=['audio/webm','audio/ogg','audio/wav','audio/mpeg','audio/mp4'],t=String(file&&file.type||'').split(';')[0];
    if(types.indexOf(t)<0)return rej(new Error('Use a WebM, Ogg, WAV, MP3, or MP4 audio file.'));
    if(!file.size||file.size>1000000)return rej(new Error('Audio must be at most 1 MB.'));
    var r=new FileReader();r.onload=function(){res({type:'audio',mimeType:t,value:String(r.result).split(',')[1]});};r.onerror=function(){rej(new Error('Could not read that file.'));};r.readAsDataURL(file);});}
});
})();`;
/** The complete sandboxed document: host CSP, theme, and bridge around the generated app. */
export function buildViewDocument(html: string, theme: ViewTheme): string {
  const vars = Object.entries(theme).filter(([key, value]) => /^--g-[a-z0-9-]+$/.test(key) && !/[;{}<>]/.test(value)).map(([key, value]) => `${key}:${value}`).join(';');
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${CSP}"><meta name="viewport" content="width=device-width,initial-scale=1">`
    + `<style>:root{${vars}}*{box-sizing:border-box}html,body{margin:0;background:var(--g-bg);color:var(--g-text);font-family:var(--g-font)}</style>`
    + `<script>${SHIM}</script></head><body>${normalizeViewHtml(html)}</body></html>`;
}
