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
  TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Upload, Image as ImageIcon, CircleCheck as CheckCircle, Clock, Zap, Star, Crown, Brain, Camera, Trash2, Plus, CircleAlert as AlertCircle, TrendingUp, Shield } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useTraining } from '@/hooks/useTraining';
import { trainingService } from '@/services/trainingService';
import CreditDisplay from '@/components/CreditDisplay';
import CreditCostDisplay from '@/components/CreditCostDisplay';
import TrainingTest from '@/components/TrainingTest';

export default function TrainingScreen() {
  const {
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
  } = useTraining();

  const getStepCost = (steps: 600 | 1200 | 2000) => {
    return trainingService.getCreditCost(steps);
  };

  const trainingSteps = [
    {
      steps: 600 as const,
      duration: '~15 min',
      quality: 'Good Quality',
      price: `${getStepCost(600)} credits`,
      icon: <Clock size={24} color="#FFFFFF" />,
      description: 'Quick training for basic personalization',
      recommended: false,
    },
    {
      steps: 1200 as const,
      duration: '~30 min',
      quality: 'High Quality',
      price: `${getStepCost(1200)} credits`,
      icon: <Zap size={24} color="#FFFFFF" />,
      description: 'Balanced training for excellent results',
      recommended: true,
    },
    {
      steps: 2000 as const,
      duration: '~50 min',
      quality: 'Premium Quality',
      price: `${getStepCost(2000)} credits`,
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

  const ImageSlot = ({ index }: { index: number }) => {
    const hasImage = index < uploadedImages.length;
    const image = hasImage ? uploadedImages[index] : null;
    
    return (
      <TouchableOpacity
        style={[
          styles.imageSlot,
          hasImage ? styles.filledImageSlot : styles.emptyImageSlot
        ]}
        onPress={hasImage ? () => removeImage(index) : addImages}
      >
        {hasImage && image ? (
          <>
            <Image source={{ uri: image.uri }} style={styles.imagePreview} />
            <TouchableOpacity 
              style={styles.removeButton} 
              onPress={() => removeImage(index)}
            >
              <Trash2 size={12} color="#FFFFFF" />
            </TouchableOpacity>
          </>
        ) : (
          <Plus size={20} color="#6B7280" />
        )}
      </TouchableOpacity>
    );
  };

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
            <CreditDisplay size="medium" style={{ marginTop: 16 }} />
          </View>
        </LinearGradient>

        <View style={styles.content}>
          {/* Development Test Component */}
          {__DEV__ && <TrainingTest />}
          
          {/* Model Name Input */}
          <View style={styles.modelNameSection}>
            <Text style={styles.sectionTitle}>Model Name</Text>
            <Text style={styles.sectionSubtitle}>
              Choose a unique name for your custom model
            </Text>
            <TextInput
              style={[
                styles.modelNameInput,
                modelName.trim().length > 0 && !/^[a-zA-Z0-9-_]+$/.test(modelName.trim()) && styles.modelNameInputError
              ]}
              value={modelName}
              onChangeText={setModelName}
              placeholder="Enter model name (e.g., my-portrait-model)"
              placeholderTextColor="#6B7280"
              maxLength={50}
            />
            {modelName.trim().length > 0 && !/^[a-zA-Z0-9-_]+$/.test(modelName.trim()) && (
              <Text style={styles.validationText}>
                Model name can only contain letters, numbers, hyphens, and underscores
              </Text>
            )}
          </View>

          <View style={styles.uploadSection}>
            <View style={styles.uploadHeader}>
              <Text style={styles.sectionTitle}>Training Images</Text>
              <View style={styles.uploadCounter}>
                <Text style={styles.counterText}>{uploadedImages.length}/30</Text>
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
              onPress={addImages}
              disabled={isLoading}
            >
              <LinearGradient
                colors={['#8B5CF6', '#3B82F6']}
                style={styles.uploadGradient}
              >
                <Upload size={24} color="#FFFFFF" />
                <Text style={styles.uploadButtonText}>
                  {isLoading ? 'Processing...' : 'Add Images (Multiple Selection)'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            {uploadedImages.length > 0 && (
              <TouchableOpacity
                style={styles.clearButton}
                onPress={clearImages}
              >
                <Text style={styles.clearButtonText}>Clear All Images</Text>
              </TouchableOpacity>
            )}

            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill, 
                    { width: `${Math.min((uploadedImages.length / 10) * 100, 100)}%` }
                  ]} 
                />
              </View>
              <Text style={styles.progressText}>
                {uploadedImages.length >= 10 
                  ? `Ready to train! ${uploadedImages.length} images uploaded` 
                  : `${Math.max(10 - uploadedImages.length, 0)} more images needed to start training`
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

          {/* Error Display */}
          {error && (
            <View style={styles.errorSection}>
              <AlertCircle size={20} color="#EF4444" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Training Progress */}
          {isTraining && (
            <View style={styles.trainingProgressSection}>
              <View style={styles.trainingHeader}>
                <Brain size={20} color="#F59E0B" />
                <Text style={styles.trainingTitle}>Training in Progress</Text>
              </View>
              <View style={styles.trainingProgressBar}>
                <View style={[styles.trainingProgressFill, { width: `${trainingProgress}%` }]} />
              </View>
              <View style={styles.progressInfo}>
                <Text style={styles.trainingProgressText}>{trainingProgress}% complete</Text>
                {trainingProgress > 0 && (
                  <Text style={styles.estimatedTime}>
                    ~{Math.ceil((100 - trainingProgress) * (selectedSteps / 100) / 60)} min remaining
                  </Text>
                )}
              </View>
              <Text style={styles.trainingSubtext}>
                Training your custom model "{modelName}" with {uploadedImages.length} images using {selectedSteps} steps
              </Text>
              {currentTrainingJob && (
                <Text style={styles.jobIdText}>
                  Job ID: {currentTrainingJob.id}
                </Text>
              )}
            </View>
          )}

          {/* Trained Models Section */}
          {trainedModels.length > 0 && (
            <View style={styles.modelsSection}>
              <View style={styles.modelsHeader}>
                <Text style={styles.sectionTitle}>Your Trained Models</Text>
                <TouchableOpacity onPress={loadTrainedModels}>
                  <Text style={styles.refreshText}>Refresh</Text>
                </TouchableOpacity>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.modelsContainer}>
                  {trainedModels.slice(0, 5).map((model) => (
                    <View key={model.id} style={styles.modelCard}>
                      <View style={[
                        styles.modelStatus,
                        { backgroundColor: 
                          model.status === 'completed' ? '#10B981' :
                          model.status === 'processing' ? '#F59E0B' :
                          model.status === 'failed' ? '#EF4444' : '#6B7280'
                        }
                      ]}>
                        <Text style={styles.modelStatusText}>
                          {model.status.toUpperCase()}
                        </Text>
                      </View>
                      <Text style={styles.modelName}>{model.modelName}</Text>
                      <Text style={styles.modelSteps}>{model.steps} steps</Text>
                      <Text style={styles.modelCredits}>{model.creditsUsed} credits</Text>
                    </View>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}

          <CreditCostDisplay
            generationType="training"
            options={{ steps: selectedSteps }}
            style={{ marginBottom: 24 }}
          />

          <TouchableOpacity
            style={[
              styles.trainButton,
              !canStartTraining && styles.disabledTrainButton,
              (isTraining || isLoading) && styles.trainingButton
            ]}
            onPress={startTraining}
            disabled={!canStartTraining || isTraining || isLoading}
          >
            <LinearGradient
              colors={
                !canStartTraining 
                  ? ['#6B7280', '#6B7280']
                  : (isTraining || isLoading)
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
              ) : isLoading ? (
                <>
                  <Clock size={24} color="#FFFFFF" />
                  <Text style={styles.trainButtonText}>Starting...</Text>
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
  modelNameSection: {
    marginBottom: 32,
  },
  modelNameInput: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    fontSize: 16,
    color: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#334155',
  },
  modelNameInputError: {
    borderColor: '#EF4444',
  },
  validationText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 8,
    marginLeft: 4,
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
  clearButton: {
    alignItems: 'center',
    padding: 12,
    marginBottom: 16,
  },
  clearButtonText: {
    fontSize: 14,
    color: '#EF4444',
    fontWeight: '600',
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
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  trainingProgressText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  estimatedTime: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  trainingSubtext: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 4,
  },
  jobIdText: {
    fontSize: 10,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 4,
    fontFamily: 'monospace',
  },
  errorSection: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  errorText: {
    fontSize: 14,
    color: '#EF4444',
    flex: 1,
    lineHeight: 18,
  },
  modelsSection: {
    marginBottom: 32,
  },
  modelsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  refreshText: {
    fontSize: 14,
    color: '#F59E0B',
    fontWeight: '600',
  },
  modelsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  modelCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    width: 140,
    position: 'relative',
  },
  modelStatus: {
    position: 'absolute',
    top: 8,
    right: 8,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  modelStatusText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modelName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
    marginTop: 8,
  },
  modelSteps: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 2,
  },
  modelCredits: {
    fontSize: 12,
    color: '#F59E0B',
    fontWeight: '600',
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