import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

export interface ImagePickerResult {
  uri: string;
  width: number;
  height: number;
  type: string;
  fileSize?: number;
  duration?: number; // For videos
}

export interface UseImagePickerReturn {
  pickImage: (options?: {
    allowsEditing?: boolean;
    aspect?: [number, number];
    quality?: number;
  }) => Promise<ImagePickerResult | null>;
  pickMultipleImages: (options?: {
    quality?: number;
    maxImages?: number;
  }) => Promise<ImagePickerResult[]>;
  pickVideo: (options?: {
    allowsEditing?: boolean;
    quality?: number;
    durationLimit?: number;
  }) => Promise<ImagePickerResult | null>;
  pickMedia: (options?: {
    allowsEditing?: boolean;
    quality?: number;
    maxImages?: number;
  }) => Promise<ImagePickerResult[]>;
  takePhoto: (options?: {
    allowsEditing?: boolean;
    aspect?: [number, number];
    quality?: number;
  }) => Promise<ImagePickerResult | null>;
  recordVideo: (options?: {
    allowsEditing?: boolean;
    quality?: number;
    durationLimit?: number;
  }) => Promise<ImagePickerResult | null>;
  requestPermissions: () => Promise<boolean>;
  hasPermissions: boolean;
}

export function useImagePicker(): UseImagePickerReturn {
  const [hasPermissions, setHasPermissions] = useState(false);

  const requestPermissions = async (): Promise<boolean> => {
    try {
      // Request camera permissions
      const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
      
      // Request media library permissions
      const mediaPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      const granted = cameraPermission.status === 'granted' && mediaPermission.status === 'granted';
      setHasPermissions(granted);

      if (!granted) {
        Alert.alert(
          'Permissions Required',
          'Camera and photo library access are required to upload images for video generation.',
          [{ text: 'OK' }]
        );
      }

      return granted;
    } catch (error) {
      console.error('Error requesting permissions:', error);
      return false;
    }
  };

  const pickImage = async (options: {
    allowsEditing?: boolean;
    aspect?: [number, number];
    quality?: number;
  } = {}): Promise<ImagePickerResult | null> => {
    try {
      // Check permissions first
      const hasPermission = hasPermissions || await requestPermissions();
      if (!hasPermission) {
        return null;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: options.allowsEditing ?? true,
        aspect: options.aspect ?? [16, 9],
        quality: options.quality ?? 0.8,
        exif: false,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return null;
      }

      const asset = result.assets[0];
      return {
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
        type: asset.type || 'image',
        fileSize: asset.fileSize,
        duration: asset.duration ?? undefined,
      };
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
      return null;
    }
  };

  const takePhoto = async (options: {
    allowsEditing?: boolean;
    aspect?: [number, number];
    quality?: number;
  } = {}): Promise<ImagePickerResult | null> => {
    try {
      // Check permissions first
      const hasPermission = hasPermissions || await requestPermissions();
      if (!hasPermission) {
        return null;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: options.allowsEditing ?? true,
        aspect: options.aspect ?? [16, 9],
        quality: options.quality ?? 0.8,
        exif: false,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return null;
      }

      const asset = result.assets[0];
      return {
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
        type: asset.type || 'image',
        fileSize: asset.fileSize,
        duration: asset.duration ?? undefined,
      };
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
      return null;
    }
  };

  const recordVideo = async (options: {
    allowsEditing?: boolean;
    quality?: number;
    durationLimit?: number;
  } = {}): Promise<ImagePickerResult | null> => {
    try {
      // Check permissions first
      const hasPermission = hasPermissions || await requestPermissions();
      if (!hasPermission) {
        return null;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['videos'],
        allowsEditing: options.allowsEditing ?? false,
        quality: options.quality ?? 0.8,
        videoMaxDuration: options.durationLimit ?? 60, // 60 seconds default
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return null;
      }

      const asset = result.assets[0];
      return {
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
        type: asset.type || 'video',
        fileSize: asset.fileSize,
        duration: asset.duration ?? undefined,
      };
    } catch (error) {
      console.error('Error recording video:', error);
      Alert.alert('Error', 'Failed to record video. Please try again.');
      return null;
    }
  };

  const pickMultipleImages = async (options: {
    quality?: number;
    maxImages?: number;
  } = {}): Promise<ImagePickerResult[]> => {
    try {
      // Check permissions first
      const hasPermission = hasPermissions || await requestPermissions();
      if (!hasPermission) {
        return [];
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        allowsMultipleSelection: true,
        quality: options.quality ?? 0.8,
        exif: false,
        selectionLimit: options.maxImages ?? 10,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return [];
      }

      return result.assets.map(asset => ({
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
        type: asset.type || 'image',
        fileSize: asset.fileSize,
        duration: asset.duration ?? undefined,
      }));
    } catch (error) {
      console.error('Error picking multiple images:', error);
      Alert.alert('Error', 'Failed to pick images. Please try again.');
      return [];
    }
  };

  const pickVideo = async (options: {
    allowsEditing?: boolean;
    quality?: number;
    durationLimit?: number;
  } = {}): Promise<ImagePickerResult | null> => {
    try {
      // Check permissions first
      const hasPermission = hasPermissions || await requestPermissions();
      if (!hasPermission) {
        return null;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        allowsEditing: options.allowsEditing ?? false,
        quality: options.quality ?? 0.8,
        videoMaxDuration: options.durationLimit ?? 60, // 60 seconds default
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return null;
      }

      const asset = result.assets[0];
      return {
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
        type: asset.type || 'video',
        fileSize: asset.fileSize,
        duration: asset.duration ?? undefined,
      };
    } catch (error) {
      console.error('Error picking video:', error);
      Alert.alert('Error', 'Failed to pick video. Please try again.');
      return null;
    }
  };

  const pickMedia = async (options: {
    allowsEditing?: boolean;
    quality?: number;
    maxImages?: number;
  } = {}): Promise<ImagePickerResult[]> => {
    try {
      // Check permissions first
      const hasPermission = hasPermissions || await requestPermissions();
      if (!hasPermission) {
        return [];
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        allowsEditing: false,
        allowsMultipleSelection: true,
        quality: options.quality ?? 0.8,
        selectionLimit: options.maxImages ?? 10,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return [];
      }

      return result.assets.map(asset => ({
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
        type: asset.type || 'image',
        fileSize: asset.fileSize,
        duration: asset.duration ?? undefined,
      }));
    } catch (error) {
      console.error('Error picking media:', error);
      Alert.alert('Error', 'Failed to pick media. Please try again.');
      return [];
    }
  };

  return {
    pickImage,
    pickMultipleImages,
    pickVideo,
    pickMedia,
    takePhoto,
    recordVideo,
    requestPermissions,
    hasPermissions,
  };
}