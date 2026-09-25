import { interfaceSchema, extraKinds, type CapabilityUI } from '../capabilities/contracts.ts';
import type { GeneralStep } from '../general/contracts.ts';

export function defaultUI(name: string, steps: GeneralStep[]): CapabilityUI {
  return { title: name, description: 'Run the resolved capabilities with your source material.', layout: 'tabs', inputLabel: steps.some(s => s.format === 'audio') ? 'Source audio (up to 1 MB)' : 'Source material', actionLabel: 'Run agent', panels: steps.map((s, step) => ({ step, title: s.name.slice(0, 80), component: s.geminiTask === 'flashcards' ? 'flashcards' : s.geminiTask === 'quiz' ? 'quiz' : 'text' })), primaryPanel: Math.max(0, steps.length - 1), extras: [...extraKinds] };
}
/** Shared by persistence and presentation: a layout cannot invent executable bindings. */
export function validateUI(input: unknown, steps: GeneralStep[]): CapabilityUI {
  const ui = interfaceSchema.parse(input);
  if (ui.panels.length !== steps.length || new Set(ui.panels.map(p => p.step)).size !== steps.length) throw new Error('UI must expose each executable output exactly once');
  for (const panel of ui.panels) {
    const step = steps[panel.step];
    if (!step || (panel.component === 'flashcards' && step.geminiTask !== 'flashcards') || (panel.component === 'quiz' && step.geminiTask !== 'quiz')) throw new Error('UI refers to an unsupported capability');
  }
  if (ui.primaryPanel !== undefined && !steps[ui.primaryPanel]) throw new Error('UI primary panel refers to a missing capability');
  if (ui.extras && new Set(ui.extras).size !== ui.extras.length) throw new Error('UI repeats a supporting section');
  return ui;
}
/** Interfaces saved before `extras` existed show every supporting section. */
export const uiExtras = (ui: CapabilityUI | undefined) => new Set(ui?.extras ?? extraKinds);
