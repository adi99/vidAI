import { supabase } from '@/lib/supabase';

// Types for video generation
export interface VideoGenerationRequest {
  prompt: string;
  negative_prompt?: string;
  generation_type: 'text_to_video' | 'image_to_video' | 'keyframe';
  input_data?: {
    init_image_url?: string;
    first_frame_url?: string;
    last_frame_url?: string;
    model?: string;
    aspect_ratio?: string;
    motion_strength?: number;
  };
  duration_seconds?: number;
  fps?: number;
  width?: number;
  height?: number;
  metadata?: Record<string, any>;
}

export interface TextToVideoRequest {
  prompt: string;
  negative_prompt?: string;
  model: string;
  duration_seconds: number;
  aspect_ratio: '16:9' | '9:16' | '1:1' | '4:3';
  quality: 'basic' | 'standard' | 'high';
  motion_strength: number;
  metadata?: Record<string, any>;
}

export interface ImageToVideoRequest {
  init_image_url: string;
  prompt?: string;
  negative_prompt?: string;
  model: string;
  duration_seconds: number;
  motion_strength: number;
  aspect_ratio: '16:9' | '9:16' | '1:1' | '4:3';
  quality: 'basic' | 'standard' | 'high';
  metadata?: Record<string, any>;
}

export interface FrameInterpolationRequest {
  first_frame_url: string;
  last_frame_url: string;
  duration_seconds: number;
  fps: number;
  interpolation_method: 'linear' | 'smooth' | 'dynamic';
  quality: 'basic' | 'standard' | 'high';
  metadata?: Record<string, any>;
}

export interface GenerationResponse {
  status: string;
  jobId: string;
  queue: string;
  cost: number;
  generationType?: string;
  timestamp: string;
}

export interface JobStatusResponse {
  status: string;
  jobId: string;
  queue: string;
  state: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed';
  progress: number;
  result?: {
    status: string;
    provider: string;
    videoUrl?: string;
    imageUrl?: string;
    thumbnailUrl?: string;
    latencyMs: number;
    error?: string;
  };
  timestamp: string;
}

export interface GenerationHistoryItem {
  id: string;
  content_type: 'video' | 'image';
  prompt: string;
  status: string;
  progress: number;
  media_url?: string;
  thumbnail_url?: string;
  credits_used: number;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  is_public: boolean;
  created_at: string;
  completed_at?: string;
}

