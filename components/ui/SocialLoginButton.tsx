import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface SocialLoginButtonProps {
  provider: {
    id: string;
    name: string;
    icon: string;
    color: string;
  };
  onPress: () => void;
  loading?: boolean;
}

export default function SocialLoginButton({
  provider,
  onPress,
  loading = false,
}: SocialLoginButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.button, loading && styles.disabledButton]}
      onPress={onPress}
      disabled={loading}
    >
      <View style={[styles.content, { borderColor: provider.color }]}>
        <Text style={styles.icon}>{provider.icon}</Text>
        <Text style={styles.text}>
          {loading ? 'Connecting...' : `Continue with ${provider.name}`}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
  },
  disabledButton: {
    opacity: 0.7,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#374151',
    borderWidth: 1,
    borderRadius: 12,
    gap: 12,
  },
  icon: {
    fontSize: 20,
  },
  text: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});