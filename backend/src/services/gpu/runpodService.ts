import fetch from 'node-fetch';
import { GPUProvider, ImageParams, VideoParams, GenerationResult, HealthStatus } from './gpuProvider';
import { logger } from '../../config/logger';

// Type shim to satisfy TS when exactOptionalPropertyTypes is enabled
type MaybeSignal = AbortSignal | undefined;

type RunpodConfig = {
  baseUrl: string; // https://api.runpod.ai
  apiKey: string;
  imageEndpointId: string; // serverless endpoint id for image
  videoEndpointId: string; // serverless endpoint id for video
  pollIntervalMs: number;
  healthPath?: string; // optional
};

type RunpodStartResp = { id: string };
type RunpodStatusResp = {
  status: 'COMPLETED' | 'IN_PROGRESS' | 'FAILED' | string;
  output?: any;
  error?: any;
};

export class RunpodProvider implements GPUProvider {
  public name = 'runpod';
  private cfg: RunpodConfig;

  constructor(config?: Partial<RunpodConfig>) {
    this.cfg = {
      baseUrl: process.env.RUNPOD_BASE_URL || 'https://api.runpod.ai',
      apiKey: process.env.RUNPOD_API_KEY || '',
      imageEndpointId: process.env.RUNPOD_IMAGE_ENDPOINT_ID || '',
      videoEndpointId: process.env.RUNPOD_VIDEO_ENDPOINT_ID || '',
      pollIntervalMs: parseInt(process.env.RUNPOD_POLL_INTERVAL_MS || '3000', 10),
      healthPath: process.env.RUNPOD_HEALTH_PATH || '/v2/health',
      ...config,
    };
  }

  async health(signal?: AbortSignal): Promise<HealthStatus> {
    const start = Date.now();
    try {
      // Runpod may not have a generic health endpoint; do a lightweight auth check by hitting list of endpoints (if available)
      const url = `${this.cfg.baseUrl}/v2/${this.cfg.imageEndpointId}/status`;
      const res = await fetch(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.cfg.apiKey}` },
        signal: signal as any,
      });
      const ok = res.status < 500; // treat 4xx as auth/endpoint misconfig but still respond
      return {
        ok,
        provider: this.name,
        latencyMs: Date.now() - start,
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
    return this.invokeAndPoll({
      endpointId: this.cfg.imageEndpointId,
      input: {
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
      },
      parseOutput: (output: any) => ({
        status: output?.image_url ? 'completed' : 'started',
        imageUrl: output?.image_url,
        meta: output,
      }),
      signal: (signal ?? undefined) as MaybeSignal,
    });
  }

  async generateVideo(params: VideoParams, signal?: AbortSignal): Promise<GenerationResult> {
    return this.invokeAndPoll({
      endpointId: this.cfg.videoEndpointId,
      input: {
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
      },
      parseOutput: (output: any) => ({
        status: output?.video_url ? 'completed' : 'started',
        videoUrl: output?.video_url,
        meta: output,
      }),
      signal: (signal ?? undefined) as MaybeSignal,
    });
  }

  private async invokeAndPoll(opts: {
    endpointId: string;
    input: any;
    parseOutput: (output: any) => Partial<GenerationResult>;
    signal?: AbortSignal | undefined;
  }): Promise<GenerationResult> {
    const startUrl = `${this.cfg.baseUrl}/v2/${opts.endpointId}/run`;
    const res = await fetch(startUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.cfg.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ input: opts.input }),
      signal: opts.signal as any,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Runpod start failed: ${res.status} ${res.statusText} ${text}`);
    }
    const startJson = (await res.json().catch(() => ({}))) as RunpodStartResp;
    const jobId = (startJson as any).id || (startJson as any).jobId;
    if (!jobId) {
      throw new Error('Runpod did not return a job id');
    }

    // Poll
    const statusUrl = `${this.cfg.baseUrl}/v2/${opts.endpointId}/status/${jobId}`;
    while (true) {
      // Basic delay
      await new Promise((r) => setTimeout(r, this.cfg.pollIntervalMs));
      const st = await fetch(statusUrl, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.cfg.apiKey}` },
        signal: opts.signal as any,
      });
      if (!st.ok) {
        const text = await st.text().catch(() => '');
        throw new Error(`Runpod status failed: ${st.status} ${st.statusText} ${text}`);
      }
      const statusJson = (await st.json().catch(() => ({}))) as RunpodStatusResp;
      const status = statusJson.status?.toUpperCase();

      if (status === 'COMPLETED') {
        const parsed = opts.parseOutput(statusJson.output);
        return {
          status: 'completed',
          provider: this.name,
          providerJobId: jobId,
          ...parsed,
        } as GenerationResult;
      } else if (status === 'FAILED') {
        const errMsg = statusJson.error ? JSON.stringify(statusJson.error) : 'Unknown error';
        throw new Error(`Runpod job failed: ${errMsg}`);
      } else if (status === 'IN_PROGRESS' || status === 'PROCESSING' || status === 'QUEUED') {
        // keep polling
        continue;
      } else {
        // Unknown state, keep polling a bit more but log
        logger.warn('Runpod unknown job state', { jobId, status });
      }
    }
  }
}