import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Upload, Image as ImageIcon, CircleCheck as CheckCircle, Clock, Zap, Star, Crown, Brain, Camera, Trash2, Plus, CircleAlert as AlertCircle, TrendingUp, Shield } from 'lucide-react-native';

export default function TrainingScreen() {
  const [uploadedImages, setUploadedImages] = useState<number>(0);
  const [selectedSteps, setSelectedSteps] = useState<600 | 1200 | 2000>(1200);
  const [isTraining, setIsTraining] = useState(false);
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [selectedTriggerWord, setSelectedTriggerWord] = useState('');

  const handleImageUpload = () => {
    if (uploadedImages < 30) {
      setUploadedImages(prev => prev + 1);
    } else {
      Alert.alert('Limit Reached', 'Maximum 30 images allowed for optimal training');
    }
  };

  const removeImage = () => {
    if (uploadedImages > 0) {
      setUploadedImages(prev => prev - 1);
    }
  };

  const startTraining = () => {
    if (uploadedImages < 10) {
      Alert.alert('Insufficient Images', 'Please upload at least 10 high-quality images for effective training');
      return;
    }
    
    setIsTraining(true);
    setTrainingProgress(0);
    
    // Simulate training process
    const interval = setInterval(() => {
      setTrainingProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsTraining(false);
          Alert.alert('Training Complete', 'Your custom LoRA model is ready to use!');
          return 100;
        }
        return prev + 2;
      });
    }, 200);
  };

  const trainingSteps = [
    {
      steps: 600,
      duration: '~15 min',
      quality: 'Good Quality',
      price: '$2.99',
      icon: <Clock size={24} color="#FFFFFF" />,
      description: 'Quick training for basic personalization',
      recommended: false,
    },
    {
      steps: 1200,
      duration: '~30 min',
      quality: 'High Quality',
      price: '$4.99',
      icon: <Zap size={24} color="#FFFFFF" />,
      description: 'Balanced training for excellent results',
      recommended: true,
    },
    {
      steps: 2000,
      duration: '~50 min',
      quality: 'Premium Quality',
      price: '$7.99',
      icon: <Crown size={24} color="#FFFFFF" />,
      description: 'Maximum quality for professional use',
      recommended: false,
    },
  ];

  const guidelines = [
    { text: 'High resolution images (1024px or higher)', icon: <ImageIcon size={16} color="#10B981" /> },
    { text: 'Good lighting and clear facial features', icon: <Camera size={16} color="#10B981" /> },
    { text: 'Variety of angles and expressions', icon: <TrendingUp size={16} color="#10B981" /> },
    { text: 'Consistent subject across all images', icon: <Shield size={16} color="#10B981" /> },
    { text: 'Avoid blurry or low-quality photos', icon: <AlertCircle size={16} color="#F59E0B" /> },
  ];

  const TrainingStepCard = ({ step }: { step: any }) => (
    <TouchableOpacity
      style={[
        styles.stepCard,
        selectedSteps === step.steps && styles.selectedStepCard,
        step.recommended && styles.recommendedCard
      ]}
      onPress={() => setSelectedSteps(step.steps)}
    >
      {step.recommended && (
        <View style={styles.recommendedBadge}>
          <Star size={12} color="#FFFFFF" />
          <Text style={styles.recommendedText}>RECOMMENDED</Text>
        </View>
      )}
      <LinearGradient
        colors={selectedSteps === step.steps ? ['#F59E0B', '#EF4444'] : ['#374151', '#374151']}
        style={styles.stepIconContainer}
      >
        {step.icon}
      </LinearGradient>
      <View style={styles.stepContent}>
        <Text style={styles.stepTitle}>{step.steps} Steps</Text>
        <Text style={styles.stepQuality}>{step.quality}</Text>
        <Text style={styles.stepDescription}>{step.description}</Text>
        <View style={styles.stepFooter}>
          <Text style={styles.stepDuration}>{step.duration}</Text>
          <Text style={styles.stepPrice}>{step.price}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const ImageSlot = ({ index }: { index: number }) => (
    <TouchableOpacity
      style={[
        styles.imageSlot,
        index < uploadedImages ? styles.filledImageSlot : styles.emptyImageSlot
      ]}
      onPress={index < uploadedImages ? removeImage : handleImageUpload}
    >
      {index < uploadedImages ? (
        <>
          <View style={styles.imagePreview}>
            <ImageIcon size={20} color="#8B5CF6" />
          </View>
          <TouchableOpacity style={styles.removeButton} onPress={removeImage}>
            <Trash2 size={12} color="#FFFFFF" />
          </TouchableOpacity>
        </>
      ) : (
        <Plus size={20} color="#6B7280" />
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={['#F59E0B', '#EF4444']}
          style={styles.header}
        >
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Custom Model Training</Text>
            <Text style={styles.headerSubtitle}>
              Train your personal SDXL LoRA model for unique AI generations
            </Text>
            <View style={styles.headerStats}>
              <View style={styles.statItem}>
                <Brain size={16} color="#FFFFFF" />
                <Text style={styles.statText}>SDXL Base</Text>
              </View>
              <View style={styles.statItem}>
                <Zap size={16} color="#FFFFFF" />
                <Text style={styles.statText}>LoRA Training</Text>
              </View>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.content}>
          <View style={styles.uploadSection}>
            <View style={styles.uploadHeader}>
              <Text style={styles.sectionTitle}>Training Images</Text>
              <View style={styles.uploadCounter}>
                <Text style={styles.counterText}>{uploadedImages}/30</Text>
              </View>
            </View>
            <Text style={styles.sectionSubtitle}>
              Upload 10-30 high-quality images of the same subject for optimal results
            </Text>
            
            <View style={styles.imagesGrid}>
              {Array.from({ length: 12 }, (_, index) => (
                <ImageSlot key={index} index={index} />
              ))}
            </View>

            <TouchableOpacity
              style={styles.uploadButton}
              onPress={handleImageUpload}
            >
              <LinearGradient
                colors={['#8B5CF6', '#3B82F6']}
                style={styles.uploadGradient}
              >
                <Upload size={24} color="#FFFFFF" />
                <Text style={styles.uploadButtonText}>Add More Images</Text>
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill, 
                    { width: `${Math.min((uploadedImages / 10) * 100, 100)}%` }
                  ]} 
                />
              </View>
              <Text style={styles.progressText}>
                {uploadedImages >= 10 
                  ? `Ready to train! ${uploadedImages} images uploaded` 
                  : `${Math.max(10 - uploadedImages, 0)} more images needed to start training`
                }
              </Text>
            </View>
          </View>

          <View style={styles.guidelinesSection}>
            <Text style={styles.guidelinesTitle}>Image Quality Guidelines</Text>
            <View style={styles.guidelinesGrid}>
              {guidelines.map((guideline, index) => (
                <View key={index} style={styles.guideline}>
                  <View style={styles.guidelineIcon}>
                    {guideline.icon}
                  </View>
                  <Text style={styles.guidelineText}>{guideline.text}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.stepsSection}>
            <Text style={styles.sectionTitle}>Training Configuration</Text>
            <Text style={styles.sectionSubtitle}>
              Choose training intensity based on your quality requirements and time constraints
            </Text>
            
            <View style={styles.stepsContainer}>
              {trainingSteps.map((step) => (
                <TrainingStepCard key={step.steps} step={step} />
              ))}
            </View>
          </View>

          <View style={styles.modelInfoSection}>
            <Text style={styles.sectionTitle}>Model Specifications</Text>
            <View style={styles.modelInfoGrid}>
              <View style={styles.modelInfoCard}>
                <LinearGradient
                  colors={['#8B5CF6', '#3B82F6']}
                  style={styles.modelInfoIcon}
                >
                  <Brain size={24} color="#FFFFFF" />
                </LinearGradient>
                <View style={styles.modelInfoContent}>
                  <Text style={styles.modelInfoLabel}>Base Model</Text>
                  <Text style={styles.modelInfoValue}>Stable Diffusion XL</Text>
                  <Text style={styles.modelInfoSubtext}>Latest SDXL architecture</Text>
                </View>
              </View>
              
              <View style={styles.modelInfoCard}>
                <LinearGradient
                  colors={['#F59E0B', '#EF4444']}
                  style={styles.modelInfoIcon}
                >
                  <Zap size={24} color="#FFFFFF" />
                </LinearGradient>
                <View style={styles.modelInfoContent}>
                  <Text style={styles.modelInfoLabel}>Training Type</Text>
                  <Text style={styles.modelInfoValue}>LoRA Adaptation</Text>
                  <Text style={styles.modelInfoSubtext}>Low-rank fine-tuning</Text>
                </View>
              </View>
            </View>
          </View>

          {isTraining && (
            <View style={styles.trainingProgressSection}>
              <View style={styles.trainingHeader}>
                <Brain size={20} color="#F59E0B" />
                <Text style={styles.trainingTitle}>Training in Progress</Text>
              </View>
              <View style={styles.trainingProgressBar}>
                <View style={[styles.trainingProgressFill, { width: `${trainingProgress}%` }]} />
              </View>
              <Text style={styles.trainingProgressText}>{trainingProgress}% complete</Text>
              <Text style={styles.trainingSubtext}>
                Training your custom model with {uploadedImages} images using {selectedSteps} steps
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.trainButton,
              uploadedImages < 10 && styles.disabledTrainButton,
              isTraining && styles.trainingButton
            ]}
            onPress={startTraining}
            disabled={uploadedImages < 10 || isTraining}
          >
            <LinearGradient
              colors={
                uploadedImages < 10 
                  ? ['#6B7280', '#6B7280']
                  : isTraining 
                  ? ['#F59E0B', '#F59E0B'] 
                  : ['#F59E0B', '#EF4444']
              }
              style={styles.trainGradient}
            >
              {isTraining ? (
                <>
                  <Clock size={24} color="#FFFFFF" />
                  <Text style={styles.trainButtonText}>Training Model...</Text>
                </>
              ) : (
                <>
                  <Brain size={24} color="#FFFFFF" />
                  <Text style={styles.trainButtonText}>Start Training</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 30,
    paddingTop: 60,
  },
  headerContent: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#E5E7EB',
    opacity: 0.9,
    textAlign: 'center',
    marginBottom: 16,
  },
  headerStats: {
    flexDirection: 'row',
    gap: 20,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  statText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  content: {
    padding: 20,
  },
  uploadSection: {
    marginBottom: 32,
  },
  uploadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  uploadCounter: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  counterText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F59E0B',
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 20,
    lineHeight: 20,
  },
  imagesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  imageSlot: {
    width: 70,
    height: 70,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  emptyImageSlot: {
    backgroundColor: '#1E293B',
    borderWidth: 2,
    borderColor: '#334155',
    borderStyle: 'dashed',
  },
  filledImageSlot: {
    backgroundColor: '#8B5CF6',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
    backgroundColor: '#C4B5FD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  uploadGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  uploadButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  progressContainer: {
    gap: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#334155',
    borderRadius: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#F59E0B',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    fontWeight: '500',
  },
  guidelinesSection: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 20,
    marginBottom: 32,
  },
  guidelinesTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  guidelinesGrid: {
    gap: 12,
  },
  guideline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  guidelineIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  guidelineText: {
    fontSize: 14,
    color: '#E5E7EB',
    flex: 1,
    lineHeight: 18,
  },
  stepsSection: {
    marginBottom: 32,
  },
  stepsContainer: {
    gap: 12,
  },
  stepCard: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
    gap: 16,
  },
  selectedStepCard: {
    borderColor: '#F59E0B',
    backgroundColor: '#292524',
  },
  recommendedCard: {
    borderColor: '#F59E0B',
  },
  recommendedBadge: {
    position: 'absolute',
    top: -8,
    right: 16,
    backgroundColor: '#F59E0B',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  recommendedText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  stepIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  stepQuality: {
    fontSize: 14,
    color: '#F59E0B',
    fontWeight: '600',
    marginBottom: 4,
  },
  stepDescription: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 8,
    lineHeight: 16,
  },
  stepFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stepDuration: {
    fontSize: 14,
    color: '#CBD5E1',
    fontWeight: '500',
  },
  stepPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F59E0B',
  },
  modelInfoSection: {
    marginBottom: 32,
  },
  modelInfoGrid: {
    gap: 12,
  },
  modelInfoCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  modelInfoIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modelInfoContent: {
    flex: 1,
  },
  modelInfoLabel: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 2,
    fontWeight: '500',
  },
  modelInfoValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  modelInfoSubtext: {
    fontSize: 12,
    color: '#6B7280',
  },
  trainingProgressSection: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  trainingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  trainingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  trainingProgressBar: {
    height: 8,
    backgroundColor: '#334155',
    borderRadius: 4,
    marginBottom: 8,
  },
  trainingProgressFill: {
    height: '100%',
    backgroundColor: '#F59E0B',
    borderRadius: 4,
  },
  trainingProgressText: {
    fontSize: 14,
    color: '#FFFFFF',
    textAlign: 'center',
    fontWeight: '600',
  },
  trainingSubtext: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 4,
  },
  trainButton: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 20,
  },
  disabledTrainButton: {
    opacity: 0.5,
  },
  trainingButton: {
    opacity: 0.8,
  },
  trainGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 12,
  },
  trainButtonText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});