export interface GenerationHistoryResponse {
  status: string;
  generations: GenerationHistoryItem[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
  filters: {
    content_type: string;
    status: string;
  };
  timestamp: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  description: string;
  speed: 'fast' | 'medium' | 'slow';
  credits_per_image?: number;
  credits_per_second?: number;
  max_resolution?: string;
  max_duration?: number;
  features: string[];
}

export interface ModelsResponse {
  status: string;
  models: {
    image: ModelInfo[];
    video: ModelInfo[];
    training: ModelInfo[];
  };
  timestamp: string;
}

class VideoGenerationService {
  private baseUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Unable to connect to server. Please check your internet connection.');
      }
      throw error;
    }
  }

  // Generate video from text prompt
  async generateTextToVideo(request: TextToVideoRequest): Promise<GenerationResponse> {
    try {
      return await this.makeRequest<GenerationResponse>('/generate/video/text-to-video', {
        method: 'POST',
        body: JSON.stringify(request),
      });
    } catch (error) {
      console.warn('API not available for text-to-video, falling back to generic video endpoint:', error);
      return this.generateVideoFallback({
        prompt: request.prompt,
        negative_prompt: request.negative_prompt,
        generation_type: 'text_to_video',
        input_data: {
          model: request.model,
          aspect_ratio: request.aspect_ratio,
          motion_strength: request.motion_strength,
        },
        duration_seconds: request.duration_seconds,
        metadata: {
          ...request.metadata,
          quality: request.quality,
        },
      });
    }
  }

  // Generate video from image
  async generateImageToVideo(request: ImageToVideoRequest): Promise<GenerationResponse> {
    try {
      return await this.makeRequest<GenerationResponse>('/generate/video/image-to-video', {
        method: 'POST',
        body: JSON.stringify(request),
      });
    } catch (error) {
      console.warn('API not available for image-to-video, falling back to generic video endpoint:', error);
      return this.generateVideoFallback({
        prompt: request.prompt || 'Animate this image',
        negative_prompt: request.negative_prompt,
        generation_type: 'image_to_video',
        input_data: {
          init_image_url: request.init_image_url,
          model: request.model,
          aspect_ratio: request.aspect_ratio,
          motion_strength: request.motion_strength,
        },
        duration_seconds: request.duration_seconds,
        metadata: {
          ...request.metadata,
          quality: request.quality,
        },
      });
    }
  }

  // Generate video from frame interpolation
  async generateFrameInterpolation(request: FrameInterpolationRequest): Promise<GenerationResponse> {
    try {
      return await this.makeRequest<GenerationResponse>('/generate/video/frame-interpolation', {
        method: 'POST',
        body: JSON.stringify(request),
      });
    } catch (error) {
      console.warn('API not available for frame-interpolation, falling back to generic video endpoint:', error);
      return this.generateVideoFallback({
        prompt: 'Frame interpolation video',
        generation_type: 'keyframe',
        input_data: {
          first_frame_url: request.first_frame_url,
          last_frame_url: request.last_frame_url,
        },
        duration_seconds: request.duration_seconds,
        fps: request.fps,
        metadata: {
          ...request.metadata,
          interpolation_method: request.interpolation_method,
          quality: request.quality,
        },
      });
    }
  }

  // Fallback to generic video generation endpoint
  private async generateVideoFallback(request: VideoGenerationRequest): Promise<GenerationResponse> {
    return this.makeRequest<GenerationResponse>('/generate/video', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  // Get job status
  async getJobStatus(jobId: string): Promise<JobStatusResponse> {
    return this.makeRequest<JobStatusResponse>(`/generate/${jobId}`);
  }

  // Cancel job
  async cancelJob(jobId: string, reason?: string): Promise<{ status: string; message: string }> {
    return this.makeRequest(`/generate/${jobId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  // Get generation history
  async getGenerationHistory(params: {
    content_type?: 'video' | 'image' | 'all';
    status?: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'all';
    limit?: number;
    offset?: number;
  } = {}): Promise<GenerationHistoryResponse> {
    const queryParams = new URLSearchParams();
    
    if (params.content_type) queryParams.append('content_type', params.content_type);
    if (params.status) queryParams.append('status', params.status);
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.offset) queryParams.append('offset', params.offset.toString());

    const endpoint = `/generate/history${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return this.makeRequest<GenerationHistoryResponse>(endpoint);
  }

  // Get available models
  async getAvailableModels(): Promise<ModelsResponse> {
    return this.makeRequest<ModelsResponse>('/generate/models');
  }

  // Enhance prompt using AI
  async enhancePrompt(prompt: string): Promise<{ enhanced_prompt: string; suggestions: string[] }> {
    try {
      // This would call an AI service to enhance the prompt
      // For now, return a simple enhancement
      const enhanced = `${prompt}, cinematic, high quality, detailed, professional lighting`;
      const suggestions = [
        'Add "cinematic lighting" for better visuals',
        'Include "4K resolution" for higher quality',
        'Try "slow motion" for dramatic effect',
        'Add "golden hour" for warm lighting',
      ];

      return { enhanced_prompt: enhanced, suggestions };
    } catch (error) {
      console.error('Error enhancing prompt:', error);
      return { enhanced_prompt: prompt, suggestions: [] };
    }
  }

  // Calculate generation cost
  calculateCost(params: {
    type: 'text_to_video' | 'image_to_video' | 'frame_interpolation';
    duration: number;
    quality: 'basic' | 'standard' | 'high';
    model?: string;
  }): number {
    const baseCosts = {
      text_to_video: 5,
      image_to_video: 8,
      frame_interpolation: 10,
    };

    const qualityMultipliers = {
      basic: 1,
      standard: 1.5,
      high: 2,
    };

    const baseCost = baseCosts[params.type];
    const durationMultiplier = params.duration / 5; // Base duration is 5 seconds
    const qualityMultiplier = qualityMultipliers[params.quality];

    return Math.ceil(baseCost * durationMultiplier * qualityMultiplier);
  }

  // Poll job status until completion
  async pollJobStatus(
    jobId: string,
    onProgress?: (progress: number, status: string) => void,
    maxAttempts: number = 120, // 10 minutes with 5-second intervals
    interval: number = 5000
  ): Promise<JobStatusResponse> {
    let attempts = 0;

    return new Promise((resolve, reject) => {
      const poll = async () => {
        try {
          const status = await this.getJobStatus(jobId);
          
          onProgress?.(status.progress, status.state);

          if (status.state === 'completed' || status.state === 'failed') {
            resolve(status);
            return;
          }

          attempts++;
          if (attempts >= maxAttempts) {
            reject(new Error('Job polling timeout'));
            return;
          }

          setTimeout(poll, interval);
        } catch (error) {
          reject(error);
        }
      };

      poll();
    });
  }

  // Upload image for video generation (placeholder - would integrate with file upload service)
  async uploadImage(imageUri: string): Promise<string> {
    // This would upload the image to Supabase Storage or another service
    // For now, return the URI as-is (assuming it's already accessible)
    return imageUri;
  }
}

export const videoGenerationService = new VideoGenerationService();