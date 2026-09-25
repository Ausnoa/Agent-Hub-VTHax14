import { z } from 'zod';
import { ModelProviderError, ModelServiceError } from '../planner/index.ts';

export type ModelOptions = { audio?: { mimeType: string; data: string }; maxOutputTokens?: number; /** Per-attempt limit for long generations such as app code. */ timeoutMs?: number };
export type StructuredModel = <S extends z.ZodType>(input: string, instructions: string, schema: S, options?: ModelOptions) => Promise<z.output<S>>;

/** Server-only provider boundary. Configuration never comes from a generated plan. */
export const gemini: StructuredModel = async (input, instructions, schema, options = {}) => {
  // GEMINI_MODEL may list fallbacks ("primary,backup"). Quota, overload, and
  // retired-model responses move to the next model; other failures do not.
  const key = process.env.GEMINI_API_KEY, models = (process.env.GEMINI_MODEL ?? '').split(',').map(m => m.trim()).filter(Boolean);
  if (!key || !models.length || models.some(model => !/^[a-zA-Z0-9._-]+$/.test(model))) throw new ModelServiceError('not-configured');
  let response: Response | undefined;
  // Audio transcription is the slowest call; it gets more time per attempt and overall.
  const perAttempt = options.timeoutMs ?? (options.audio ? 75_000 : 40_000);
  const deadline = AbortSignal.timeout(options.timeoutMs ? options.timeoutMs + 60_000 : options.audio ? 150_000 : 90_000);
  const body = JSON.stringify({ systemInstruction: { parts: [{ text: instructions }] },
    contents: [{ role: 'user', parts: [{ text: input }, ...(options.audio ? [{ inlineData: options.audio }] : [])] }],
    generationConfig: { responseMimeType: 'application/json', responseJsonSchema: z.toJSONSchema(schema), maxOutputTokens: options.maxOutputTokens ?? 4096 },
  });
  let timedOut = false;
  try {
    for (const [index, model] of models.entries()) {
      const last = index === models.length - 1;
      // Earlier models hand over immediately; only the last model spends time on bounded retries.
      for (let attempt = 0; ; attempt++) {
        try {
          response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body,
            signal: AbortSignal.any([deadline, AbortSignal.timeout(perAttempt)]),
          });
        } catch (error) {
          if (!(error instanceof Error && error.name === 'TimeoutError') || deadline.aborted || last) throw error;
          response = undefined; timedOut = true; break;
        }
        if (!last || ![502, 503, 504].includes(response.status) || attempt === 2) break;
        await response.body?.cancel();
        await new Promise(resolve => setTimeout(resolve, 500 * 2 ** attempt));
        deadline.throwIfAborted();
      }
      if (response && (![404, 429, 502, 503, 504].includes(response.status) || last)) break;
      await response?.body?.cancel();
    }
  } catch (error) { throw new ModelServiceError(error instanceof Error && error.name === 'TimeoutError' ? 'timeout' : 'connection-failed'); }
  if (!response) throw new ModelServiceError(timedOut ? 'timeout' : 'connection-failed');
  if (!response.ok) throw new ModelProviderError(response.status);
  try {
    const payload = await response.json();
    const candidate = payload.candidates?.[0];
    if (candidate?.finishReason !== 'STOP') throw new ModelServiceError(candidate?.finishReason === 'MAX_TOKENS' ? 'output-limit' : 'incomplete');
    const text = candidate.content?.parts?.filter((part: { thought?: boolean; text?: string }) => !part.thought && typeof part.text === 'string').map((part: { text: string }) => part.text).join('');
    return schema.parse(JSON.parse(text));
  } catch (error) { if (error instanceof ModelServiceError) throw error; throw new ModelServiceError('invalid-output'); }
};
