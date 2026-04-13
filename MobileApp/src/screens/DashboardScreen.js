import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Platform,
  Alert,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Button from '../components/Button';
import Card from '../components/Card';
import Loader from '../components/Loader';
import { useAuth } from '../context/AuthContext';
import callLogService from '../services/CallLogService';
import syncService from '../services/SyncService';
import storageService from '../services/StorageService';
import { COLORS } from '../utils/constants';

const DashboardScreen = () => {
  const navigation = useNavigation();
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [isAvailable, setIsAvailable] = useState(true);
  const [syncStatus, setSyncStatus] = useState({
    lastSync: null,
    pendingLogs: 0,
    hasMobileNumber: false,
  });
  const [stats, setStats] = useState({
    total: 0,
    incoming: 0,
    outgoing: 0,
    missed: 0,
  });

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  useEffect(() => {
    const interval = setInterval(() => {
      loadData();
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      // Check if call log is available
      const available = callLogService.isCallLogAvailable();
      setIsAvailable(available);

      // Get sync status
      const status = await syncService.getSyncStatus();
      setSyncStatus(status);

      // Get call log stats from device (only if available)
      if (available && Platform.OS === 'android') {
        const { granted } = await callLogService.checkPermission();
        if (granted) {
          const callStats = await callLogService.getStats();
          setStats(callStats);
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleSync = async () => {
    if (!isAvailable) {
      showDevelopmentBuildAlert();
      return;
    }

    setSyncing(true);
    try {
      const result = await syncService.manualSync((progress) => {
        console.log('Sync progress:', progress);
      });

      if (result.success) {
        const status = await syncService.getSyncStatus();
        setSyncStatus(status);
      }

      Alert.alert(
        result.success ? 'Success' : 'Error',
        result.success
          ? `Successfully synced ${result.synced} call logs`
          : result.message || 'Sync failed'
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to sync: ' + error.message);
    } finally {
      setSyncing(false);
    }
  };

  const showDevelopmentBuildAlert = () => {
    Alert.alert(
      'Development Build Required',
      'Call log sync requires a development build. Please run:\n\n' +
      'npx expo prebuild\n' +
      'npx expo run:android',
      [{ text: 'OK' }]
    );
  };

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout? Your mobile number will be retained for background sync.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await logout();
            navigation.reset({
              index: 0,
              routes: [{ name: 'Login' }],
            });
          },
        },
      ]
    );
  };

  const formatLastSync = (date) => {
    if (!date) return 'Never';
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  if (loading) {
    return <Loader fullScreen message="Loading dashboard..." />;
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.welcome}>Welcome back,</Text>
          <Text style={styles.userName}>{user?.name || 'User'}</Text>
        </View>
        <View style={styles.mobileBadge}>
          <Text style={styles.mobileText}>
            +91 {syncStatus.hasMobileNumber ? '•••••' : 'Not Set'}
          </Text>
        </View>
      </View>

      {/* Development Build Warning */}
      {!isAvailable && (
        <Card style={styles.warningCard}>
          <Text style={styles.warningTitle}>⚠️ Call Log Sync Unavailable</Text>
          <Text style={styles.warningText}>
            Running in Expo Go. For full functionality, create a development build:
          </Text>
          <Text style={styles.codeBlock}>
            npx expo prebuild{'\n'}npx expo run:android
          </Text>
        </Card>
      )}

      {/* Sync Status Card */}
      <Card title="Sync Status" style={styles.card}>
        <View style={styles.syncStatus}>
          <View style={styles.syncRow}>
            <Text style={styles.syncLabel}>Last Sync:</Text>
            <Text style={styles.syncValue}>{formatLastSync(syncStatus.lastSync)}</Text>
          </View>
          <View style={styles.syncRow}>
            <Text style={styles.syncLabel}>Pending Logs:</Text>
            <Text style={styles.syncValue}>{syncStatus.pendingLogs}</Text>
          </View>
          <View style={styles.syncRow}>
            <Text style={styles.syncLabel}>Status:</Text>
            <Text style={[styles.syncValue, isAvailable ? styles.statusActive : styles.statusInactive]}>
              {isAvailable ? 'Ready' : 'Limited'}
            </Text>
          </View>
          <Button
            title={syncing ? 'Syncing...' : 'Sync Now'}
            onPress={handleSync}
            loading={syncing}
            disabled={syncing || !isAvailable}
            style={styles.syncButton}
          />
        </View>
      </Card>

      {/* Call Stats Card */}
      {isAvailable && (
        <Card title="Device Call Logs" style={styles.card}>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.total}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, styles.incoming]}>{stats.incoming}</Text>
              <Text style={styles.statLabel}>Incoming</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, styles.outgoing]}>{stats.outgoing}</Text>
              <Text style={styles.statLabel}>Outgoing</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, styles.missed]}>{stats.missed}</Text>
              <Text style={styles.statLabel}>Missed</Text>
            </View>
          </View>
        </Card>
      )}

      {/* Info Card */}
      <Card style={styles.card}>
        <Text style={styles.infoText}>
          {isAvailable
            ? 'Your call logs are automatically synced every 15 minutes. Tap "Sync Now" for immediate sync.'
            : 'To enable call log sync, create a development build using the commands above.'}
        </Text>
      </Card>

      {/* Actions */}
      <View style={styles.actions}>
        <Button
          title="Settings"
          onPress={() => navigation.navigate('Settings')}
          variant="secondary"
          style={styles.actionButton}
        />
        <Button
          title="Logout"
          onPress={handleLogout}
          variant="ghost"
          style={styles.actionButton}
        />
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>SIM Manager v1.0.0</Text>
        <Text style={styles.footerText}>
          Platform: {Platform.OS} | {isAvailable ? '✓ Full' : '⚠ Limited'}
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 40,
    backgroundColor: COLORS.primary,
  },
  welcome: {
    fontSize: 14,
    color: COLORS.white,
    opacity: 0.8,
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  mobileBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  mobileText: {
    fontSize: 12,
    color: COLORS.white,
    fontWeight: '500',
  },
  warningCard: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
    borderWidth: 1,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400E',
    marginBottom: 6,
  },
  warningText: {
    fontSize: 12,
    color: '#92400E',
    marginBottom: 6,
  },
  codeBlock: {
    fontFamily: 'monospace',
    fontSize: 11,
    backgroundColor: 'rgba(0,0,0,0.1)',
    padding: 8,
    borderRadius: 4,
    color: '#92400E',
  },
  card: {
    marginHorizontal: 16,
    marginTop: 16,
  },
  syncStatus: {
    marginTop: 8,
  },
  syncRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  syncLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  syncValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  statusActive: {
    color: COLORS.success,
  },
  statusInactive: {
    color: COLORS.warning,
  },
  syncButton: {
    marginTop: 8,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
  },
  statItem: {
    alignItems: 'center',
    minWidth: 60,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  incoming: {
    color: COLORS.success,
  },
  outgoing: {
    color: COLORS.primary,
  },
  missed: {
    color: COLORS.danger,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  infoText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 24,
  },
  actionButton: {
    flex: 1,
    marginHorizontal: 4,
  },
  footer: {
    alignItems: 'center',
    padding: 20,
    marginTop: 20,
  },
  footerText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
});

export default DashboardScreen;