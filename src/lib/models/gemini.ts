import { z } from 'zod';
import { ModelProviderError, ModelServiceError } from '../planner/index.ts';

export type ModelOptions = { audio?: { mimeType: string; data: string }; maxOutputTokens?: number };
export type StructuredModel = <S extends z.ZodType>(input: string, instructions: string, schema: S, options?: ModelOptions) => Promise<z.output<S>>;

/** Server-only provider boundary. Configuration never comes from a generated plan. */
export const gemini: StructuredModel = async (input, instructions, schema, options = {}) => {
  const key = process.env.GEMINI_API_KEY, model = process.env.GEMINI_MODEL;
  if (!key || !model || !/^[a-zA-Z0-9._-]+$/.test(model)) throw new ModelServiceError('not-configured');
  let response: Response;
  try {
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      signal: AbortSignal.timeout(45_000),
      body: JSON.stringify({ systemInstruction: { parts: [{ text: instructions }] },
        contents: [{ role: 'user', parts: [{ text: input }, ...(options.audio ? [{ inlineData: options.audio }] : [])] }],
        generationConfig: { responseMimeType: 'application/json', responseJsonSchema: z.toJSONSchema(schema), maxOutputTokens: options.maxOutputTokens ?? 4096 },
      }),
    });
  } catch (error) { throw new ModelServiceError(error instanceof Error && error.name === 'TimeoutError' ? 'timeout' : 'connection-failed'); }
  if (!response.ok) throw new ModelProviderError(response.status);
  try {
    const payload = await response.json();
    const candidate = payload.candidates?.[0];
    if (candidate?.finishReason !== 'STOP') throw new ModelServiceError(candidate?.finishReason === 'MAX_TOKENS' ? 'output-limit' : 'incomplete');
    const text = candidate.content?.parts?.filter((part: { thought?: boolean; text?: string }) => !part.thought && typeof part.text === 'string').map((part: { text: string }) => part.text).join('');
    return schema.parse(JSON.parse(text));
  } catch (error) { if (error instanceof ModelServiceError) throw error; throw new ModelServiceError('invalid-output'); }
};
