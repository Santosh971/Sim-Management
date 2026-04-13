import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Button from '../components/Button';
import Card from '../components/Card';
import { useAuth } from '../context/AuthContext';
import storageService from '../services/StorageService';
import syncService from '../services/SyncService';
import callLogService from '../services/CallLogService';
import { COLORS } from '../utils/constants';

const SettingsScreen = () => {
  const navigation = useNavigation();
  const { user, logout } = useAuth();
  const [syncInterval, setSyncInterval] = useState(15);
  const [lastSync, setLastSync] = useState(null);
  const [mobileNumber, setMobileNumber] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const interval = await storageService.getSyncInterval();
    const lastSyncTime = await storageService.getLastSync();
    const storedMobile = await storageService.getMobileNumber();

    if (interval) {
      setSyncInterval(Math.round(interval / 60000)); // Convert ms to minutes
    }
    setLastSync(lastSyncTime);
    setMobileNumber(storedMobile || 'Not set');
  };

  const handleClearPendingLogs = async () => {
    Alert.alert(
      'Clear Pending Logs',
      'Are you sure you want to clear all pending logs? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await storageService.clearPendingLogs();
            Alert.alert('Success', 'Pending logs cleared');
            loadSettings();
          },
        },
      ]
    );
  };

  const handleResetSync = async () => {
    Alert.alert(
      'Reset Sync',
      'This will reset the last sync timestamp, causing all call logs to be synced again. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            await storageService.setLastSync(null);
            Alert.alert('Success', 'Sync timestamp reset');
            loadSettings();
          },
        },
      ]
    );
  };

  const handleCheckPermission = async () => {
    if (Platform.OS !== 'android') {
      Alert.alert('Info', 'Call log access is only available on Android');
      return;
    }

    const { granted } = await callLogService.checkPermission();
    Alert.alert(
      'Permission Status',
      granted ? 'Call log permission is granted' : 'Call log permission is denied',
      [{ text: 'OK' }]
    );
  };

  const handleClearAllData = async () => {
    Alert.alert(
      'Clear All Data',
      'This will log you out and delete all local data. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            await storageService.clearAll();
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

  const formatDateTime = (date) => {
    if (!date) return 'Never';
    return date.toLocaleString();
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      {/* Account Card */}
      <Card title="Account" style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.label}>Mobile Number</Text>
          <Text style={styles.value}>+91 {mobileNumber}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Name</Text>
          <Text style={styles.value}>{user?.name || 'Not set'}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{user?.email || 'Not set'}</Text>
        </View>
      </Card>

      {/* Sync Settings Card */}
      <Card title="Sync Settings" style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.label}>Sync Interval</Text>
          <Text style={styles.value}>{syncInterval} minutes</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Last Sync</Text>
          <Text style={styles.value}>{formatDateTime(lastSync)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Background Sync</Text>
          <Text style={styles.value}>
            {Platform.OS === 'android' ? 'Enabled' : 'Not Available'}
          </Text>
        </View>
        <Button
          title="Reset Sync Timestamp"
          onPress={handleResetSync}
          variant="secondary"
          style={styles.button}
        />
      </Card>

      {/* Permission Card */}
      {Platform.OS === 'android' && (
        <Card title="Permissions" style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>Call Log Access</Text>
            <Text style={styles.value}>Required</Text>
          </View>
          <Button
            title="Check Permission"
            onPress={handleCheckPermission}
            variant="secondary"
            style={styles.button}
          />
        </Card>
      )}

      {/* Storage Card */}
      <Card title="Storage" style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.label}>Pending Logs</Text>
          <Text style={styles.value}>View in Dashboard</Text>
        </View>
        <Button
          title="Clear Pending Logs"
          onPress={handleClearPendingLogs}
          variant="secondary"
          style={styles.button}
        />
        <Button
          title="Clear All Data"
          onPress={handleClearAllData}
          variant="danger"
          style={styles.button}
        />
      </Card>

      {/* About Card */}
      <Card title="About" style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.label}>App Version</Text>
          <Text style={styles.value}>1.0.0</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Platform</Text>
          <Text style={styles.value}>{Platform.OS}</Text>
        </View>
      </Card>

      <View style={styles.footer}>
        <Text style={styles.footerText}>SIM Manager App</Text>
        <Text style={styles.footerText}>Call Log Sync for SIM Management SaaS</Text>
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
    padding: 20,
    paddingTop: 40,
    backgroundColor: COLORS.primary,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  card: {
    marginHorizontal: 16,
    marginTop: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  label: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  value: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
  },
  button: {
    marginTop: 12,
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

export default SettingsScreen;