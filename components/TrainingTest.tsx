import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { trainingService } from '@/services/trainingService';

export default function TrainingTest() {
  const testTrainingAPI = async () => {
    try {
      // Test getting trained models
      console.log('Testing trained models API...');
      const models = await trainingService.getTrainedModels();
      console.log('Trained models:', models);
      
      Alert.alert('API Test', `Found ${models.totalCount} trained models`);
    } catch (error: any) {
      console.error('Training API test error:', error);
      Alert.alert('API Test Failed', error.message);
    }
  };

  const testCreditCosts = () => {
    const costs = {
      600: trainingService.getCreditCost(600),
      1200: trainingService.getCreditCost(1200),
      2000: trainingService.getCreditCost(2000),
    };
    
    Alert.alert('Credit Costs', `600 steps: ${costs[600]} credits\n1200 steps: ${costs[1200]} credits\n2000 steps: ${costs[2000]} credits`);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Training API Test</Text>
      
      <TouchableOpacity style={styles.button} onPress={testTrainingAPI}>
        <Text style={styles.buttonText}>Test Get Models API</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.button} onPress={testCreditCosts}>
        <Text style={styles.buttonText}>Test Credit Costs</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#1E293B',
    borderRadius: 16,
    margin: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#F59E0B',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
});