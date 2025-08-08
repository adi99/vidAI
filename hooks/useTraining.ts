import { useState, useCallback, useEffect } from 'react';
import { Alert } from 'react-native';
import { trainingService, TrainingImage, TrainingJob, TrainingUploadResponse } from '@/services/trainingService';
import { useImagePicker, ImagePickerResult } from './useImagePicker';
import { useAuth } from '@/contexts/AuthContext';

export interface UseTrainingReturn {
  // Image management
  uploadedImages: TrainingImage[];
  addImages: () => Promise<void>;
  removeImage: (index: number) => void;
  clearImages: () => void;
  
  // Training configuration
  selectedSteps: 600 | 1200 | 2000;
  setSelectedSteps: (steps: 600 | 1200 | 2000) => void;
  modelName: string;
  setModelName: (name: string) => void;
  
  // Training execution
  startTraining: () => Promise<void>;
  isTraining: boolean;
  trainingProgress: number;
  currentTrainingJob?: TrainingJob;
  
  // Models management
  trainedModels: TrainingJob[];
  loadTrainedModels: () => Promise<void>;
  
  // Status
  isLoading: boolean;
  error: string | null;
  
  // Validation
  canStartTraining: boolean;
  getCreditCost: () => number;
}

export function useTraining(): UseTrainingReturn {
  const { validateCredits } = useAuth();
  const { pickImage, pickMultipleImages } = useImagePicker();
  
  // Image management state
  const [uploadedImages, setUploadedImages] = useState<TrainingImage[]>([]);
  
  // Training configuration state
  const [selectedSteps, setSelectedSteps] = useState<600 | 1200 | 2000>(1200);
  const [modelName, setModelName] = useState('');
  
  // Training execution state
  const [isTraining, setIsTraining] = useState(false);
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [currentTrainingJob, setCurrentTrainingJob] = useState<TrainingJob>();
  
  // Models state
  const [trainedModels, setTrainedModels] = useState<TrainingJob[]>([]);
  
  // General state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Validation
  const canStartTraining = uploadedImages.length >= 10 && 
    modelName.trim().length > 0 && 
    modelName.trim().length <= 50 &&
    /^[a-zA-Z0-9-_]+$/.test(modelName.trim()); // Only alphanumeric, hyphens, and underscores
  
  const getCreditCost = useCallback(() => {
    return trainingService.getCreditCost(selectedSteps);
  }, [selectedSteps]);

  // Add images using image picker
  const addImages = useCallback(async () => {
    try {
      setError(null);
      setIsLoading(true);
      
      if (uploadedImages.length >= 30) {
        Alert.alert('Limit Reached', 'Maximum 30 images allowed for optimal training');
        return;
      }

      const remainingSlots = 30 - uploadedImages.length;
      const results = await pickMultipleImages({
        quality: 0.9,
        maxImages: Math.min(remainingSlots, 10), // Allow up to 10 at once
      });

      if (results.length === 0) {
        return;
      }

      const validImages: TrainingImage[] = [];
      const errors: string[] = [];

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const filename = `training_image_${Date.now()}_${i}.jpg`;
        
        // Validate image format
        if (!trainingService.validateImageFormat(filename)) {
          errors.push(`Image ${i + 1}: Invalid format (use JPG, PNG, or WebP)`);
          continue;
        }

        // Check image size (should be reasonable for training)
        if (result.fileSize && result.fileSize > 10 * 1024 * 1024) { // 10MB limit
          errors.push(`Image ${i + 1}: File too large (max 10MB)`);
          continue;
        }

        // Check image dimensions (should be at least 512px)
        if (result.width < 512 || result.height < 512) {
          errors.push(`Image ${i + 1}: Too small (minimum 512x512 pixels)`);
          continue;
        }

        // Check for duplicate images (basic check by file size and dimensions)
        const isDuplicate = uploadedImages.some(existing => 
          existing.size === (result.fileSize || 0) && 
          existing.width === result.width && 
          existing.height === result.height
        );

        if (isDuplicate) {
          errors.push(`Image ${i + 1}: Appears to be a duplicate`);
          continue;
        }

        const trainingImage: TrainingImage = {
          uri: result.uri,
          filename,
          size: result.fileSize || 0,
          format: trainingService.getImageFormat(filename),
          width: result.width,
          height: result.height,
        };

        validImages.push(trainingImage);
      }

      if (validImages.length > 0) {
        setUploadedImages(prev => [...prev, ...validImages]);
      }

      if (errors.length > 0) {
        Alert.alert(
          'Some Images Skipped',
          `${validImages.length} images added successfully.\n\nSkipped:\n${errors.join('\n')}`,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error adding images:', error);
      setError('Failed to add images. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [uploadedImages.length, pickMultipleImages]);

  // Remove image by index
  const removeImage = useCallback((index: number) => {
    setUploadedImages(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Clear all images
  const clearImages = useCallback(() => {
    setUploadedImages([]);
  }, []);

  // Start training process
  const startTraining = useCallback(async () => {
    try {
      setError(null);
      setIsLoading(true);

      // Validate inputs
      if (!canStartTraining) {
        Alert.alert('Invalid Configuration', 'Please upload at least 10 images and provide a model name');
        return;
      }

      // Validate credits
      const cost = getCreditCost();
      const validation = await validateCredits('training', { steps: selectedSteps });
      if (!validation.valid) {
        Alert.alert('Insufficient Credits', validation.message || 'Not enough credits for this training');
        return;
      }

      // Upload images first
      const uploadResponse = await trainingService.uploadImages(uploadedImages, modelName);
      
      // Start training with uploaded images
      const startResponse = await trainingService.startTraining(
        modelName,
        selectedSteps,
        uploadResponse.images.map(img => img.url),
        {
          description: `Custom model trained with ${uploadedImages.length} images`,
          imageCount: uploadedImages.length,
        }
      );

      // Set training state
      setIsTraining(true);
      setTrainingProgress(0);
      
      // Start polling for progress
      const jobId = startResponse.trainingJobId;
      pollTrainingProgress(jobId);

      Alert.alert('Training Started', `Your model "${modelName}" is now training. You'll be notified when it's complete.`);
      
    } catch (error: any) {
      console.error('Training start error:', error);
      setError(error.message || 'Failed to start training');
      Alert.alert('Training Failed', error.message || 'Failed to start training. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [canStartTraining, getCreditCost, validateCredits, selectedSteps, uploadedImages, modelName]);

  // Poll training progress
  const pollTrainingProgress = useCallback(async (jobId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const statusResponse = await trainingService.getTrainingStatus(jobId);
        const job = statusResponse.trainingJob;
        
        setCurrentTrainingJob(job);
        setTrainingProgress(job.progress);

        if (job.status === 'completed') {
          setIsTraining(false);
          clearInterval(pollInterval);
          Alert.alert('Training Complete', `Your model "${job.modelName}" is ready to use!`);
          // Refresh models list
          try {
            const response = await trainingService.getTrainedModels();
            setTrainedModels([
              ...response.models.completed,
              ...response.models.inProgress,
              ...response.models.failed,
            ]);
          } catch (error) {
            console.error('Error refreshing models:', error);
          }
        } else if (job.status === 'failed') {
          setIsTraining(false);
          clearInterval(pollInterval);
          Alert.alert('Training Failed', job.errorMessage || 'Training failed. Your credits have been refunded.');
          setError(job.errorMessage || 'Training failed');
        }
      } catch (error) {
        console.error('Error polling training progress:', error);
        // Don't clear interval on error, just log it
      }
    }, 5000); // Poll every 5 seconds

    // Clean up interval after 2 hours (training should complete by then)
    setTimeout(() => {
      clearInterval(pollInterval);
      if (isTraining) {
        setIsTraining(false);
        Alert.alert('Training Timeout', 'Training is taking longer than expected. Please check your models list.');
      }
    }, 2 * 60 * 60 * 1000);
  }, [isTraining]);

  // Load trained models
  const loadTrainedModels = useCallback(async () => {
    try {
      setError(null);
      const response = await trainingService.getTrainedModels();
      setTrainedModels([
        ...response.models.completed,
        ...response.models.inProgress,
        ...response.models.failed,
      ]);
    } catch (error: any) {
      console.error('Error loading trained models:', error);
      setError('Failed to load trained models');
    }
  }, []);

  // Load trained models on mount
  useEffect(() => {
    loadTrainedModels();
  }, [loadTrainedModels]);

  return {
    // Image management
    uploadedImages,
    addImages,
    removeImage,
    clearImages,
    
    // Training configuration
    selectedSteps,
    setSelectedSteps,
    modelName,
    setModelName,
    
    // Training execution
    startTraining,
    isTraining,
    trainingProgress,
    currentTrainingJob,
    
    // Models management
    trainedModels,
    loadTrainedModels,
    
    // Status
    isLoading,
    error,
    
    // Validation
    canStartTraining,
    getCreditCost,
  };
}