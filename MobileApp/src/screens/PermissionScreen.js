import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Linking,
  Platform,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Button from '../components/Button';
import Card from '../components/Card';
import callLogService from '../services/CallLogService';
import syncService from '../services/SyncService';
import { COLORS } from '../utils/constants';

const PermissionScreen = () => {
  const navigation = useNavigation();
  const [permissionStatus, setPermissionStatus] = useState({
    callLog: null,
    phoneState: null,
  });
  const [loading, setLoading] = useState(false);
  const [isAvailable, setIsAvailable] = useState(true);

  useEffect(() => {
    checkAvailability();
    checkPermissions();
  }, []);

  const checkAvailability = () => {
    const available = callLogService.isCallLogAvailable();
    setIsAvailable(available);
  };

  const checkPermissions = async () => {
    if (!isAvailable) return;

    if (Platform.OS !== 'android') {
      setPermissionStatus({
        callLog: 'unsupported',
        phoneState: 'unsupported',
      });
      return;
    }

    const { granted: callLogGranted } = await callLogService.getPermissionStatus();
    setPermissionStatus({
      callLog: callLogGranted ? 'granted' : 'denied',
      phoneState: callLogGranted ? 'granted' : 'denied',
    });
  };

  const requestPermissions = async () => {
    if (!isAvailable) {
      showDevelopmentBuildAlert();
      return;
    }

    if (Platform.OS !== 'android') {
      proceedToDashboard();
      return;
    }

    setLoading(true);

    try {
      const result = await callLogService.checkPermission();

      if (result.granted) {
        setPermissionStatus({
          callLog: 'granted',
          phoneState: 'granted',
        });

        // Initialize background sync
        await syncService.initialize();

        proceedToDashboard();
      } else {
        setPermissionStatus({
          callLog: 'denied',
          phoneState: 'denied',
        });
      }
    } catch (error) {
      console.error('Error requesting permissions:', error);
      Alert.alert('Error', error.message || 'Failed to request permission');
    } finally {
      setLoading(false);
    }
  };

  const showDevelopmentBuildAlert = () => {
    Alert.alert(
      'Development Build Required',
      'Call log access requires a development build. Please run:\n\n' +
      'npx expo prebuild\n' +
      'npx expo run:android\n\n' +
      'The app will continue but call log sync will be disabled.',
      [{ text: 'OK', onPress: () => proceedToDashboard() }]
    );
  };

  const openSettings = () => {
    if (Platform.OS === 'android') {
      Linking.openSettings();
    }
  };

  const proceedToDashboard = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Dashboard' }],
    });
  };

  const isGranted = permissionStatus.callLog === 'granted';

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.icon}>🔐</Text>
        <Text style={styles.title}>Permissions Required</Text>
        <Text style={styles.subtitle}>
          To sync call logs, this app needs access to your call history
        </Text>

        {/* Development Build Warning */}
        {!isAvailable && (
          <Card style={styles.warningCard}>
            <Text style={styles.warningTitle}>⚠️ Development Build Required</Text>
            <Text style={styles.warningText}>
              Call log access requires native code compilation. Run:
            </Text>
            <Text style={styles.codeBlock}>
              npx expo prebuild{'\n'}
              npx expo run:android
            </Text>
            <Text style={styles.warningText}>
              The app will work but call log sync is disabled in Expo Go.
            </Text>
          </Card>
        )}

        <Card style={styles.card}>
          <View style={styles.permissionItem}>
            <View style={styles.permissionIcon}>
              <Text style={styles.permissionEmoji}>📞</Text>
            </View>
            <View style={styles.permissionInfo}>
              <Text style={styles.permissionTitle}>Call Log Access</Text>
              <Text style={styles.permissionDesc}>
                Read call history to sync with your SIM Management account
              </Text>
            </View>
            <View
              style={[
                styles.statusBadge,
                !isAvailable ? styles.statusUnavailable :
                isGranted ? styles.statusGranted : styles.statusPending,
              ]}
            >
              <Text style={styles.statusText}>
                {!isAvailable ? 'Unavailable' :
                 isGranted ? '✓ Granted' : 'Required'}
              </Text>
            </View>
          </View>

          {Platform.OS !== 'android' && (
            <View style={styles.iosNote}>
              <Text style={styles.iosNoteText}>
                Note: Call log access is not available on iOS devices
              </Text>
            </View>
          )}
        </Card>

        <Card style={styles.infoCard}>
          <Text style={styles.infoTitle}>Why we need this permission:</Text>
          <Text style={styles.infoText}>
            • Sync your device call logs with SIM Management dashboard
          </Text>
          <Text style={styles.infoText}>
            • Track incoming, outgoing, and missed calls
          </Text>
          <Text style={styles.infoText}>
            • Associate calls with your registered SIM numbers
          </Text>
        </Card>

        {permissionStatus.callLog === 'denied' && isAvailable && (
          <View style={styles.deniedContainer}>
            <Text style={styles.deniedText}>
              Permission was denied. Please enable it in Settings.
            </Text>
            <Button
              title="Open Settings"
              onPress={openSettings}
              variant="secondary"
              style={styles.settingsButton}
            />
          </View>
        )}

        <Button
          title={!isAvailable ? 'Continue (Limited Features)' :
                 isGranted ? 'Continue to Dashboard' : 'Grant Permission'}
          onPress={requestPermissions}
          loading={loading}
          style={styles.button}
        />

        {!isGranted && (
          <Button
            title="Skip for Now"
            onPress={proceedToDashboard}
            variant="ghost"
            style={styles.skipButton}
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
  },
  icon: {
    fontSize: 64,
    marginTop: 48,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  warningCard: {
    width: '100%',
    marginBottom: 16,
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
    borderWidth: 1,
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#92400E',
    marginBottom: 8,
  },
  warningText: {
    fontSize: 13,
    color: '#92400E',
    marginBottom: 8,
  },
  codeBlock: {
    fontFamily: 'monospace',
    fontSize: 12,
    backgroundColor: '#FEF3C7',
    padding: 8,
    borderRadius: 4,
    color: '#92400E',
    marginBottom: 8,
  },
  card: {
    width: '100%',
    marginBottom: 16,
  },
  permissionItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  permissionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(37, 99, 235, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionEmoji: {
    fontSize: 24,
  },
  permissionInfo: {
    flex: 1,
    marginLeft: 12,
  },
  permissionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  permissionDesc: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusGranted: {
    backgroundColor: 'rgba(22, 163, 74, 0.12)',
  },
  statusPending: {
    backgroundColor: 'rgba(217, 119, 6, 0.12)',
  },
  statusUnavailable: {
    backgroundColor: 'rgba(100, 116, 139, 0.25)',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
  },
  iosNote: {
    marginTop: 12,
    padding: 12,
    backgroundColor: 'rgba(217, 119, 6, 0.12)',
    borderRadius: 8,
  },
  iosNoteText: {
    fontSize: 12,
    color: COLORS.warning,
    textAlign: 'center',
  },
  infoCard: {
    width: '100%',
    marginBottom: 24,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  deniedContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
  },
  deniedText: {
    fontSize: 14,
    color: COLORS.danger,
    marginBottom: 12,
    textAlign: 'center',
  },
  settingsButton: {
    paddingHorizontal: 24,
  },
  button: {
    width: '100%',
    maxWidth: 320,
  },
  skipButton: {
    marginTop: 12,
  },
});

export default PermissionScreen;