import { supabase } from '@/lib/supabase';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

export interface TrainingImage {
  uri: string;
  filename: string;
  size: number;
  format: 'jpg' | 'jpeg' | 'png' | 'webp';
  width: number;
  height: number;
}

export interface TrainingUploadResponse {
  status: 'uploaded';
  sessionId: string;
  modelName: string;
  imageCount: number;
  images: Array<{
    url: string;
    filename: string;
    size: number;
    format: string;
  }>;
  timestamp: string;
}

export interface TrainingStartResponse {
  status: 'queued';
  jobId: string;
  trainingJobId: string;
  queue: string;
  modelName: string;
  steps: number;
  cost: number;
  estimatedDuration: string;
  timestamp: string;
}

export interface TrainingJob {
  id: string;
  modelName: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  steps: number;
  creditsUsed: number;
  trainedModelUrl?: string;
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
}

export interface TrainingStatusResponse {
  status: 'ok';
  jobId: string;
  trainingJob: TrainingJob;
  queueStatus?: {
    state: string;
    progress: number;
  };
  timestamp: string;
}

export interface TrainingModelsResponse {
  status: 'ok';
  models: {
    completed: TrainingJob[];
    inProgress: TrainingJob[];
    failed: TrainingJob[];
  };
  totalCount: number;
  completedCount: number;
  timestamp: string;
}

export interface TrainingError {
  code: string;
  message: string;
  timestamp: string;
}

class TrainingService {
  private async getAuthHeaders() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }
    
    return {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    };
  }

  async uploadImages(images: TrainingImage[], modelName: string): Promise<TrainingUploadResponse> {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // First, upload images to Supabase Storage
      const uploadedImageUrls: string[] = [];
      
      for (let i = 0; i < images.length; i++) {
        const image = images[i];
        const fileName = `${user.id}/training/${Date.now()}_${i}_${image.filename}`;
        
        // Convert URI to blob for upload
        const response = await fetch(image.uri);
        const blob = await response.blob();
        
        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('training-images')
          .upload(fileName, blob, {
            contentType: `image/${image.format}`,
            upsert: false,
          });

        if (uploadError) {
          throw new Error(`Failed to upload image ${i + 1}: ${uploadError.message}`);
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('training-images')
          .getPublicUrl(fileName);

        uploadedImageUrls.push(publicUrl);
      }

      // Now send the uploaded URLs to the backend
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/train/upload`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          images: images.map((img, index) => ({
            url: uploadedImageUrls[index],
            filename: img.filename,
            size: img.size,
            format: img.format,
          })),
          model_name: modelName,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to upload images');
      }

      return data;
    } catch (error) {
      console.error('Training upload error:', error);
      throw error;
    }
  }

  async startTraining(
    modelName: string,
    steps: 600 | 1200 | 2000,
    trainingImages: string[],
    metadata?: Record<string, any>
  ): Promise<TrainingStartResponse> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/train/start`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model_name: modelName,
          steps,
          training_images: trainingImages,
          metadata,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to start training');
      }

      return data;
    } catch (error) {
      console.error('Training start error:', error);
      throw error;
    }
  }

  async getTrainingStatus(jobId: string): Promise<TrainingStatusResponse> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/train/${jobId}`, {
        method: 'GET',
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to get training status');
      }

      return data;
    } catch (error) {
      console.error('Training status error:', error);
      throw error;
    }
  }

  async getTrainedModels(): Promise<TrainingModelsResponse> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/train/models`, {
        method: 'GET',
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to get trained models');
      }

      return data;
    } catch (error) {
      console.error('Training models error:', error);
      throw error;
    }
  }

  // Helper method to get credit cost for training steps
  getCreditCost(steps: 600 | 1200 | 2000): number {
    const costs = {
      600: 10,
      1200: 20,
      2000: 35,
    };
    return costs[steps];
  }

  // Helper method to validate image format
  validateImageFormat(filename: string): boolean {
    const validFormats = ['jpg', 'jpeg', 'png', 'webp'];
    const extension = filename.toLowerCase().split('.').pop();
    return validFormats.includes(extension || '');
  }

  // Helper method to get image format from filename
  getImageFormat(filename: string): 'jpg' | 'jpeg' | 'png' | 'webp' {
    const extension = filename.toLowerCase().split('.').pop();
    if (extension === 'jpg' || extension === 'jpeg') return 'jpeg';
    if (extension === 'png') return 'png';
    if (extension === 'webp') return 'webp';
    return 'jpeg'; // default fallback
  }
}

export const trainingService = new TrainingService();