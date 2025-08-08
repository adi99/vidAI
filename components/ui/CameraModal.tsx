import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    Dimensions,
    Platform,
    StatusBar,
} from 'react-native';
import { CameraView } from 'expo-camera';

type CameraType = 'front' | 'back';
type FlashMode = 'on' | 'off' | 'auto';
import { MotiView } from 'moti';
import { Surface, useTheme } from 'react-native-paper';
import {
    X,
    Camera as CameraIcon,
    RotateCcw,
    Zap,
    ZapOff,
    Check
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';

interface CameraModalProps {
    visible: boolean;
    onClose: () => void;
    onPhotoTaken: (uri: string) => void;
    aspectRatio?: [number, number];
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function CameraModal({
    visible,
    onClose,
    onPhotoTaken,
    aspectRatio = [16, 9],
}: CameraModalProps) {
    const theme = useTheme();
    const cameraRef = useRef<CameraView>(null);
    const [type, setType] = useState<CameraType>('back');
    const [flash, setFlash] = useState<FlashMode>('off');
    const [isReady, setIsReady] = useState(false);
    const [isTakingPhoto, setIsTakingPhoto] = useState(false);

    const handleClose = useCallback(async () => {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onClose();
    }, [onClose]);

    const toggleCameraType = useCallback(async () => {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setType((current: CameraType) =>
            current === 'back' ? 'front' : 'back'
        );
    }, []);

    const toggleFlash = useCallback(async () => {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setFlash((current: FlashMode) =>
            current === 'off' ? 'on' : 'off'
        );
    }, []);

    const takePicture = useCallback(async () => {
        if (!cameraRef.current || isTakingPhoto) return;

        setIsTakingPhoto(true);
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

        try {
            const photo = await cameraRef.current.takePictureAsync({
                quality: 0.8,
                base64: false,
                skipProcessing: false,
            });

            if (photo?.uri) {
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                onPhotoTaken(photo.uri);
                onClose();
            }
        } catch (error) {
            console.error('Error taking photo:', error);
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } finally {
            setIsTakingPhoto(false);
        }
    }, [isTakingPhoto, onPhotoTaken, onClose]);

    const onCameraReady = useCallback(() => {
        setIsReady(true);
    }, []);

    // Calculate camera dimensions based on aspect ratio
    const cameraAspectRatio = aspectRatio[0] / aspectRatio[1];
    const cameraHeight = screenWidth / cameraAspectRatio;

    if (!visible) return null;

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="fullScreen"
            onRequestClose={handleClose}
        >
            <StatusBar hidden />
            <View style={styles.container}>
                {Platform.OS === 'web' ? (
                    // Web fallback
                    <View style={styles.webFallback}>
                        <Text style={styles.webFallbackText}>
                            Camera not available on web. Please use the gallery option.
                        </Text>
                        <TouchableOpacity onPress={handleClose} style={styles.webCloseButton}>
                            <Text style={styles.webCloseButtonText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <>
                        {/* Camera View */}
                        <View style={styles.cameraContainer}>
                            <CameraView
                                ref={cameraRef}
                                style={[
                                    styles.camera,
                                    {
                                        height: Math.min(cameraHeight, screenHeight * 0.7),
                                    }
                                ]}
                                facing={type}
                                flash={flash}
                                onCameraReady={onCameraReady}
                            />

                            {/* Camera Overlay */}
                            <LinearGradient
                                colors={['rgba(0,0,0,0.3)', 'transparent', 'rgba(0,0,0,0.3)']}
                                style={styles.cameraOverlay}
                            >
                                {/* Top Controls */}
                                <View style={styles.topControls}>
                                    <TouchableOpacity
                                        onPress={handleClose}
                                        style={styles.controlButton}
                                    >
                                        <X size={24} color="#FFFFFF" />
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        onPress={toggleFlash}
                                        style={[
                                            styles.controlButton,
                                            flash === 'on' && styles.activeControlButton
                                        ]}
                                    >
                                        {flash === 'on' ? (
                                            <Zap size={24} color="#FFFFFF" />
                                        ) : (
                                            <ZapOff size={24} color="#FFFFFF" />
                                        )}
                                    </TouchableOpacity>
                                </View>

                                {/* Center Guide */}
                                <View style={styles.centerGuide}>
                                    <View style={styles.focusFrame} />
                                </View>

                                {/* Bottom Controls */}
                                <View style={styles.bottomControls}>
                                    <View style={styles.controlsRow}>
                                        {/* Flip Camera */}
                                        <TouchableOpacity
                                            onPress={toggleCameraType}
                                            style={styles.controlButton}
                                            disabled={isTakingPhoto}
                                        >
                                            <RotateCcw size={24} color="#FFFFFF" />
                                        </TouchableOpacity>

                                        {/* Capture Button */}
                                        <MotiView
                                            animate={{
                                                scale: isTakingPhoto ? 0.9 : 1,
                                            }}
                                            transition={{
                                                type: 'spring',
                                                damping: 15,
                                                stiffness: 300,
                                            }}
                                        >
                                            <TouchableOpacity
                                                onPress={takePicture}
                                                disabled={!isReady || isTakingPhoto}
                                                style={[
                                                    styles.captureButton,
                                                    (!isReady || isTakingPhoto) && styles.captureButtonDisabled
                                                ]}
                                            >
                                                <View style={styles.captureButtonInner}>
                                                    {isTakingPhoto ? (
                                                        <Check size={32} color="#FFFFFF" />
                                                    ) : (
                                                        <CameraIcon size={32} color="#FFFFFF" />
                                                    )}
                                                </View>
                                            </TouchableOpacity>
                                        </MotiView>

                                        {/* Placeholder for symmetry */}
                                        <View style={styles.controlButton} />
                                    </View>
                                </View>
                            </LinearGradient>
                        </View>

                        {/* Instructions */}
                        <Surface style={[styles.instructions, { backgroundColor: theme.colors.surface }]}>
                            <Text style={[styles.instructionsText, { color: theme.colors.onSurface }]}>
                                {!isReady
                                    ? 'Preparing camera...'
                                    : isTakingPhoto
                                        ? 'Taking photo...'
                                        : 'Tap the capture button to take a photo'
                                }
                            </Text>
                        </Surface>
                    </>
                )}
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000000',
    },
    cameraContainer: {
        flex: 1,
        justifyContent: 'center',
    },
    camera: {
        width: '100%',
    },
    cameraOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'space-between',
    },
    topControls: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 50,
    },
    centerGuide: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    focusFrame: {
        width: 200,
        height: 200,
        borderWidth: 2,
        borderColor: 'rgba(255, 255, 255, 0.5)',
        borderRadius: 8,
    },
    bottomControls: {
        paddingHorizontal: 20,
        paddingBottom: 50,
    },
    controlsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    controlButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    activeControlButton: {
        backgroundColor: 'rgba(139, 92, 246, 0.8)',
    },
    captureButton: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 4,
        borderColor: '#FFFFFF',
    },
    captureButtonDisabled: {
        opacity: 0.5,
    },
    captureButtonInner: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    instructions: {
        margin: 20,
        padding: 16,
        borderRadius: 12,
    },
    instructionsText: {
        fontSize: 14,
        textAlign: 'center',
        fontWeight: '500',
    },
    webFallback: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    webFallbackText: {
        fontSize: 16,
        color: '#FFFFFF',
        textAlign: 'center',
        marginBottom: 20,
    },
    webCloseButton: {
        backgroundColor: '#8B5CF6',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 20,
    },
    webCloseButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
});