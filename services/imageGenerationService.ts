import { supabase } from '@/lib/supabase';

// Types for image generation
export interface ImageGenerationRequest {
  prompt: string;
  negative_prompt?: string;
  model: string;
  quality: 'basic' | 'standard' | 'high';
  width?: number;
  height?: number;
  init_image_url?: string;
  strength?: number;
  caption_init_image?: boolean;
  metadata?: Record<string, any>;
}

export interface ImageEditRequest {
  image_url: string;
  prompt: string;
  negative_prompt?: string;
  edit_type: 'inpaint' | 'outpaint' | 'restyle' | 'background_replace';
  mask_url?: string;
  strength?: number;
  guidance_scale?: number;
  steps?: number;
  metadata?: Record<string, any>;
}

export interface GenerationResponse {
  status: string;
  jobId: string;
  queue: string;
  cost: number;
  editType?: string;
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
    imageUrl?: string;
    thumbnailUrl?: string;
    latencyMs: number;
    error?: string;
  };
  timestamp: string;
}

export interface GenerationHistoryItem {
  id: string;
  content_type: 'image';
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

export interface ModelInfo {
  id: string;
  name: string;
  description: string;
  speed: 'fast' | 'medium' | 'slow';
  credits_per_image: number;
  max_resolution: string;
  features: string[];
}

class ImageGenerationService {
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

  // Generate image from text prompt
  async generateImage(request: ImageGenerationRequest): Promise<GenerationResponse> {
    return this.makeRequest<GenerationResponse>('/generate/image', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  // Edit image with AI
  async editImage(request: ImageEditRequest): Promise<GenerationResponse> {
    return this.makeRequest<GenerationResponse>('/generate/image/edit', {
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
    content_type?: 'image' | 'all';
    status?: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'all';
    limit?: number;
    offset?: number;
  } = {}): Promise<{ generations: GenerationHistoryItem[] }> {
    const queryParams = new URLSearchParams();
    
    if (params.content_type) queryParams.append('content_type', params.content_type);
    if (params.status) queryParams.append('status', params.status);
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.offset) queryParams.append('offset', params.offset.toString());

    const endpoint = `/generate/history${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return this.makeRequest<{ generations: GenerationHistoryItem[] }>(endpoint);
  }

  // Get available models
  async getAvailableModels(): Promise<{ models: { image: ModelInfo[] } }> {
    return this.makeRequest<{ models: { image: ModelInfo[] } }>('/generate/models');
  }

  // Enhance prompt using AI
  async enhancePrompt(prompt: string): Promise<{ enhanced_prompt: string; suggestions: string[] }> {
    try {
      // This would call an AI service to enhance the prompt
      // For now, return a simple enhancement
      const enhanced = `${prompt}, highly detailed, professional photography, sharp focus, vibrant colors`;
      const suggestions = [
        'Add "8K resolution" for ultra-high quality',
        'Include "professional lighting" for better results',
        'Try "award-winning photography" for artistic style',
        'Add "bokeh background" for depth of field',
      ];

      return { enhanced_prompt: enhanced, suggestions };
    } catch (error) {
      console.error('Error enhancing prompt:', error);
      return { enhanced_prompt: prompt, suggestions: [] };
    }
  }

  // Calculate generation cost
  calculateCost(params: {
    quality: 'basic' | 'standard' | 'high';
    model?: string;
    editType?: string;
  }): number {
    const qualityMultipliers = {
      basic: 1,
      standard: 2,
      high: 4,
    };

    const editMultipliers = {
      inpaint: 1,
      outpaint: 1,
      restyle: 1.5,
      background_replace: 2,
    };

    const baseCost = 1;
    const qualityMultiplier = qualityMultipliers[params.quality];
    const editMultiplier = params.editType ? editMultipliers[params.editType as keyof typeof editMultipliers] || 1 : 1;

    return Math.ceil(baseCost * qualityMultiplier * editMultiplier);
  }

  // Poll job status until completion
  async pollJobStatus(
    jobId: string,
    onProgress?: (progress: number, status: string) => void,
    maxAttempts: number = 60, // 5 minutes with 5-second intervals
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

  // Upload image to storage
  async uploadImage(imageUri: string, fileName?: string): Promise<string> {
    try {
      // Convert URI to blob for upload
      const response = await fetch(imageUri);
      const blob = await response.blob();
      
      // Generate filename if not provided
      const uploadFileName = fileName || `image_${Date.now()}.jpg`;
      
      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('user-uploads')
        .upload(`images/${uploadFileName}`, blob, {
          contentType: 'image/jpeg',
          upsert: false,
        });

      if (error) {
        throw new Error(`Upload failed: ${error.message}`);
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('user-uploads')
        .getPublicUrl(data.path);

      return urlData.publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      throw new Error('Failed to upload image');
    }
  }

  // Parse size string to width/height
  parseSizeString(sizeString: string): { width: number; height: number } {
    const [width, height] = sizeString.split('x').map(Number);
    return { width, height };
  }

  // Get aspect ratio from size
  getAspectRatio(sizeString: string): string {
    const { width, height } = this.parseSizeString(sizeString);
    const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
    const divisor = gcd(width, height);
    return `${width / divisor}:${height / divisor}`;
  }
}

export const imageGenerationService = new ImageGenerationService();