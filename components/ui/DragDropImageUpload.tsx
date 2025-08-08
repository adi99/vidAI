import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Image, Alert, Platform } from 'react-native';
import { MotiView, MotiText } from 'moti';
import { Button, Surface, useTheme } from 'react-native-paper';
import { Upload, Image as ImageIcon, X, Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';

interface DragDropImageUploadProps {
  onImageSelected: (uri: string) => void;
  onImageRemoved?: () => void;
  selectedImage?: string | null;
  placeholder?: string;
  aspectRatio?: number;
  maxWidth?: number;
  maxHeight?: number;
  disabled?: boolean;
}

export default function DragDropImageUpload({
  onImageSelected,
  onImageRemoved,
  selectedImage,
  placeholder = "Tap to upload an image or drag & drop",
  aspectRatio = 16 / 9,
  maxWidth = 300,
  maxHeight = 200,
  disabled = false,
}: DragDropImageUploadProps) {
  const theme = useTheme();
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Please grant camera roll permissions to upload images.'
      );
      return false;
    }
    return true;
  };

  const pickImage = useCallback(async () => {
    if (disabled) return;
    
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    setIsUploading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [aspectRatio * 100, 100],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        onImageSelected(result.assets[0].uri);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsUploading(false);
    }
  }, [disabled, aspectRatio, onImageSelected]);

  const takePhoto = useCallback(async () => {
    if (disabled) return;

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Please grant camera permissions to take photos.'
      );
      return;
    }

    setIsUploading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [aspectRatio * 100, 100],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        onImageSelected(result.assets[0].uri);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsUploading(false);
    }
  }, [disabled, aspectRatio, onImageSelected]);

  const removeImage = useCallback(() => {
    if (disabled) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onImageRemoved?.();
  }, [disabled, onImageRemoved]);

  const showActionSheet = useCallback(() => {
    if (Platform.OS === 'ios') {
      Alert.alert(
        'Select Image',
        'Choose how you want to add an image',
        [
          { text: 'Camera', onPress: takePhoto },
          { text: 'Photo Library', onPress: pickImage },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    } else {
      // For Android, show a simple choice
      Alert.alert(
        'Select Image',
        'Choose how you want to add an image',
        [
          { text: 'Camera', onPress: takePhoto },
          { text: 'Gallery', onPress: pickImage },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    }
  }, [pickImage, takePhoto]);

  return (
    <MotiView
      animate={{
        scale: isDragOver ? 1.02 : 1,
        opacity: disabled ? 0.6 : 1,
      }}
      transition={{
        type: 'spring',
        damping: 20,
        stiffness: 300,
      }}
      style={[styles.container, { maxWidth, maxHeight }]}
    >
      <Surface
        style={[
          styles.surface,
          {
            backgroundColor: theme.colors.surface,
            borderColor: isDragOver ? theme.colors.primary : theme.colors.outline,
            borderWidth: isDragOver ? 2 : 1,
          }
        ]}
        elevation={isDragOver ? 3 : 1}
      >
        {selectedImage ? (
          <MotiView
            from={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              type: 'spring',
              damping: 15,
              stiffness: 200,
            }}
            style={styles.imageContainer}
          >
            <Image source={{ uri: selectedImage }} style={styles.selectedImage} />
            
            {/* Success indicator */}
            <MotiView
              from={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{
                type: 'spring',
                damping: 15,
                stiffness: 300,
                delay: 200,
              }}
              style={[styles.successIndicator, { backgroundColor: theme.colors.primary }]}
            >
              <Check size={16} color={theme.colors.onPrimary} />
            </MotiView>

            {/* Remove button */}
            <MotiView
              from={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{
                type: 'spring',
                damping: 15,
                stiffness: 300,
                delay: 300,
              }}
              style={styles.removeButton}
            >
              <Button
                mode="contained"
                onPress={removeImage}
                icon={({ size, color }) => <X size={size} color={color} />}
                compact
                style={[styles.removeButtonStyle, { backgroundColor: theme.colors.error }]}
                labelStyle={styles.removeButtonLabel}
              >
                Remove
              </Button>
            </MotiView>
          </MotiView>
        ) : (
          <MotiView
            animate={{
              scale: isUploading ? 0.95 : 1,
            }}
            transition={{
              type: 'spring',
              damping: 15,
              stiffness: 200,
            }}
            style={styles.uploadArea}
          >
            <LinearGradient
              colors={[
                theme.colors.primary + '20',
                theme.colors.primary + '10',
                'transparent'
              ]}
              style={styles.gradientBackground}
            />
            
            <MotiView
              animate={{
                scale: isUploading ? 1.2 : 1,
                rotate: isUploading ? '360deg' : '0deg',
              }}
              transition={{
                type: 'spring',
                repeat: isUploading ? -1 : 0,
                damping: 15,
                stiffness: 200,
              }}
              style={[styles.iconContainer, { backgroundColor: theme.colors.primary + '20' }]}
            >
              {isUploading ? (
                <Upload size={32} color={theme.colors.primary} />
              ) : (
                <ImageIcon size={32} color={theme.colors.primary} />
              )}
            </MotiView>

            <MotiText
              animate={{
                opacity: isUploading ? 0.7 : 1,
              }}
              style={[styles.placeholderText, { color: theme.colors.onSurface }]}
            >
              {isUploading ? 'Uploading...' : placeholder}
            </MotiText>

            <View style={styles.buttonContainer}>
              <Button
                mode="outlined"
                onPress={showActionSheet}
                disabled={disabled || isUploading}
                icon={({ size, color }) => <Upload size={size} color={color} />}
                style={styles.uploadButton}
              >
                {isUploading ? 'Uploading...' : 'Select Image'}
              </Button>
            </View>
          </MotiView>
        )}
      </Surface>
    </MotiView>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  surface: {
    borderRadius: 12,
    padding: 16,
    borderStyle: 'dashed',
    minHeight: 150,
  },
  imageContainer: {
    position: 'relative',
    alignItems: 'center',
  },
  selectedImage: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    resizeMode: 'cover',
  },
  successIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButton: {
    position: 'absolute',
    bottom: 8,
    right: 8,
  },
  removeButtonStyle: {
    borderRadius: 20,
  },
  removeButtonLabel: {
    fontSize: 12,
  },
  uploadArea: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
    position: 'relative',
  },
  gradientBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 8,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  placeholderText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  uploadButton: {
    borderRadius: 20,
  },
});