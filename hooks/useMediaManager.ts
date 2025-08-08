import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { useImagePicker, ImagePickerResult } from './useImagePicker';
import { mediaService } from '@/services/mediaService';
import { MediaItem } from '@/components/MediaGallery';

export interface MediaManagerOptions {
  bucket: string;
  pathPrefix?: string;
  maxFileSize?: number;
  allowedTypes?: ('image' | 'video')[];
  compressionQuality?: number;
  autoUpload?: boolean;
}

export interface UseMediaManagerReturn {
  // File selection
  selectImages: (maxCount?: number) => Promise<ImagePickerResult[]>;
  selectVideos: (maxCount?: number) => Promise<ImagePickerResult[]>;
  selectMedia: (maxCount?: number) => Promise<ImagePickerResult[]>;
  takePhoto: () => Promise<ImagePickerResult | null>;
  recordVideo: () => Promise<ImagePickerResult | null>;
  
  // File management
  uploadFiles: (files: ImagePickerResult[]) => Promise<string[]>;
  downloadFile: (url: string, fileName: string) => Promise<string>;
  shareFile: (uri: string, title?: string) => Promise<boolean>;
  saveToGallery: (uri: string) => Promise<boolean>;
  deleteFile: (uri: string) => Promise<boolean>;
  
  // File processing
  compressImage: (uri: string, quality?: number) => Promise<string>;
  generateThumbnail: (uri: string, size?: number) => Promise<string>;
  validateFile: (uri: string, type: 'image' | 'video') => Promise<boolean>;
  
  // State
  isLoading: boolean;
  uploadProgress: { [key: string]: number };
  error: string | null;
}

