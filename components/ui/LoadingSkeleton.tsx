import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { MotiView } from 'moti';
import { useTheme } from 'react-native-paper';

const { width } = Dimensions.get('window');

interface LoadingSkeletonProps {
  type: 'card' | 'list' | 'image' | 'text' | 'button' | 'grid';
  count?: number;
  height?: number;
  width?: number;
  animated?: boolean;
}

export default function LoadingSkeleton({
  type,
  count = 1,
  height = 60,
  width: customWidth,
  animated = true,
}: LoadingSkeletonProps) {
  const theme = useTheme();

  // Simple skeleton placeholder using MotiView
  const SkeletonBox = ({ width, height, radius = 4 }: { width: string | number; height: number; radius?: number }) => (
    <MotiView
      from={{ opacity: 0.3 }}
      animate={{ opacity: [0.3, 0.7, 0.3] }}
      transition={{
        type: 'timing',
        duration: 1500,
        loop: true,
      }}
      style={{
        width: typeof width === 'string' ? width : width,
        height,
        backgroundColor: theme.colors.surfaceVariant,
        borderRadius: radius,
      } as any}
    />
  );

  const renderCardSkeleton = () => (
    <MotiView
      from={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        type: 'spring',
        damping: 15,
        stiffness: 300,
      }}
      style={[styles.cardContainer, { backgroundColor: theme.colors.surface }]}
    >
      <SkeletonBox height={120} width="100%" radius={12} />
      <View style={styles.cardContent}>
        <SkeletonBox height={20} width="70%" radius={4} />
        <SkeletonBox height={16} width="50%" radius={4} />
      </View>
    </MotiView>
  );

  const renderListSkeleton = () => (
    <MotiView
      from={{ opacity: 0, translateX: -20 }}
      animate={{ opacity: 1, translateX: 0 }}
      transition={{
        type: 'spring',
        damping: 20,
        stiffness: 300,
      }}
      style={[styles.listItem, { backgroundColor: theme.colors.surface }]}
    >
      <SkeletonBox height={50} width={50} radius={25} />
      <View style={styles.listContent}>
        <SkeletonBox height={18} width="60%" radius={4} />
        <SkeletonBox height={14} width="40%" radius={4} />
      </View>
    </MotiView>
  );

  const renderImageSkeleton = () => (
    <MotiView
      from={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        type: 'spring',
        damping: 20,
        stiffness: 300,
      }}
      style={styles.imageContainer}
    >
      <SkeletonBox
        height={customWidth || width - 40}
        width={customWidth || width - 40}
        radius={12}
      />
    </MotiView>
  );

  const renderTextSkeleton = () => (
    <MotiView
      from={{ opacity: 0, translateY: 10 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{
        type: 'spring',
        damping: 20,
        stiffness: 300,
      }}
      style={styles.textContainer}
    >
      <SkeletonBox height={height} width="100%" radius={4} />
    </MotiView>
  );

  const renderButtonSkeleton = () => (
    <MotiView
      from={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        type: 'spring',
        damping: 15,
        stiffness: 300,
      }}
      style={styles.buttonContainer}
    >
      <SkeletonBox height={48} width="100%" radius={24} />
    </MotiView>
  );

  const renderGridSkeleton = () => (
    <View style={styles.gridContainer}>
      {Array.from({ length: count }).map((_, index) => (
        <MotiView
          key={index}
          from={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{
            type: 'spring',
            damping: 20,
            stiffness: 300,
            delay: index * 100,
          }}
          style={[styles.gridItem, { backgroundColor: theme.colors.surface }]}
        >
          <SkeletonBox height={80} width="100%" radius={8} />
          <View style={styles.gridItemContent}>
            <SkeletonBox height={14} width="80%" radius={4} />
            <SkeletonBox height={12} width="60%" radius={4} />
          </View>
        </MotiView>
      ))}
    </View>
  );

  const renderSkeleton = () => {
    switch (type) {
      case 'card':
        return renderCardSkeleton();
      case 'list':
        return renderListSkeleton();
      case 'image':
        return renderImageSkeleton();
      case 'text':
        return renderTextSkeleton();
      case 'button':
        return renderButtonSkeleton();
      case 'grid':
        return renderGridSkeleton();
      default:
        return renderTextSkeleton();
    }
  };

  if (type === 'grid') {
    return renderGridSkeleton();
  }

  return (
    <View style={styles.container}>
      {Array.from({ length: count }).map((_, index) => (
        <View key={index} style={index > 0 ? styles.spacing : undefined}>
          {renderSkeleton()}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  spacing: {
    marginTop: 12,
  },
  cardContainer: {
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
  },
  cardContent: {
    marginTop: 12,
    gap: 8,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    marginVertical: 4,
  },
  listContent: {
    marginLeft: 12,
    flex: 1,
    gap: 4,
  },
  imageContainer: {
    alignItems: 'center',
    marginVertical: 8,
  },
  textContainer: {
    marginVertical: 4,
  },
  buttonContainer: {
    marginVertical: 8,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  gridItem: {
    width: (width - 60) / 2,
    borderRadius: 8,
    padding: 12,
  },
  gridItemContent: {
    marginTop: 8,
    gap: 4,
  },
});