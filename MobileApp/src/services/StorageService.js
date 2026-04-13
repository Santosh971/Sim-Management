import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../utils/constants';

class StorageService {
  // Token management
  async setToken(token) {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.TOKEN, token);
      return true;
    } catch (error) {
      console.error('Error saving token:', error);
      return false;
    }
  }

  async getToken() {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);
    } catch (error) {
      console.error('Error getting token:', error);
      return null;
    }
  }

  async removeToken() {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.TOKEN);
      return true;
    } catch (error) {
      console.error('Error removing token:', error);
      return false;
    }
  }

  // Refresh token management
  async setRefreshToken(refreshToken) {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
      return true;
    } catch (error) {
      console.error('Error saving refresh token:', error);
      return false;
    }
  }

  async getRefreshToken() {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
    } catch (error) {
      console.error('Error getting refresh token:', error);
      return null;
    }
  }

  // User data management
  async setUser(user) {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
      return true;
    } catch (error) {
      console.error('Error saving user:', error);
      return false;
    }
  }

  async getUser() {
    try {
      const userStr = await AsyncStorage.getItem(STORAGE_KEYS.USER);
      return userStr ? JSON.parse(userStr) : null;
    } catch (error) {
      console.error('Error getting user:', error);
      return null;
    }
  }

  async removeUser() {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.USER);
      return true;
    } catch (error) {
      console.error('Error removing user:', error);
      return false;
    }
  }

  // Mobile number management (for background sync, persists after logout)
  async setMobileNumber(mobileNumber) {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.MOBILE_NUMBER, mobileNumber);
      return true;
    } catch (error) {
      console.error('Error saving mobile number:', error);
      return false;
    }
  }

  async getMobileNumber() {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.MOBILE_NUMBER);
    } catch (error) {
      console.error('Error getting mobile number:', error);
      return null;
    }
  }

  // Last sync timestamp
  async setLastSync(timestamp) {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_SYNC, timestamp.toISOString());
      return true;
    } catch (error) {
      console.error('Error saving last sync:', error);
      return false;
    }
  }

  async getLastSync() {
    try {
      const timestampStr = await AsyncStorage.getItem(STORAGE_KEYS.LAST_SYNC);
      return timestampStr ? new Date(timestampStr) : null;
    } catch (error) {
      console.error('Error getting last sync:', error);
      return null;
    }
  }

  // Sync interval preference
  async setSyncInterval(intervalMs) {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SYNC_INTERVAL, intervalMs.toString());
      return true;
    } catch (error) {
      console.error('Error saving sync interval:', error);
      return false;
    }
  }

  async getSyncInterval() {
    try {
      const intervalStr = await AsyncStorage.getItem(STORAGE_KEYS.SYNC_INTERVAL);
      return intervalStr ? parseInt(intervalStr, 10) : null;
    } catch (error) {
      console.error('Error getting sync interval:', error);
      return null;
    }
  }

  // Pending logs queue (for offline support)
  async addPendingLogs(logs) {
    try {
      const pendingStr = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_LOGS);
      const pending = pendingStr ? JSON.parse(pendingStr) : [];
      const updated = [...pending, ...logs];
      await AsyncStorage.setItem(STORAGE_KEYS.PENDING_LOGS, JSON.stringify(updated));
      return updated.length;
    } catch (error) {
      console.error('Error adding pending logs:', error);
      return 0;
    }
  }

  async getPendingLogs() {
    try {
      const pendingStr = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_LOGS);
      return pendingStr ? JSON.parse(pendingStr) : [];
    } catch (error) {
      console.error('Error getting pending logs:', error);
      return [];
    }
  }

  async clearPendingLogs() {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.PENDING_LOGS);
      return true;
    } catch (error) {
      console.error('Error clearing pending logs:', error);
      return false;
    }
  }

  // Clear all auth data (logout)
  async clearAuthData() {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.TOKEN,
        STORAGE_KEYS.REFRESH_TOKEN,
        STORAGE_KEYS.USER,
      ]);
      // Mobile number is NOT cleared - it persists for background sync
      return true;
    } catch (error) {
      console.error('Error clearing auth data:', error);
      return false;
    }
  }

  // Clear all data (full reset)
  async clearAll() {
    try {
      await AsyncStorage.clear();
      return true;
    } catch (error) {
      console.error('Error clearing all data:', error);
      return false;
    }
  }
}

export default new StorageService();