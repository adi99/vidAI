import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
} from 'react-native';
import {
    Zap,
    Wifi,
    Bell,
    TrendingUp,
    Play,
    Settings
} from 'lucide-react-native';
import { useRealtime, useCreditUpdates, useFeedUpdates, useRealtimeNotifications } from '@/hooks/useRealtime';
import { RealtimeCreditDisplay } from './RealtimeCreditDisplay';
import { RealtimeProgress } from './RealtimeProgress';
import { ConnectionStatus } from './ConnectionStatus';

interface RealtimeDemoProps {
    title?: string;
}

export function RealtimeDemo({ title = 'Real-time Features Demo' }: RealtimeDemoProps) {
    const [activeJobId, setActiveJobId] = useState<string | null>(null);
    const [showProgress, setShowProgress] = useState(false);

    const { isConnected, connect, disconnect, reconnect } = useRealtime();
    const { latestUpdate: creditUpdate, balance } = useCreditUpdates();
    const { updates: feedUpdates, latestUpdate: latestFeedUpdate } = useFeedUpdates();
    const { notifications, unreadCount } = useRealtimeNotifications();

    const simulateGeneration = () => {
        const jobId = `demo_job_${Date.now()}`;
        setActiveJobId(jobId);
        setShowProgress(true);

        // Simulate progress updates (in real app, this would come from backend)
        let progress = 0;
        const interval = setInterval(() => {
            progress += 10;
            if (progress >= 100) {
                clearInterval(interval);
                setShowProgress(false);
                Alert.alert('Demo Complete', 'Generation simulation finished!');
            }
        }, 500);
    };

    const handleCreditPress = () => {
        Alert.alert(
            'Credit Balance',
            `Current balance: ${balance || 0} credits\n\nThis display updates in real-time when credits change.`
        );
    };

    const renderConnectionInfo = () => (
        <View style={styles.section}>
            <View style={styles.sectionHeader}>
                <Wifi size={20} color="#8B5CF6" />
                <Text style={styles.sectionTitle}>Connection Status</Text>
            </View>

            <View style={styles.connectionInfo}>
                <View style={[styles.statusIndicator, isConnected ? styles.connected : styles.disconnected]}>
                    <Text style={styles.statusText}>
                        {isConnected ? 'Connected' : 'Disconnected'}
                    </Text>
                </View>

                <View style={styles.connectionActions}>
                    <TouchableOpacity
                        style={[styles.actionButton, styles.primaryButton]}
                        onPress={isConnected ? disconnect : connect}
                    >
                        <Text style={styles.actionButtonText}>
                            {isConnected ? 'Disconnect' : 'Connect'}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.actionButton, styles.secondaryButton]}
                        onPress={reconnect}
                    >
                        <Text style={styles.secondaryButtonText}>Reconnect</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );

    const renderCreditUpdates = () => (
        <View style={styles.section}>
            <View style={styles.sectionHeader}>
                <TrendingUp size={20} color="#8B5CF6" />
                <Text style={styles.sectionTitle}>Real-time Credits</Text>
            </View>

            <View style={styles.creditSection}>
                <RealtimeCreditDisplay
                    size="large"
                    showAnimation={true}
                    showLastUpdate={true}
                    onPress={handleCreditPress}
                    style={styles.creditDisplay}
                />

                {creditUpdate && (
                    <View style={styles.updateInfo}>
                        <Text style={styles.updateTitle}>Latest Update:</Text>
                        <Text style={styles.updateText}>
                            {creditUpdate.transaction.type}: {creditUpdate.transaction.amount} credits
                        </Text>
                        <Text style={styles.updateDescription}>
                            {creditUpdate.transaction.description}
                        </Text>
                    </View>
                )}
            </View>
        </View>
    );

    const renderProgressDemo = () => (
        <View style={styles.section}>
            <View style={styles.sectionHeader}>
                <Play size={20} color="#8B5CF6" />
                <Text style={styles.sectionTitle}>Progress Tracking</Text>
            </View>

            <TouchableOpacity
                style={[styles.actionButton, styles.primaryButton]}
                onPress={simulateGeneration}
                disabled={showProgress}
            >
                <Text style={styles.actionButtonText}>
                    {showProgress ? 'Generating...' : 'Start Demo Generation'}
                </Text>
            </TouchableOpacity>

            {showProgress && (
                <RealtimeProgress
                    jobId={activeJobId || undefined}
                    type="generation"
                    title="Demo Generation"
                    onComplete={(result) => {
                        console.log('Generation completed:', result);
                        setShowProgress(false);
                    }}
                    onError={(error) => {
                        console.error('Generation error:', error);
                        setShowProgress(false);
                    }}
                    onCancel={() => {
                        setShowProgress(false);
                        Alert.alert('Cancelled', 'Generation cancelled');
                    }}
                />
            )}
        </View>
    );

    const renderFeedUpdates = () => (
        <View style={styles.section}>
            <View style={styles.sectionHeader}>
                <Zap size={20} color="#8B5CF6" />
                <Text style={styles.sectionTitle}>Feed Updates</Text>
            </View>

            <View style={styles.feedInfo}>
                <Text style={styles.infoText}>
                    Total updates received: {feedUpdates.length}
                </Text>

                {latestFeedUpdate && (
                    <View style={styles.latestUpdate}>
                        <Text style={styles.updateTitle}>Latest:</Text>
                        <Text style={styles.updateText}>
                            {latestFeedUpdate.type} - {latestFeedUpdate.contentId}
                        </Text>
                    </View>
                )}
            </View>
        </View>
    );

    const renderNotifications = () => (
        <View style={styles.section}>
            <View style={styles.sectionHeader}>
                <Bell size={20} color="#8B5CF6" />
                <Text style={styles.sectionTitle}>Notifications</Text>
                {unreadCount > 0 && (
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>{unreadCount}</Text>
                    </View>
                )}
            </View>

            <View style={styles.notificationInfo}>
                <Text style={styles.infoText}>
                    Total notifications: {notifications.length}
                </Text>
                <Text style={styles.infoText}>
                    Unread: {unreadCount}
                </Text>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <ConnectionStatus position="top" showWhenConnected={false} />

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                <View style={styles.header}>
                    <Settings size={24} color="#8B5CF6" />
                    <Text style={styles.title}>{title}</Text>
                </View>

                <Text style={styles.description}>
                    This demo shows real-time features including WebSocket connections,
                    live credit updates, progress tracking, and feed updates.
                </Text>

                {renderConnectionInfo()}
                {renderCreditUpdates()}
                {renderProgressDemo()}
                {renderFeedUpdates()}
                {renderNotifications()}

                <View style={styles.footer}>
                    <Text style={styles.footerText}>
                        Real-time features are powered by Supabase Realtime
                    </Text>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    scrollView: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 16,
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        color: '#333',
    },
    description: {
        fontSize: 16,
        color: '#666',
        lineHeight: 24,
        paddingHorizontal: 20,
        marginBottom: 24,
    },
    section: {
        backgroundColor: '#fff',
        marginHorizontal: 16,
        marginBottom: 16,
        borderRadius: 12,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
    },
    connectionInfo: {
        alignItems: 'center',
        gap: 16,
    },
    statusIndicator: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    },
    connected: {
        backgroundColor: '#E8F5E8',
    },
    disconnected: {
        backgroundColor: '#FFEBEE',
    },
    statusText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
    },
    connectionActions: {
        flexDirection: 'row',
        gap: 12,
    },
    actionButton: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
        minWidth: 100,
        alignItems: 'center',
    },
    primaryButton: {
        backgroundColor: '#8B5CF6',
    },
    secondaryButton: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: '#8B5CF6',
    },
    actionButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    secondaryButtonText: {
        color: '#8B5CF6',
        fontSize: 14,
        fontWeight: '600',
    },
    creditSection: {
        alignItems: 'center',
        gap: 16,
    },
    creditDisplay: {
        backgroundColor: '#8B5CF6',
    },
    updateInfo: {
        alignItems: 'center',
        gap: 4,
    },
    updateTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
    },
    updateText: {
        fontSize: 14,
        color: '#666',
    },
    updateDescription: {
        fontSize: 12,
        color: '#999',
    },
    feedInfo: {
        gap: 8,
    },
    notificationInfo: {
        gap: 8,
    },
    infoText: {
        fontSize: 14,
        color: '#666',
    },
    latestUpdate: {
        backgroundColor: '#f8f9fa',
        padding: 12,
        borderRadius: 8,
        gap: 4,
    },
    badge: {
        backgroundColor: '#ff4444',
        borderRadius: 10,
        paddingHorizontal: 6,
        paddingVertical: 2,
        marginLeft: 8,
    },
    badgeText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    },
    footer: {
        padding: 20,
        alignItems: 'center',
    },
    footerText: {
        fontSize: 12,
        color: '#999',
        textAlign: 'center',
    },
});