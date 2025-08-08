import { Dimensions } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';

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

export const generateThumbnail = async (imageUri: string, size: number = 200): Promise<string> => {
  try {
    const result = await ImageManipulator.manipulateAsync(
      imageUri,
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
    // Fallback to original URI
    return imageUri;
  }
};

export const validateImageFormat = (uri: string): boolean => {
  const validExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
  return validExtensions.some(ext => uri.toLowerCase().includes(ext));
};

export const compressImage = async (
  uri: string, 
  quality: number = 0.8,
  maxWidth: number = 2048,
  maxHeight: number = 2048
): Promise<string> => {
  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [
        {
          resize: {
            width: maxWidth,
            height: maxHeight,
          }
        }
      ],
      {
        compress: quality,
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );
    return result.uri;
  } catch (error) {
    console.error('Error compressing image:', error);
    return uri; // Return original if compression fails
  }
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

export const getAspectRatio = (width: number, height: number): string => {
  const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
  const divisor = gcd(width, height);
  return `${width / divisor}:${height / divisor}`;
};

export const cropImage = async (
  uri: string,
  cropData: {
    originX: number;
    originY: number;
    width: number;
    height: number;
  }
): Promise<string> => {
  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [
        {
          crop: cropData
        }
      ],
      {
        compress: 0.9,
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );
    return result.uri;
  } catch (error) {
    console.error('Error cropping image:', error);
    throw new Error('Failed to crop image');
  }
};

export const rotateImage = async (uri: string, degrees: number): Promise<string> => {
  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [
        {
          rotate: degrees
        }
      ],
      {
        compress: 0.9,
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );
    return result.uri;
  } catch (error) {
    console.error('Error rotating image:', error);
    throw new Error('Failed to rotate image');
  }
};

export const flipImage = async (uri: string, direction: 'horizontal' | 'vertical'): Promise<string> => {
  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [
        {
          flip: direction === 'horizontal' 
            ? ImageManipulator.FlipType.Horizontal 
            : ImageManipulator.FlipType.Vertical
        }
      ],
      {
        compress: 0.9,
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );
    return result.uri;
  } catch (error) {
    console.error('Error flipping image:', error);
    throw new Error('Failed to flip image');
  }
};

export const resizeImage = async (
  uri: string,
  width: number,
  height: number,
  maintainAspectRatio: boolean = true
): Promise<string> => {
  try {
    const resizeOptions = maintainAspectRatio 
      ? { width, height }
      : { width, height };

    const result = await ImageManipulator.manipulateAsync(
      uri,
      [
        {
          resize: resizeOptions
        }
      ],
      {
        compress: 0.9,
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );
    return result.uri;
  } catch (error) {
    console.error('Error resizing image:', error);
    throw new Error('Failed to resize image');
  }
};

export const convertImageFormat = async (
  uri: string,
  format: 'jpeg' | 'png' | 'webp',
  quality: number = 0.9
): Promise<string> => {
  try {
    const manipulatorFormat = format === 'jpeg' ? ImageManipulator.SaveFormat.JPEG :
                             format === 'png' ? ImageManipulator.SaveFormat.PNG :
                             ImageManipulator.SaveFormat.WEBP;

    const result = await ImageManipulator.manipulateAsync(
      uri,
      [], // No transformations, just format conversion
      {
        compress: quality,
        format: manipulatorFormat,
      }
    );
    return result.uri;
  } catch (error) {
    console.error('Error converting image format:', error);
    throw new Error('Failed to convert image format');
  }
};