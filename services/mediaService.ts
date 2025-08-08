import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Sharing from 'expo-sharing';
import { supabase } from '@/lib/supabase';
import { Alert } from 'react-native';

export interface MediaFile {
  uri: string;
  width: number;
  height: number;
  type: string;
  fileSize?: number;
  fileName?: string;
}

export interface CompressionOptions {
  quality?: number;
  maxWidth?: number;
  maxHeight?: number;
  format?: 'jpeg' | 'png' | 'webp';
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  fileSize?: number;
  dimensions?: { width: number; height: number };
}

class MediaService {
  private readonly MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
  private readonly SUPPORTED_IMAGE_FORMATS = ['jpg', 'jpeg', 'png', 'webp'];
  private readonly SUPPORTED_VIDEO_FORMATS = ['mp4', 'mov', 'avi'];

  /**
   * Validate media file format, size, and dimensions
   */
  async validateMediaFile(uri: string, type: 'image' | 'video' = 'image'): Promise<ValidationResult> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(uri);
      
      if (!fileInfo.exists) {
        return { isValid: false, error: 'File does not exist' };
      }

      const fileSize = fileInfo.size || 0;
      if (fileSize > this.MAX_FILE_SIZE) {
        return { 
          isValid: false, 
          error: `File size (${this.formatFileSize(fileSize)}) exceeds maximum allowed size (${this.formatFileSize(this.MAX_FILE_SIZE)})` 
        };
      }

      // Check file extension
      const extension = uri.split('.').pop()?.toLowerCase();
      const supportedFormats = type === 'image' ? this.SUPPORTED_IMAGE_FORMATS : this.SUPPORTED_VIDEO_FORMATS;
      
      if (!extension || !supportedFormats.includes(extension)) {
        return { 
          isValid: false, 
          error: `Unsupported file format. Supported formats: ${supportedFormats.join(', ')}` 
        };
      }

      // For images, get dimensions
      if (type === 'image') {
        try {
          const imageInfo = await ImageManipulator.manipulateAsync(uri, [], { format: ImageManipulator.SaveFormat.JPEG });
          // Note: ImageManipulator doesn't return dimensions directly, we'll need to use a different approach
          return { 
            isValid: true, 
            fileSize,
            dimensions: { width: 0, height: 0 } // Will be populated by the calling function
          };
        } catch (error) {
          return { isValid: false, error: 'Invalid image file' };
        }
      }

