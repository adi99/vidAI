import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { imageGenerationService, ImageGenerationRequest, ImageEditRequest, GenerationResponse, JobStatusResponse } from '@/services/imageGenerationService';
import { useAuth } from '@/contexts/AuthContext';

export interface ImageGenerationState {
  isGenerating: boolean;
  isEditing: boolean;
  generationProgress: number;
  editProgress: number;
  currentJobId: string | null;
  currentEditJobId: string | null;
  generatedImages: string[];
  error: string | null;
}

export interface UseImageGenerationReturn extends ImageGenerationState {
  generateImage: (request: ImageGenerationRequest) => Promise<void>;
  editImage: (request: ImageEditRequest) => Promise<void>;
  cancelGeneration: (jobId?: string) => Promise<void>;
  enhancePrompt: (prompt: string) => Promise<{ enhanced_prompt: string; suggestions: string[] }>;
  uploadImage: (imageUri: string, fileName?: string) => Promise<string>;
  clearError: () => void;
  resetState: () => void;
}

export function useImageGeneration(): UseImageGenerationReturn {
  const { validateCredits } = useAuth();
  
  const [state, setState] = useState<ImageGenerationState>({
    isGenerating: false,
    isEditing: false,
    generationProgress: 0,
    editProgress: 0,
    currentJobId: null,
    currentEditJobId: null,
    generatedImages: [],
    error: null,
  });

  const updateState = useCallback((updates: Partial<ImageGenerationState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const clearError = useCallback(() => {
    updateState({ error: null });
  }, [updateState]);

  const resetState = useCallback(() => {
    setState({
      isGenerating: false,
      isEditing: false,
      generationProgress: 0,
      editProgress: 0,
      currentJobId: null,
      currentEditJobId: null,
      generatedImages: [],
      error: null,
    });
  }, []);

  const generateImage = useCallback(async (request: ImageGenerationRequest) => {
    try {
      clearError();
      
      // Validate credits before generation
      const validation = await validateCredits('image', {
        quality: request.quality,
        model: request.model,
      });

      if (!validation.valid) {
        Alert.alert('Insufficient Credits', validation.message || 'Not enough credits for this generation');
        return;
      }

      updateState({ 
        isGenerating: true, 
        generationProgress: 0,
        currentJobId: null,
      });

      // Start generation
      const response: GenerationResponse = await imageGenerationService.generateImage(request);
      
      updateState({ currentJobId: response.jobId });

      // Poll for completion
      const result = await imageGenerationService.pollJobStatus(
        response.jobId,
        (progress, status) => {
          updateState({ generationProgress: progress });
        }
      );

      if (result.state === 'completed' && result.result?.imageUrl) {
        updateState({
          isGenerating: false,
          generationProgress: 100,
          generatedImages: [result.result.imageUrl, ...state.generatedImages],
          currentJobId: null,
        });
        
        Alert.alert('Success', 'Your image has been generated!');
      } else if (result.state === 'failed') {
        throw new Error(result.result?.error || 'Generation failed');
      }
    } catch (error: any) {
      console.error('Image generation error:', error);
      updateState({
        isGenerating: false,
        generationProgress: 0,
        currentJobId: null,
        error: error.message || 'Failed to generate image',
      });
      
      Alert.alert('Generation Failed', error.message || 'Failed to generate image. Please try again.');
    }
  }, [validateCredits, clearError, updateState, state.generatedImages]);

  const editImage = useCallback(async (request: ImageEditRequest) => {
    try {
      clearError();
      
      // Validate credits for editing
      const editType = request.edit_type === 'background_replace' || request.edit_type === 'restyle' ? 'advanced' : 'basic';
      const validation = await validateCredits('editing', { editType });

      if (!validation.valid) {
        Alert.alert('Insufficient Credits', validation.message || 'Not enough credits for this edit');
        return;
      }

      updateState({ 
        isEditing: true, 
        editProgress: 0,
        currentEditJobId: null,
      });

      // Start editing
      const response: GenerationResponse = await imageGenerationService.editImage(request);
      
      updateState({ currentEditJobId: response.jobId });

      // Poll for completion
      const result = await imageGenerationService.pollJobStatus(
        response.jobId,
        (progress, status) => {
          updateState({ editProgress: progress });
        }
      );

      if (result.state === 'completed' && result.result?.imageUrl) {
        updateState({
          isEditing: false,
          editProgress: 100,
          generatedImages: [result.result.imageUrl, ...state.generatedImages],
          currentEditJobId: null,
        });
        
        Alert.alert('Success', 'Your image has been edited!');
      } else if (result.state === 'failed') {
        throw new Error(result.result?.error || 'Edit failed');
      }
    } catch (error: any) {
      console.error('Image edit error:', error);
      updateState({
        isEditing: false,
        editProgress: 0,
        currentEditJobId: null,
        error: error.message || 'Failed to edit image',
      });
      
      Alert.alert('Edit Failed', error.message || 'Failed to edit image. Please try again.');
    }
  }, [validateCredits, clearError, updateState, state.generatedImages]);

  const cancelGeneration = useCallback(async (jobId?: string) => {
    try {
      const targetJobId = jobId || state.currentJobId || state.currentEditJobId;
      if (!targetJobId) return;

      await imageGenerationService.cancelJob(targetJobId, 'User cancelled');
      
      updateState({
        isGenerating: false,
        isEditing: false,
        generationProgress: 0,
        editProgress: 0,
        currentJobId: null,
        currentEditJobId: null,
      });
      
      Alert.alert('Cancelled', 'Generation has been cancelled');
    } catch (error: any) {
      console.error('Cancel error:', error);
      Alert.alert('Error', 'Failed to cancel generation');
    }
  }, [state.currentJobId, state.currentEditJobId, updateState]);

  const enhancePrompt = useCallback(async (prompt: string) => {
    try {
      return await imageGenerationService.enhancePrompt(prompt);
    } catch (error: any) {
      console.error('Prompt enhancement error:', error);
      return { enhanced_prompt: prompt, suggestions: [] };
    }
  }, []);

  const uploadImage = useCallback(async (imageUri: string, fileName?: string) => {
    try {
      return await imageGenerationService.uploadImage(imageUri, fileName);
    } catch (error: any) {
      console.error('Image upload error:', error);
      throw new Error('Failed to upload image');
    }
  }, []);

  return {
    ...state,
    generateImage,
    editImage,
    cancelGeneration,
    enhancePrompt,
    uploadImage,
    clearError,
    resetState,
  };
}