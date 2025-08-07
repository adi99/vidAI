import fetch from 'node-fetch';
import { GPUProvider, ImageParams, VideoParams, GenerationResult, HealthStatus } from './gpuProvider';

type ModalConfig = {
  baseUrl: string; // e.g., https://api.modal.com
  apiKey: string;
  imageFunctionPath: string; // e.g., /v1/functions/your-org/image-generate
  videoFunctionPath: string; // e.g., /v1/functions/your-org/video-generate
  healthPath?: string; // optional health endpoint
};

export class ModalProvider implements GPUProvider {
  public name = 'modal';
  private cfg: ModalConfig;

  constructor(config?: Partial<ModalConfig>) {
    this.cfg = {
      baseUrl: process.env.MODAL_BASE_URL || 'https://api.modal.com',
      apiKey: process.env.MODAL_API_KEY || '',
      imageFunctionPath: process.env.MODAL_IMAGE_PATH || '/v1/functions/image-generate',
      videoFunctionPath: process.env.MODAL_VIDEO_PATH || '/v1/functions/video-generate',
      healthPath: process.env.MODAL_HEALTH_PATH || '/v1/health',
      ...config,
    };
  }

  async health(signal?: AbortSignal): Promise<HealthStatus> {
    const url = `${this.cfg.baseUrl}${this.cfg.healthPath}`;
    const start = Date.now();
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.cfg.apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: signal as any,
      });
      const ok = res.ok;
      const latencyMs = Date.now() - start;
      return {
        ok,
        provider: this.name,
        latencyMs,
        details: { status: res.status, statusText: res.statusText },
        checkedAt: new Date().toISOString(),
      };
    } catch (err: any) {
      return {
        ok: false,
        provider: this.name,
        details: { error: err?.message || String(err) },
        checkedAt: new Date().toISOString(),
      };
    }
  }

  async generateImage(params: ImageParams, signal?: AbortSignal): Promise<GenerationResult> {
    const url = `${this.cfg.baseUrl}${this.cfg.imageFunctionPath}`;
    const body = {
      prompt: params.prompt,
      negative_prompt: params.negativePrompt,
      width: params.width,
      height: params.height,
      steps: params.steps,
      guidance: params.guidance,
      seed: params.seed,
      init_image_url: params.initImageUrl,
      strength: params.strength,
      metadata: params.metadata,
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.cfg.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: signal as any,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Modal image generate failed: ${res.status} ${res.statusText} ${text}`);
    }
    const json = await res.json().catch(() => ({} as any));
    // Expectation: { status, job_id?, image_url? }
    const result: GenerationResult = {
      status: json.status || (json.image_url ? 'completed' : 'started'),
      imageUrl: json.image_url,
      provider: this.name,
      providerJobId: json.job_id,
      meta: json.meta || json,
    };
    return result;
  }

  async generateVideo(params: VideoParams, signal?: AbortSignal): Promise<GenerationResult> {
    const url = `${this.cfg.baseUrl}${this.cfg.videoFunctionPath}`;
    const body = {
      prompt: params.prompt,
      negative_prompt: params.negativePrompt,
      init_image_url: params.initImageUrl,
      frames_urls: params.framesUrls,
      num_frames: params.numFrames,
      fps: params.fps,
      width: params.width,
      height: params.height,
      seed: params.seed,
      metadata: params.metadata,
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.cfg.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: signal as any,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Modal video generate failed: ${res.status} ${res.statusText} ${text}`);
    }
    const json = await res.json().catch(() => ({} as any));
    const result: GenerationResult = {
      status: json.status || (json.video_url ? 'completed' : 'started'),
      videoUrl: json.video_url,
      provider: this.name,
      providerJobId: json.job_id,
      meta: json.meta || json,
    };
    return result;
  }
}