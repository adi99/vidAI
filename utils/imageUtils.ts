import { Dimensions } from 'react-native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export const getImageDimensions = (
  originalWidth: number,
  originalHeight: number,
  maxWidth: number = screenWidth - 40,
  maxHeight: number = screenHeight * 0.6
) => {
  const aspectRatio = originalWidth / originalHeight;
  
  let width = originalWidth;
  let height = originalHeight;
  
  if (width > maxWidth) {
    width = maxWidth;
    height = width / aspectRatio;
  }
  
  if (height > maxHeight) {
    height = maxHeight;
    width = height * aspectRatio;
  }
  
  return { width, height };
};

export const generateThumbnail = (imageUri: string, size: number = 200): string => {
  // In a real app, this would generate a thumbnail
  // For now, we'll return the original URI with size parameters
  return `${imageUri}&w=${size}&h=${size}`;
};

export const validateImageFormat = (uri: string): boolean => {
  const validExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
  return validExtensions.some(ext => uri.toLowerCase().includes(ext));
};

export const compressImage = async (uri: string, quality: number = 0.8): Promise<string> => {
  // Mock compression - in a real app, you'd use expo-image-manipulator
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(uri);
    }, 500);
  });
};

export const getImageGridSize = (numColumns: number = 2, spacing: number = 12): number => {
  const totalSpacing = spacing * (numColumns + 1);
  return (screenWidth - totalSpacing) / numColumns;
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};