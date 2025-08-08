import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Camera } from 'expo-camera';
import * as Haptics from 'expo-haptics';

interface UseImageUploadOptions {
  aspectRatio?: [number, number];
  quality?: number;
  allowsEditing?: boolean;
}

interface UseImageUploadReturn {
  isUploading: boolean;
  takePhoto: (options?: UseImageUploadOptions) => Promise<string | null>;
  pickFromGallery: (options?: UseImageUploadOptions) => Promise<string | null>;
  requestCameraPermission: () => Promise<boolean>;
  requestLibraryPermission: () => Promise<boolean>;
  hasCameraPermission: () => Promise<boolean>;
  hasLibraryPermission: () => Promise<boolean>;
}

export function useImageUpload(): UseImageUploadReturn {
  const [isUploading, setIsUploading] = useState(false);

  const requestCameraPermission = useCallback(async (): Promise<boolean> => {
    // Request both Camera and ImagePicker camera permissions
    const [cameraStatus, imagePickerStatus] = await Promise.all([
      Camera.requestCameraPermissionsAsync(),
      ImagePicker.requestCameraPermissionsAsync(),
    ]);

    if (cameraStatus.status !== 'granted' || imagePickerStatus.status !== 'granted') {
      Alert.alert(
        'Camera Permission Required',
        'Please grant camera permissions to take photos. You can enable this in your device settings.',
        [{ text: 'OK' }]
      );
      return false;
    }
    return true;
  }, []);

  const hasCameraPermission = useCallback(async (): Promise<boolean> => {
    const [cameraStatus, imagePickerStatus] = await Promise.all([
      Camera.getCameraPermissionsAsync(),
      ImagePicker.getCameraPermissionsAsync(),
    ]);
    return cameraStatus.status === 'granted' && imagePickerStatus.status === 'granted';
  }, []);

  const requestLibraryPermission = useCallback(async (): Promise<boolean> => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Photo Library Permission Required',
        'Please grant photo library permissions to select images. You can enable this in your device settings.',
        [{ text: 'OK' }]
      );
      return false;
    }
    return true;
  }, []);

  const hasLibraryPermission = useCallback(async (): Promise<boolean> => {
    const { status } = await ImagePicker.getMediaLibraryPermissionsAsync();
    return status === 'granted';
  }, []);

  const takePhoto = useCallback(async (options: UseImageUploadOptions = {}): Promise<string | null> => {
    const {
      aspectRatio = [16, 9],
      quality = 0.8,
      allowsEditing = true,
    } = options;

    const hasPermission = await requestCameraPermission();
    if (!hasPermission) return null;

    setIsUploading(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing,
        aspect: aspectRatio,
        quality,
      });

      if (!result.canceled && result.assets[0]) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        return result.assets[0].uri;
      }
      return null;
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return null;
    } finally {
      setIsUploading(false);
    }
  }, [requestCameraPermission]);

  const pickFromGallery = useCallback(async (options: UseImageUploadOptions = {}): Promise<string | null> => {
    const {
      aspectRatio = [16, 9],
      quality = 0.8,
      allowsEditing = true,
    } = options;

    const hasPermission = await requestLibraryPermission();
    if (!hasPermission) return null;

    setIsUploading(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing,
        aspect: aspectRatio,
        quality,
      });

      if (!result.canceled && result.assets[0]) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        return result.assets[0].uri;
      }
      return null;
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return null;
    } finally {
      setIsUploading(false);
    }
  }, [requestLibraryPermission]);

  return {
    isUploading,
    takePhoto,
    pickFromGallery,
    requestCameraPermission,
    requestLibraryPermission,
    hasCameraPermission,
    hasLibraryPermission,
  };
}