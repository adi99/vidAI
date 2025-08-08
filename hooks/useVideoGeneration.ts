import { useState, useCallback } from 'react';
import { videoGenerationService, GenerationResponse, JobStatusResponse } from '@/services/videoGenerationService';
import { useAuth } from '@/contexts/AuthContext';

export interface UseVideoGenerationOptions {
  onProgress?: (progress: number, status: string) => void;
  onComplete?: (result: JobStatusResponse) => void;
  onError?: (error: string) => void;
}

export interface UseVideoGenerationReturn {
  isGenerating: boolean;
  progress: number;
  currentJobId: string | null;
  error: string | null;
  generateTextToVideo: (params: {
    prompt: string;
    model: string;
    duration: string;
    quality: string;
    aspectRatio: string;
    motionStrength: number;
    negativePrompt?: string;
    enhancePrompt?: boolean;
  }) => Promise<void>;
  generateImageToVideo: (params: {
    imageUri: string;
    prompt?: string;
    model: string;
    duration: string;
    quality: string;
    aspectRatio: string;
    motionStrength: number;
    negativePrompt?: string;
  }) => Promise<void>;
  generateFrameInterpolation: (params: {
    firstFrameUri: string;
    lastFrameUri: string;
    duration: string;
    quality: string;
  }) => Promise<void>;
  cancelGeneration: () => Promise<void>;
  enhancePrompt: (prompt: string) => Promise<{ enhanced: string; suggestions: string[] }>;
  calculateCost: (params: {
    type: 'text_to_video' | 'image_to_video' | 'frame_interpolation';
    duration: string;
    quality: string;
  }) => number;
}

