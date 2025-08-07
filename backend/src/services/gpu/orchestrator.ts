import { logger } from '../../config/logger';
import {
  GPUProvider,
  CaptionProvider,
  ImageParams,
  VideoParams,
  CaptionParams,
  GenerationResult,
  HealthStatus,
  ProviderCircuit,
  OrchestratorOptions,
} from './gpuProvider';

export class GPUOrchestrator {
  private providers: Map<string, GPUProvider>;
  private captioner: CaptionProvider | undefined;
  private circuits: Map<string, ProviderCircuit>;
  private opts: Required<OrchestratorOptions>;

  constructor(
    providers: GPUProvider[],
    options?: OrchestratorOptions,
    captioner?: CaptionProvider
  ) {
    this.providers = new Map(providers.map((p) => [p.name, p]));
    this.captioner = captioner ?? undefined;
    this.circuits = new Map();
    const {
      timeoutMs = parseInt(process.env.GPU_TIMEOUT_MS || '60000', 10),
      retryAttempts = parseInt(process.env.GPU_RETRY_ATTEMPTS || '2', 10),
      primary = process.env.GPU_PRIMARY || 'modal',
      fallback = process.env.GPU_FALLBACK || 'runpod',
      failureThreshold = 3,
      cooldownMs = 60_000,
    } = options || {};
    this.opts = { timeoutMs, retryAttempts, primary, fallback, failureThreshold, cooldownMs };

    // Initialize circuits
    for (const name of this.providers.keys()) {
      this.circuits.set(name, { failures: 0, state: 'closed' });
    }
  }

  async healthAll(): Promise<HealthStatus[]> {
    const checks: Promise<HealthStatus>[] = [];
    for (const p of this.providers.values()) {
      checks.push(this.safeHealth(p));
    }
    return Promise.all(checks);
  }

  async captionImage(params: CaptionParams): Promise<{ caption: string; model?: string; latencyMs?: number; meta?: Record<string, any> }> {
    if (!this.captioner) {
      throw new Error('No caption provider configured');
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.opts.timeoutMs);
    try {
      const res = await this.captioner.captionImage(params, controller.signal);
      return res;
    } finally {
      clearTimeout(timeout);
    }
  }

  async generateImage(params: ImageParams): Promise<GenerationResult> {
    return this.withFailover('image', params, async (provider, signal) => {
      const start = Date.now();
      const res = await provider.generateImage(params, signal);
      res.latencyMs = Date.now() - start;
      return res;
    });
  }

  async generateVideo(params: VideoParams): Promise<GenerationResult> {
    return this.withFailover('video', params, async (provider, signal) => {
      const start = Date.now();
      const res = await provider.generateVideo(params, signal);
      res.latencyMs = Date.now() - start;
      return res;
    });
  }

  private async withFailover<TParams>(
    kind: 'image' | 'video',
    _params: TParams,
    exec: (provider: GPUProvider, signal: AbortSignal) => Promise<GenerationResult>
  ): Promise<GenerationResult> {
    const order = this.getProviderOrder();
    let lastError: any;

    for (let attempt = 0; attempt <= this.opts.retryAttempts; attempt++) {
      for (const name of order) {
        const provider = this.providers.get(name);
        if (!provider) continue;
        if (!this.isUsable(name)) {
          logger.warn('Provider circuit open - skipping', { provider: name, kind });
          continue;
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.opts.timeoutMs);

        try {
          const res = await exec(provider, controller.signal);
          if (res.status === 'completed' || res.status === 'started') {
            this.onSuccess(name);
            return res;
          }
          // treat non-completed as failure to try next
          throw new Error(`Provider ${name} returned status ${res.status}`);
        } catch (err: any) {
          lastError = err;
          this.onFailure(name);
          logger.error('GPU provider failed', { provider: name, attempt, kind, err: err?.message || String(err) });
        } finally {
          clearTimeout(timeout);
        }
      }
    }

    throw new Error(`All GPU providers failed for ${kind}: ${lastError?.message || String(lastError)}`);
  }

  private getProviderOrder(): string[] {
    const a = this.opts.primary.toLowerCase();
    const b = this.opts.fallback.toLowerCase();
    const uniq = Array.from(new Set([a, b]));
    return uniq.filter((name) => this.providers.has(name));
  }

  private isUsable(name: string): boolean {
    const c = this.circuits.get(name);
    if (!c) return true;
    if (c.state === 'open') {
      const now = Date.now();
      if (c.cooldownUntil && now >= c.cooldownUntil) {
        // Half-open trial
        c.state = 'half_open';
        this.circuits.set(name, c);
        return true;
      }
      return false;
    }
    return true;
  }

  private onSuccess(name: string) {
    const c = this.circuits.get(name);
    if (!c) return;
    c.failures = 0;
    c.state = 'closed';
    delete c.cooldownUntil;
    this.circuits.set(name, c);
  }

  private onFailure(name: string) {
    const c = this.circuits.get(name);
    if (!c) return;
    c.failures += 1;
    c.lastFailureAt = Date.now();

    if (c.state === 'half_open') {
      // failed during trial - open again
      c.state = 'open';
      c.cooldownUntil = Date.now() + this.opts.cooldownMs;
    } else if (c.failures >= this.opts.failureThreshold) {
      c.state = 'open';
      c.cooldownUntil = Date.now() + this.opts.cooldownMs;
    }
    this.circuits.set(name, c);
    logger.warn('Provider circuit updated after failure', { provider: name, state: c.state, failures: c.failures });
  }

  private async safeHealth(p: GPUProvider): Promise<HealthStatus> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.min(10_000, this.opts.timeoutMs));
    try {
      const res = await p.health(controller.signal);
      return res;
    } catch (err: any) {
      return {
        ok: false,
        provider: p.name,
        details: { error: err?.message || String(err) },
        checkedAt: new Date().toISOString(),
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

// Simple factory that reads env to construct orchestrator later in workers
export function createDefaultGPUOrchestrator(deps: {
  providers: GPUProvider[];
  captioner?: CaptionProvider;
  options?: OrchestratorOptions;
}) {
  const orchestrator = new GPUOrchestrator(deps.providers, deps.options, deps.captioner);
  return orchestrator;
}