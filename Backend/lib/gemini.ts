// BuildSmart AI — server-side Google Gemini wrapper.
//
// This module is the ONLY place that talks to the Gemini REST API. The API key
// is read from the server environment (GEMINI_API_KEY) and is never exposed to
// the browser. The public route is app/api/ai/gemini/route.ts.

import dotenv from 'dotenv';
import path from 'path';

if (!process.env.GEMINI_API_KEY) {
  dotenv.config({ quiet: true, path: path.resolve(process.cwd(), 'Frontend/.env.local') });
  dotenv.config({ quiet: true, path: path.resolve(process.cwd(), '.env') });
}

export type GeminiMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type GenerateResponse = {
  text: string;
  model: string;
  usage?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
};

export type GeminiCallError = Error & {
  status?: number;
  isNetworkError?: boolean;
  detail?: string;
};

export type GeminiOptions = {
  jsonMode?: boolean;
  temperature?: number;
  maxOutputTokens?: number;
};

// Model preference order. `gemini-3.6-flash` is Google's active model for v1beta,
// followed by `gemini-flash-latest` and other versions.
const MODELS = [
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3-flash-preview',
  'gemini-3.7-flash',
  'gemini-3.8-flash',
  'gemini-flash-latest',
];

async function generateWithModel(
  model: string,
  apiKey: string,
  systemInstruction: string,
  messages: GeminiMessage[],
  options?: GeminiOptions,
): Promise<GenerateResponse> {
  // Key is sent via the standard X-goog-api-key request header; it is never
  // placed in the URL or exposed to the browser.
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const contents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const body: any = {
    systemInstruction: { parts: [{ text: systemInstruction }] },
    contents,
    generationConfig: {
      temperature: options?.temperature ?? 0.7,
      topP: 0.95,
      maxOutputTokens: Math.max(1024, options?.maxOutputTokens ?? 4096),
      ...(options?.jsonMode ? { responseMimeType: 'application/json' } : {}),
    },
  };

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-goog-api-key': apiKey,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(45_000),
    });
  } catch (fetchErr: any) {
    // `TypeError: fetch failed` / aborted requests mean the network path to
    // Google is unavailable (e.g. sandboxed previews). Distinguish this from
    // an API configuration / credential problem so the caller can fall back
    // intelligently without hiding real errors behind a canned reply.
    const err: GeminiCallError = new Error(
      `Gemini network error: ${fetchErr?.message ?? 'unable to reach generativelanguage.googleapis.com'}`,
    );
    err.isNetworkError = true;
    err.status = 0;
    throw err;
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    const err: GeminiCallError = new Error(`Gemini request failed (${res.status})`);
    err.status = res.status;
    err.detail = detail.slice(0, 500);
    throw err;
  }

  const json = await res.json();
  const text = json?.candidates?.[0]?.content?.parts
    ?.map((p: any) => p?.text ?? '')
    .join('\n')
    .trim();

  if (!text) throw new Error('Gemini returned no content');

  return {
    text,
    model,
    usage: {
      promptTokenCount: json?.usageMetadata?.promptTokenCount,
      candidatesTokenCount: json?.usageMetadata?.candidatesTokenCount,
      totalTokenCount: json?.usageMetadata?.totalTokenCount,
    },
  };
}

/**
 * Call Gemini with a server-only system prompt and a conversation history.
 * Tries the preferred model first and falls back to older models for keys that
 * don't have the newest model enabled.
 */
export async function callGemini(
  systemInstruction: string,
  messages: GeminiMessage[],
  options?: GeminiOptions,
): Promise<GenerateResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const err = new Error('GEMINI_API_KEY is not configured on the server');
    (err as any).status = 503;
    throw err;
  }

  let lastErr: unknown;

  for (const model of MODELS) {
    try {
      return await generateWithModel(model, apiKey, systemInstruction, messages, options);
    } catch (err: any) {
      lastErr = err;
      // Only fall through for model-not-found / unsupported-model errors or 503 temporary overload.
      const detail = String(err?.detail ?? '');
      const modelUnavailable =
        err?.status === 404 ||
        err?.status === 503 ||
        detail.includes('Model not found') ||
        detail.includes('not found for API version') ||
        detail.includes('does not support');
      if (!modelUnavailable) throw err;
    }
  }

  throw lastErr ?? new Error('Gemini call failed');
}

/**
 * Call Gemini with image data (multimodal vision) to inspect and categorize architectural drawings.
 */
export async function callGeminiVision(
  prompt: string,
  base64Data: string,
  mimeType = 'image/jpeg',
  options?: GeminiOptions
): Promise<GenerateResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const err = new Error('GEMINI_API_KEY is not configured on the server');
    (err as any).status = 503;
    throw err;
  }

  let lastErr: unknown;
  const VISION_MODELS = [
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-3-flash-preview',
    'gemini-3.7-flash',
    'gemini-3.8-flash',
  ];

  for (const model of VISION_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
      const body: any = {
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType,
                  data: base64Data,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: options?.temperature ?? 0.2,
          topP: 0.95,
          maxOutputTokens: Math.max(1024, options?.maxOutputTokens ?? 2048),
          ...(options?.jsonMode ? { responseMimeType: 'application/json' } : {}),
        },
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-goog-api-key': apiKey,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(45_000),
      });

      if (!res.ok) {
        const errorDetail = await res.text().catch(() => '');
        console.warn(`[callGeminiVision] Model ${model} returned ${res.status}:`, errorDetail.slice(0, 200));
        continue;
      }
      const json = await res.json();
      const text = json?.candidates?.[0]?.content?.parts
        ?.map((p: any) => p?.text ?? '')
        .join('\n')
        .trim();

      if (text) {
        return { text, model };
      }
    } catch (err) {
      lastErr = err;
    }
  }

  throw lastErr || new Error('Gemini vision call failed');
}
