import { Platform, PermissionsAndroid } from 'react-native';
import storageService from './StorageService';
import { SYNC_CONFIG, CALL_TYPES } from '../utils/constants';

// Lazy load react-native-call-log to avoid errors in Expo Go
let CallLogs = null;
try {
  CallLogs = require('react-native-call-log').default;
} catch (e) {
  console.warn('react-native-call-log not available. Call log features will be disabled.');
  console.warn('To use call log features, you need to create a development build:');
  console.warn('  npx expo prebuild');
  console.warn('  npx expo run:android');
}

class CallLogService {
  constructor() {
    this.isAvailable = CallLogs !== null;
  }

  /**
   * Check if call log functionality is available
   */
  isCallLogAvailable() {
    return this.isAvailable && Platform.OS === 'android';
  }

  /**
   * Check if we have permission to read call logs
   */
  async checkPermission() {
    if (!this.isCallLogAvailable()) {
      return {
        granted: false,
        reason: 'Call log access requires a development build. Run: npx expo prebuild && npx expo run:android'
      };
    }

    if (Platform.OS !== 'android') {
      return { granted: false, reason: 'Call log access is only available on Android' };
    }

    try {
      // Check current permission status
      const granted = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.READ_CALL_LOG
      );

      if (granted) {
        return { granted: true };
      }

      // Request permission
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_CALL_LOG,
        {
          title: 'Call Log Permission',
          message: 'This app needs access to your call logs to sync with your account.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        }
      );

      return {
        granted: result === PermissionsAndroid.RESULTS.GRANTED,
        reason: result === PermissionsAndroid.RESULTS.GRANTED ? null : 'Permission denied',
      };
    } catch (error) {
      return {
        granted: false,
        reason: error.message || 'Failed to request permission',
      };
    }
  }

  /**
   * Get permission status without requesting
   */
  async getPermissionStatus() {
    if (!this.isCallLogAvailable()) {
      return { granted: false, canAskAgain: false };
    }

    if (Platform.OS !== 'android') {
      return { granted: false, canAskAgain: false };
    }

    try {
      const granted = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.READ_CALL_LOG
      );
      return {
        granted,
        canAskAgain: true,
      };
    } catch (error) {
      return { granted: false, canAskAgain: false };
    }
  }

  /**
   * Read call logs from device since last sync
   */
  async getCallLogsSinceLastSync() {
    if (!this.isCallLogAvailable()) {
      console.warn('Call log not available - returning empty array');
      return [];
    }

    const lastSync = await storageService.getLastSync();
    const minTimestamp = lastSync ? lastSync.getTime() : Date.now() - 7 * 24 * 60 * 60 * 1000;

    return this.getCallLogs(minTimestamp);
  }

  /**
   * Read all call logs from device
   */
  async getAllCallLogs() {
    if (!this.isCallLogAvailable()) {
      return [];
    }
    return this.getCallLogs(0);
  }

  /**
   * Read call logs from device starting from timestamp
   */
  async getCallLogs(minTimestamp = 0) {
    if (!this.isCallLogAvailable()) {
      return [];
    }

    try {
      const { granted } = await this.checkPermission();
      if (!granted) {
        throw new Error('Call log permission not granted');
      }

      // Load call logs - use load() with limit
      const callLogs = await CallLogs.load(-1); // -1 means no limit

      // Filter by timestamp and transform for API
      const filteredLogs = callLogs
        .filter((log) => log.timestamp > minTimestamp)
        .map((log) => this.transformCallLog(log));

      // Sort by timestamp (newest first)
      filteredLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      return filteredLogs;
    } catch (error) {
      console.error('Error reading call logs:', error);
      throw error;
    }
  }

  /**
   * Transform device call log to API format
   */
  transformCallLog(log) {
    return {
      phoneNumber: this.formatPhoneNumber(log.phoneNumber),
      callType: this.mapCallType(log.callType || log.rawType),
      duration: Math.floor(parseInt(log.duration) || 0),
      timestamp: new Date(parseInt(log.timestamp)).toISOString(),
      contactName: log.name || undefined,
    };
  }

  /**
   * Map device call type to API call type
   */
  mapCallType(type) {
    if (!type) return CALL_TYPES.INCOMING;

    const typeUpper = type.toUpperCase();

    if (typeUpper.includes('INCOMING') || typeUpper === '1') {
      return CALL_TYPES.INCOMING;
    }
    if (typeUpper.includes('OUTGOING') || typeUpper === '2') {
      return CALL_TYPES.OUTGOING;
    }
    return CALL_TYPES.MISSED;
  }

  /**
   * Format phone number to standard format
   */
  formatPhoneNumber(phoneNumber) {
    if (!phoneNumber) return '';

    let cleaned = phoneNumber.replace(/\D/g, '');

    if (cleaned.startsWith('91') && cleaned.length === 12) {
      cleaned = cleaned.substring(2);
    }

    if (cleaned.length > 10) {
      cleaned = cleaned.slice(-10);
    }

    return cleaned;
  }

  /**
   * Get call log stats from device
   */
  async getStats() {
    if (!this.isCallLogAvailable()) {
      return {
        total: 0,
        incoming: 0,
        outgoing: 0,
        missed: 0,
        totalDuration: 0,
        uniqueContacts: 0,
      };
    }

    try {
      const callLogs = await this.getAllCallLogs();

      return {
        total: callLogs.length,
        incoming: callLogs.filter((log) => log.callType === CALL_TYPES.INCOMING).length,
        outgoing: callLogs.filter((log) => log.callType === CALL_TYPES.OUTGOING).length,
        missed: callLogs.filter((log) => log.callType === CALL_TYPES.MISSED).length,
        totalDuration: callLogs.reduce((sum, log) => sum + (log.duration || 0), 0),
        uniqueContacts: new Set(callLogs.map((log) => log.phoneNumber)).size,
      };
    } catch (error) {
      console.error('Error getting call log stats:', error);
      throw error;
    }
  }
}

export default new CallLogService();