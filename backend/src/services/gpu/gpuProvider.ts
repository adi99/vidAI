// GPU Provider interfaces and orchestrator-level types

export type ImageParams = {
  prompt: string;
  negativePrompt?: string | undefined;
  width?: number | undefined;
  height?: number | undefined;
  steps?: number | undefined;
  guidance?: number | undefined;
  seed?: number | undefined;
  // optional image-to-image input
  initImageUrl?: string | undefined;
  strength?: number | undefined;
  // extra params
  metadata?: Record<string, any> | undefined;
};

export type VideoParams = {
  prompt: string;
  negativePrompt?: string | undefined;
  // source image or frames for i2v / keyframe modes
  initImageUrl?: string | undefined;
  framesUrls?: string[] | undefined;
  numFrames?: number | undefined;
  fps?: number | undefined;
  width?: number | undefined;
  height?: number | undefined;
  seed?: number | undefined;
  metadata?: Record<string, any> | undefined;
};

export type CaptionParams = {
  imageUrl: string;
  prompt?: string;
  metadata?: Record<string, any>;
};

export type GenerationResult = {
  status: 'started' | 'completed' | 'failed';
  // Either remote URLs or buffers (if provider returns raw)
  imageUrl?: string;
  videoUrl?: string;
  // Raw payload for debugging and storage
  provider: string;
  providerJobId?: string;
  latencyMs?: number;
  meta?: Record<string, any>;
  error?: string;
};

export type HealthStatus = {
  ok: boolean;
  provider: string;
  latencyMs?: number;
  details?: Record<string, any>;
  checkedAt: string;
};

export interface GPUProvider {
  name: string;
  health(signal?: AbortSignal): Promise<HealthStatus>;
  generateImage(params: ImageParams, signal?: AbortSignal): Promise<GenerationResult>;
  generateVideo(params: VideoParams, signal?: AbortSignal): Promise<GenerationResult>;
}

export interface CaptionProvider {
  name: string;
  captionImage(params: CaptionParams, signal?: AbortSignal): Promise<{ caption: string; model?: string; latencyMs?: number; meta?: Record<string, any> }>;
}

// Circuit breaker states
export type CircuitState = 'closed' | 'open' | 'half_open';

export type ProviderCircuit = {
  failures: number;
  lastFailureAt?: number;
  state: CircuitState;
  cooldownUntil?: number;
};

export type OrchestratorOptions = {
  timeoutMs?: number;
  retryAttempts?: number;
  primary?: string;   // 'modal' | 'runpod'
  fallback?: string;  // 'runpod' | 'modal'
  failureThreshold?: number; // open circuit after N consecutive failures
  cooldownMs?: number;       // keep circuit open for this long
};