export function useVideoGeneration(options: UseVideoGenerationOptions = {}): UseVideoGenerationReturn {
  const { session } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleProgress = useCallback((progress: number, status: string) => {
    setProgress(progress);
    options.onProgress?.(progress, status);
  }, [options]);

  const handleComplete = useCallback((result: JobStatusResponse) => {
    setIsGenerating(false);
    setProgress(100);
    setCurrentJobId(null);
    options.onComplete?.(result);
  }, [options]);

  const handleError = useCallback((errorMessage: string) => {
    setIsGenerating(false);
    setProgress(0);
    setCurrentJobId(null);
    setError(errorMessage);
    options.onError?.(errorMessage);
  }, [options]);

  const generateTextToVideo = useCallback(async (params: {
    prompt: string;
    model: string;
    duration: string;
    quality: string;
    aspectRatio: string;
    motionStrength: number;
    negativePrompt?: string;
    enhancePrompt?: boolean;
  }) => {
    if (!session?.user) {
      handleError('Authentication required');
      return;
    }

    try {
      setIsGenerating(true);
      setProgress(0);
      setError(null);

      let finalPrompt = params.prompt;
      
      // Enhance prompt if requested
      if (params.enhancePrompt) {
        try {
          const enhanced = await videoGenerationService.enhancePrompt(params.prompt);
          finalPrompt = enhanced.enhanced_prompt;
        } catch (enhanceError) {
          console.warn('Failed to enhance prompt, using original:', enhanceError);
        }
      }

      // Convert duration string to seconds
      const durationSeconds = parseInt(params.duration.replace('s', ''));

      const response = await videoGenerationService.generateTextToVideo({
        prompt: finalPrompt,
        negative_prompt: params.negativePrompt,
        model: params.model,
        duration_seconds: durationSeconds,
        aspect_ratio: params.aspectRatio as any,
        quality: params.quality.toLowerCase() as any,
        motion_strength: params.motionStrength,
        metadata: {
          original_prompt: params.prompt,
          enhanced_prompt: params.enhancePrompt,
        },
      });

      setCurrentJobId(response.jobId);

      // Poll for completion
      const result = await videoGenerationService.pollJobStatus(
        response.jobId,
        handleProgress
      );

      if (result.state === 'completed') {
        handleComplete(result);
      } else {
        handleError(result.result?.error || 'Generation failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Generation failed';
      handleError(errorMessage);
    }
  }, [session, handleProgress, handleComplete, handleError]);

  const generateImageToVideo = useCallback(async (params: {
    imageUri: string;
    prompt?: string;
    model: string;
    duration: string;
    quality: string;
    aspectRatio: string;
    motionStrength: number;
    negativePrompt?: string;
  }) => {
    if (!session?.user) {
      handleError('Authentication required');
      return;
    }

    try {
      setIsGenerating(true);
      setProgress(0);
      setError(null);

      // Upload image first (in a real implementation)
      const imageUrl = await videoGenerationService.uploadImage(params.imageUri);
      
      const durationSeconds = parseInt(params.duration.replace('s', ''));

      const response = await videoGenerationService.generateImageToVideo({
        init_image_url: imageUrl,
        prompt: params.prompt,
        negative_prompt: params.negativePrompt,
        model: params.model,
        duration_seconds: durationSeconds,
        motion_strength: params.motionStrength,
        aspect_ratio: params.aspectRatio as any,
        quality: params.quality.toLowerCase() as any,
        metadata: {
          source_image: params.imageUri,
        },
      });

      setCurrentJobId(response.jobId);

      const result = await videoGenerationService.pollJobStatus(
        response.jobId,
        handleProgress
      );

      if (result.state === 'completed') {
        handleComplete(result);
      } else {
        handleError(result.result?.error || 'Generation failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Generation failed';
      handleError(errorMessage);
    }
  }, [session, handleProgress, handleComplete, handleError]);

  const generateFrameInterpolation = useCallback(async (params: {
    firstFrameUri: string;
    lastFrameUri: string;
    duration: string;
    quality: string;
  }) => {
    if (!session?.user) {
      handleError('Authentication required');
      return;
    }

    try {
      setIsGenerating(true);
      setProgress(0);
      setError(null);

      // Upload frames first
      const [firstFrameUrl, lastFrameUrl] = await Promise.all([
        videoGenerationService.uploadImage(params.firstFrameUri),
        videoGenerationService.uploadImage(params.lastFrameUri),
      ]);

      const durationSeconds = parseInt(params.duration.replace('s', ''));

      const response = await videoGenerationService.generateFrameInterpolation({
        first_frame_url: firstFrameUrl,
        last_frame_url: lastFrameUrl,
        duration_seconds: durationSeconds,
        fps: 24,
        interpolation_method: 'smooth',
        quality: params.quality.toLowerCase() as any,
        metadata: {
          source_frames: [params.firstFrameUri, params.lastFrameUri],
        },
      });

      setCurrentJobId(response.jobId);

      const result = await videoGenerationService.pollJobStatus(
        response.jobId,
        handleProgress
      );

      if (result.state === 'completed') {
        handleComplete(result);
      } else {
        handleError(result.result?.error || 'Generation failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Generation failed';
      handleError(errorMessage);
    }
  }, [session, handleProgress, handleComplete, handleError]);

  const cancelGeneration = useCallback(async () => {
    if (!currentJobId) return;

    try {
      await videoGenerationService.cancelJob(currentJobId, 'User cancelled');
      setIsGenerating(false);
      setProgress(0);
      setCurrentJobId(null);
      setError(null);
    } catch (error) {
      console.error('Failed to cancel generation:', error);
    }
  }, [currentJobId]);

  const enhancePrompt = useCallback(async (prompt: string) => {
    try {
      const result = await videoGenerationService.enhancePrompt(prompt);
      return {
        enhanced: result.enhanced_prompt,
        suggestions: result.suggestions,
      };
    } catch (error) {
      console.error('Failed to enhance prompt:', error);
      return {
        enhanced: prompt,
        suggestions: [],
      };
    }
  }, []);

  const calculateCost = useCallback((params: {
    type: 'text_to_video' | 'image_to_video' | 'frame_interpolation';
    duration: string;
    quality: string;
  }) => {
    const durationSeconds = parseInt(params.duration.replace('s', ''));
    return videoGenerationService.calculateCost({
      type: params.type,
      duration: durationSeconds,
      quality: params.quality.toLowerCase() as any,
    });
  }, []);

  return {
    isGenerating,
    progress,
    currentJobId,
    error,
    generateTextToVideo,
    generateImageToVideo,
    generateFrameInterpolation,
    cancelGeneration,
    enhancePrompt,
    calculateCost,
  };
}