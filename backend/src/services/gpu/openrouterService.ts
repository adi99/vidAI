import fetch from 'node-fetch';
import { CaptionProvider, CaptionParams } from './gpuProvider';

type OpenRouterConfig = {
  baseUrl: string; // https://openrouter.ai/api/v1
  apiKey: string;
  model: string; // e.g., openai/gpt-4o-mini or meta-llama/llama-3.2-vision
};

export class OpenRouterCaptionProvider implements CaptionProvider {
  public name = 'openrouter';
  private cfg: OpenRouterConfig;

  constructor(config?: Partial<OpenRouterConfig>) {
    this.cfg = {
      baseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY || '',
      model: process.env.OPENROUTER_CAPTION_MODEL || 'openai/gpt-4o-mini',
      ...config,
    };
  }

  async captionImage(params: CaptionParams, signal?: AbortSignal): Promise<{ caption: string; model?: string; latencyMs?: number; meta?: Record<string, any> }> {
    const url = `${this.cfg.baseUrl}/chat/completions`;

    // Compose a prompt for image captioning
    // Many OpenRouter vision models accept "image_url" in content parts.
    const body = {
      model: this.cfg.model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: params.prompt || 'Provide a concise but descriptive caption for the image.' },
            { type: 'image_url', image_url: params.imageUrl },
          ],
        },
      ],
      stream: false,
    };

    const start = Date.now();
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.cfg.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'https://your-app-domain.com',
        'X-Title': 'AI Video Generation App',
      },
      body: JSON.stringify(body),
      signal: signal as any,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`OpenRouter caption failed: ${res.status} ${res.statusText} ${text}`);
    }

    const json = await res.json().catch(() => ({} as any));
    // Expected OpenAI-style response shape
    const caption =
      json?.choices?.[0]?.message?.content ||
      json?.choices?.[0]?.text ||
      '';

    const latencyMs = Date.now() - start;
    return {
      caption,
      model: this.cfg.model,
      latencyMs,
      meta: json,
    };
  }
}