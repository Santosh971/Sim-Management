import { Platform } from 'react-native';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import callLogService from './CallLogService';
import callLogsAPI from '../api/callLogs';
import storageService from './StorageService';
import { SYNC_CONFIG } from '../utils/constants';

const SYNC_TASK_NAME = 'call-log-sync-task';

class SyncService {
  constructor() {
    this.isRegistered = false;
  }

  /**
   * Initialize background sync
   */
  async initialize() {
    // Check if call log service is available
    if (!callLogService.isCallLogAvailable()) {
      console.log('Call log service not available - skipping background sync registration');
      return false;
    }

    if (Platform.OS !== 'android') {
      console.log('Background sync is only available on Android');
      return false;
    }

    try {
      // Register the background task
      await this.registerBackgroundTask();
      this.isRegistered = true;
      console.log('SyncService initialized successfully');
      return true;
    } catch (error) {
      console.error('Error initializing SyncService:', error);
      return false;
    }
  }

  /**
   * Register background sync task
   */
  async registerBackgroundTask() {
    try {
      // Define the task
      TaskManager.defineTask(SYNC_TASK_NAME, async () => {
        try {
          const result = await this.performSync();
          return result
            ? BackgroundFetch.BackgroundFetchResult.NewData
            : BackgroundFetch.BackgroundFetchResult.NoData;
        } catch (error) {
          console.error('Background sync error:', error);
          return BackgroundFetch.BackgroundFetchResult.Failed;
        }
      });

      // Register background fetch
      await BackgroundFetch.registerTaskAsync(SYNC_TASK_NAME, {
        minimumIntervalSeconds: SYNC_CONFIG.DEFAULT_INTERVAL / 1000,
        stopOnTerminate: false,
        startOnReceive: true,
      });

      console.log('Background task registered');
      return true;
    } catch (error) {
      console.error('Error registering background task:', error);
      return false;
    }
  }

  /**
   * Unregister background sync task
   */
  async unregisterBackgroundTask() {
    try {
      await BackgroundFetch.unregisterTaskAsync(SYNC_TASK_NAME);
      this.isRegistered = false;
      return true;
    } catch (error) {
      console.error('Error unregistering background task:', error);
      return false;
    }
  }

  /**
   * Perform sync operation
   */
  async performSync() {
    // Check if call log service is available
    if (!callLogService.isCallLogAvailable()) {
      console.log('Call log service not available - skipping sync');
      return false;
    }

    try {
      const mobileNumber = await storageService.getMobileNumber();

      if (!mobileNumber) {
        console.log('No mobile number stored, skipping sync');
        return false;
      }

      // Check permission
      const { granted } = await callLogService.checkPermission();
      if (!granted) {
        console.log('Call log permission not granted');
        return false;
      }

      // Get call logs since last sync
      const callLogs = await callLogService.getCallLogsSinceLastSync();

      if (!callLogs || callLogs.length === 0) {
        console.log('No new call logs to sync');
        return true; // Success but no data
      }

      // Sync in batches to avoid large payloads
      const batches = this.batchArray(callLogs, SYNC_CONFIG.BATCH_SIZE);
      let totalSynced = 0;
      let hasError = false;

      for (const batch of batches) {
        try {
          const result = await callLogsAPI.deviceSync(mobileNumber, batch);
          if (result.success) {
            totalSynced += result.data?.synced || batch.length;
          }
        } catch (error) {
          console.error('Error syncing batch:', error);
          hasError = true;
          // Save failed batch to pending logs
          await storageService.addPendingLogs(batch);
        }
      }

      // Update last sync timestamp if at least some synced
      if (totalSynced > 0) {
        await storageService.setLastSync(new Date());
      }

      return !hasError;
    } catch (error) {
      console.error('Sync error:', error);
      return false;
    }
  }

  /**
   * Manual sync trigger
   */
  async manualSync(onProgress) {
    // Check if call log service is available
    if (!callLogService.isCallLogAvailable()) {
      return {
        success: false,
        message: 'Call log access requires a development build. Run: npx expo prebuild && npx expo run:android'
      };
    }

    try {
      if (onProgress) onProgress({ status: 'checking_permission' });

      const { granted } = await callLogService.checkPermission();
      if (!granted) {
        return { success: false, message: 'Permission not granted' };
      }

      if (onProgress) onProgress({ status: 'reading_logs' });

      const mobileNumber = await storageService.getMobileNumber();
      if (!mobileNumber) {
        return { success: false, message: 'No mobile number found. Please login first.' };
      }

      const callLogs = await callLogService.getCallLogsSinceLastSync();

      if (!callLogs || callLogs.length === 0) {
        return { success: true, synced: 0, message: 'No new call logs to sync' };
      }

      if (onProgress) onProgress({ status: 'syncing', total: callLogs.length });

      // Sync all logs
      const result = await callLogsAPI.deviceSync(mobileNumber, callLogs);

      if (result.success) {
        await storageService.setLastSync(new Date());
        return {
          success: true,
          synced: result.data?.synced || callLogs.length,
          message: 'Sync completed successfully',
        };
      }

      return { success: false, message: result.message || 'Sync failed' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  /**
   * Sync pending logs (failed during offline)
   */
  async syncPendingLogs() {
    // Check if call log service is available
    if (!callLogService.isCallLogAvailable()) {
      return { success: false, message: 'Call log access not available' };
    }

    try {
      const pendingLogs = await storageService.getPendingLogs();

      if (!pendingLogs || pendingLogs.length === 0) {
        return { success: true, synced: 0 };
      }

      const mobileNumber = await storageService.getMobileNumber();
      if (!mobileNumber) {
        return { success: false, message: 'No mobile number found' };
      }

      // Try to sync pending logs
      const result = await callLogsAPI.deviceSync(mobileNumber, pendingLogs);

      if (result.success) {
        await storageService.clearPendingLogs();
        return { success: true, synced: pendingLogs.length };
      }

      return { success: false, message: result.message };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  /**
   * Get sync status
   */
  async getSyncStatus() {
    try {
      const lastSync = await storageService.getLastSync();
      const pendingLogs = await storageService.getPendingLogs();
      const mobileNumber = await storageService.getMobileNumber();

      return {
        hasMobileNumber: !!mobileNumber,
        lastSync: lastSync,
        pendingLogs: pendingLogs.length,
        isBackgroundTaskRegistered: this.isRegistered,
        isCallLogAvailable: callLogService.isCallLogAvailable(),
      };
    } catch (error) {
      console.error('Error getting sync status:', error);
      return {
        hasMobileNumber: false,
        lastSync: null,
        pendingLogs: 0,
        isBackgroundTaskRegistered: false,
        isCallLogAvailable: false,
      };
    }
  }

  /**
   * Set sync interval (in minutes)
   */
  async setSyncInterval(minutes) {
    const intervalMs = Math.max(minutes * 60 * 1000, SYNC_CONFIG.MIN_INTERVAL);
    await storageService.setSyncInterval(intervalMs);

    // Re-register task with new interval
    if (this.isRegistered) {
      await this.unregisterBackgroundTask();
      await this.registerBackgroundTask();
    }

    return true;
  }

  /**
   * Helper: Split array into batches
   */
  batchArray(array, batchSize) {
    const batches = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  }
}

export default new SyncService();