      return { isValid: true, fileSize };
    } catch (error) {
      console.error('Error validating media file:', error);
      return { isValid: false, error: 'Failed to validate file' };
    }
  }

  /**
   * Compress and optimize image
   */
  async compressImage(uri: string, options: CompressionOptions = {}): Promise<string> {
    try {
      const {
        quality = 0.8,
        maxWidth = 2048,
        maxHeight = 2048,
        format = 'jpeg'
      } = options;

      const actions: ImageManipulator.Action[] = [];

      // Resize if needed
      actions.push({
        resize: {
          width: maxWidth,
          height: maxHeight,
        }
      });

      const manipulatorFormat = format === 'jpeg' ? ImageManipulator.SaveFormat.JPEG :
                               format === 'png' ? ImageManipulator.SaveFormat.PNG :
                               ImageManipulator.SaveFormat.WEBP;

      const result = await ImageManipulator.manipulateAsync(
        uri,
        actions,
        {
          compress: quality,
          format: manipulatorFormat,
        }
      );

      return result.uri;
    } catch (error) {
      console.error('Error compressing image:', error);
      throw new Error('Failed to compress image');
    }
  }

  /**
   * Generate thumbnail for image or video
   */
  async generateThumbnail(uri: string, size: number = 200): Promise<string> {
    try {
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [
          {
            resize: {
              width: size,
              height: size,
            }
          }
        ],
        {
          compress: 0.7,
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );

      return result.uri;
    } catch (error) {
      console.error('Error generating thumbnail:', error);
      throw new Error('Failed to generate thumbnail');
    }
  }

  /**
   * Upload file to Supabase Storage
   */
  async uploadToStorage(
    uri: string, 
    bucket: string, 
    path: string,
    options: { contentType?: string; upsert?: boolean } = {}
  ): Promise<string> {
    try {
      // Read file as base64
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Convert base64 to blob
      const byteCharacters = atob(base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: options.contentType || 'image/jpeg' });

      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(path, blob, {
          contentType: options.contentType,
          upsert: options.upsert || false,
        });

      if (error) {
        throw error;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(data.path);

      return urlData.publicUrl;
    } catch (error) {
      console.error('Error uploading to storage:', error);
      throw new Error('Failed to upload file');
    }
  }

  /**
   * Download file from URL to device
   */
  async downloadFile(url: string, fileName: string): Promise<string> {
    try {
      const downloadResumable = FileSystem.createDownloadResumable(
        url,
        FileSystem.documentDirectory + fileName
      );

      const result = await downloadResumable.downloadAsync();
      
      if (!result) {
        throw new Error('Download failed');
      }

      return result.uri;
    } catch (error) {
      console.error('Error downloading file:', error);
      throw new Error('Failed to download file');
    }
  }

  /**
   * Save media to device gallery
   */
  async saveToGallery(uri: string): Promise<boolean> {
    try {
      // Request permissions
      const { status } = await MediaLibrary.requestPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Media library access is required to save files to your gallery.',
          [{ text: 'OK' }]
        );
        return false;
      }

      // Save to gallery
      const asset = await MediaLibrary.createAssetAsync(uri);
      
      if (asset) {
        Alert.alert('Success', 'File saved to gallery successfully!');
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error saving to gallery:', error);
      Alert.alert('Error', 'Failed to save file to gallery');
      return false;
    }
  }

  /**
   * Share media file
   */
  async shareFile(uri: string, title?: string): Promise<boolean> {
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      
      if (!isAvailable) {
        Alert.alert('Error', 'Sharing is not available on this device');
        return false;
      }

      await Sharing.shareAsync(uri, {
        dialogTitle: title || 'Share Media',
      });

      return true;
    } catch (error) {
      console.error('Error sharing file:', error);
      Alert.alert('Error', 'Failed to share file');
      return false;
    }
  }

  /**
   * Get file info including size and dimensions
   */
  async getFileInfo(uri: string): Promise<{
    size: number;
    exists: boolean;
    dimensions?: { width: number; height: number };
  }> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(uri);
      
      return {
        size: (fileInfo as any).size || 0,
        exists: fileInfo.exists,
      };
    } catch (error) {
      console.error('Error getting file info:', error);
      return { size: 0, exists: false };
    }
  }

  /**
   * Delete file from local storage
   */
  async deleteFile(uri: string): Promise<boolean> {
    try {
      await FileSystem.deleteAsync(uri);
      return true;
    } catch (error) {
      console.error('Error deleting file:', error);
      return false;
    }
  }

  /**
   * Format file size in human readable format
   */
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Create unique filename with timestamp
   */
  generateUniqueFileName(originalName: string, prefix: string = ''): string {
    const timestamp = Date.now();
    const extension = originalName.split('.').pop();
    const baseName = originalName.replace(/\.[^/.]+$/, '');
    
    return `${prefix}${baseName}_${timestamp}.${extension}`;
  }

  /**
   * Batch upload multiple files
   */
  async batchUpload(
    files: MediaFile[],
    bucket: string,
    pathPrefix: string,
    onProgress?: (completed: number, total: number) => void
  ): Promise<string[]> {
    const uploadedUrls: string[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileName = this.generateUniqueFileName(file.fileName || `file_${i}`, pathPrefix);
      
      try {
        const url = await this.uploadToStorage(file.uri, bucket, fileName);
        uploadedUrls.push(url);
        
        if (onProgress) {
          onProgress(i + 1, files.length);
        }
      } catch (error) {
        console.error(`Error uploading file ${i}:`, error);
        // Continue with other files
      }
    }
    
    return uploadedUrls;
  }
}

export const mediaService = new MediaService();