export function useMediaManager(options: MediaManagerOptions): UseMediaManagerReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const [error, setError] = useState<string | null>(null);
  
  const {
    pickImage,
    pickMultipleImages,
    pickVideo,
    pickMedia,
    takePhoto: takePhotoFromPicker,
    recordVideo: recordVideoFromPicker,
  } = useImagePicker();

  const {
    bucket,
    pathPrefix = '',
    maxFileSize = 50 * 1024 * 1024, // 50MB
    allowedTypes = ['image', 'video'],
    compressionQuality = 0.8,
    autoUpload = false,
  } = options;

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const selectImages = useCallback(async (maxCount: number = 10): Promise<ImagePickerResult[]> => {
    try {
      setError(null);
      setIsLoading(true);
      
      if (!allowedTypes.includes('image')) {
        throw new Error('Image selection is not allowed');
      }

      const results = maxCount === 1 
        ? [await pickImage()].filter(Boolean) as ImagePickerResult[]
        : await pickMultipleImages({ maxImages: maxCount });

      // Validate files
      const validatedResults: ImagePickerResult[] = [];
      for (const result of results) {
        const isValid = await validateFile(result.uri, 'image');
        if (isValid) {
          validatedResults.push(result);
        }
      }

      if (autoUpload && validatedResults.length > 0) {
        await uploadFiles(validatedResults);
      }

      return validatedResults;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to select images';
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [allowedTypes, autoUpload, pickImage, pickMultipleImages]);

  const selectVideos = useCallback(async (maxCount: number = 5): Promise<ImagePickerResult[]> => {
    try {
      setError(null);
      setIsLoading(true);
      
      if (!allowedTypes.includes('video')) {
        throw new Error('Video selection is not allowed');
      }

      const results = maxCount === 1 
        ? [await pickVideo()].filter(Boolean) as ImagePickerResult[]
        : await pickMedia({ maxImages: maxCount });

      // Filter only videos and validate
      const validatedResults: ImagePickerResult[] = [];
      for (const result of results) {
        if (result.type === 'video') {
          const isValid = await validateFile(result.uri, 'video');
          if (isValid) {
            validatedResults.push(result);
          }
        }
      }

      if (autoUpload && validatedResults.length > 0) {
        await uploadFiles(validatedResults);
      }

      return validatedResults;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to select videos';
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [allowedTypes, autoUpload, pickVideo, pickMedia]);

  const selectMedia = useCallback(async (maxCount: number = 10): Promise<ImagePickerResult[]> => {
    try {
      setError(null);
      setIsLoading(true);
      
      const results = await pickMedia({ maxImages: maxCount });

      // Filter by allowed types and validate
      const validatedResults: ImagePickerResult[] = [];
      for (const result of results) {
        const type = result.type === 'video' ? 'video' : 'image';
        if (allowedTypes.includes(type)) {
          const isValid = await validateFile(result.uri, type);
          if (isValid) {
            validatedResults.push(result);
          }
        }
      }

      if (autoUpload && validatedResults.length > 0) {
        await uploadFiles(validatedResults);
      }

      return validatedResults;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to select media';
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [allowedTypes, autoUpload, pickMedia]);

  const takePhoto = useCallback(async (): Promise<ImagePickerResult | null> => {
    try {
      setError(null);
      setIsLoading(true);
      
      if (!allowedTypes.includes('image')) {
        throw new Error('Photo capture is not allowed');
      }

      const result = await takePhotoFromPicker();
      if (!result) return null;

      const isValid = await validateFile(result.uri, 'image');
      if (!isValid) {
        throw new Error('Invalid photo captured');
      }

      if (autoUpload) {
        await uploadFiles([result]);
      }

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to take photo';
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [allowedTypes, autoUpload, takePhotoFromPicker]);

  const recordVideo = useCallback(async (): Promise<ImagePickerResult | null> => {
    try {
      setError(null);
      setIsLoading(true);
      
      if (!allowedTypes.includes('video')) {
        throw new Error('Video recording is not allowed');
      }

      const result = await recordVideoFromPicker();
      if (!result) return null;

      const isValid = await validateFile(result.uri, 'video');
      if (!isValid) {
        throw new Error('Invalid video recorded');
      }

      if (autoUpload) {
        await uploadFiles([result]);
      }

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to record video';
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [allowedTypes, autoUpload, recordVideoFromPicker]);

  const uploadFiles = useCallback(async (files: ImagePickerResult[]): Promise<string[]> => {
    try {
      setError(null);
      setIsLoading(true);
      
      const uploadedUrls: string[] = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileId = `${file.uri}_${Date.now()}`;
        
        // Update progress
        setUploadProgress(prev => ({ ...prev, [fileId]: 0 }));
        
        try {
          // Compress if it's an image
          let uploadUri = file.uri;
          if (file.type === 'image') {
            uploadUri = await mediaService.compressImage(file.uri, {
              quality: compressionQuality,
              maxWidth: 2048,
              maxHeight: 2048,
            });
          }
          
          // Generate unique filename
          const fileName = mediaService.generateUniqueFileName(
            `file_${i}.${file.type === 'image' ? 'jpg' : 'mp4'}`,
            pathPrefix
          );
          
          // Simulate progress updates
          const progressInterval = setInterval(() => {
            setUploadProgress(prev => ({
              ...prev,
              [fileId]: Math.min((prev[fileId] || 0) + 10, 90)
            }));
          }, 200);
          
          // Upload file
          const uploadedUrl = await mediaService.uploadToStorage(
            uploadUri,
            bucket,
            fileName,
            { contentType: file.type === 'image' ? 'image/jpeg' : 'video/mp4' }
          );
          
          clearInterval(progressInterval);
          setUploadProgress(prev => ({ ...prev, [fileId]: 100 }));
          
          uploadedUrls.push(uploadedUrl);
          
        } catch (fileError) {
          console.error(`Error uploading file ${i}:`, fileError);
          setUploadProgress(prev => ({ ...prev, [fileId]: -1 })); // -1 indicates error
        }
      }
      
      return uploadedUrls;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to upload files';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
      // Clear progress after a delay
      setTimeout(() => {
        setUploadProgress({});
      }, 3000);
    }
  }, [bucket, pathPrefix, compressionQuality]);

  const downloadFile = useCallback(async (url: string, fileName: string): Promise<string> => {
    try {
      setError(null);
      setIsLoading(true);
      return await mediaService.downloadFile(url, fileName);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to download file';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const shareFile = useCallback(async (uri: string, title?: string): Promise<boolean> => {
    try {
      setError(null);
      return await mediaService.shareFile(uri, title);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to share file';
      setError(errorMessage);
      return false;
    }
  }, []);

  const saveToGallery = useCallback(async (uri: string): Promise<boolean> => {
    try {
      setError(null);
      return await mediaService.saveToGallery(uri);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save to gallery';
      setError(errorMessage);
      return false;
    }
  }, []);

  const deleteFile = useCallback(async (uri: string): Promise<boolean> => {
    try {
      setError(null);
      return await mediaService.deleteFile(uri);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete file';
      setError(errorMessage);
      return false;
    }
  }, []);

  const compressImage = useCallback(async (uri: string, quality: number = compressionQuality): Promise<string> => {
    try {
      setError(null);
      setIsLoading(true);
      return await mediaService.compressImage(uri, { quality });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to compress image';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [compressionQuality]);

  const generateThumbnail = useCallback(async (uri: string, size: number = 200): Promise<string> => {
    try {
      setError(null);
      return await mediaService.generateThumbnail(uri, size);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate thumbnail';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  const validateFile = useCallback(async (uri: string, type: 'image' | 'video'): Promise<boolean> => {
    try {
      const validation = await mediaService.validateMediaFile(uri, type);
      if (!validation.isValid && validation.error) {
        setError(validation.error);
        Alert.alert('Invalid File', validation.error);
      }
      return validation.isValid;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to validate file';
      setError(errorMessage);
      return false;
    }
  }, []);

  return {
    // File selection
    selectImages,
    selectVideos,
    selectMedia,
    takePhoto,
    recordVideo,
    
    // File management
    uploadFiles,
    downloadFile,
    shareFile,
    saveToGallery,
    deleteFile,
    
    // File processing
    compressImage,
    generateThumbnail,
    validateFile,
    
    // State
    isLoading,
    uploadProgress,
    error,
  };
}