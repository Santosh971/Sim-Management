import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';

class CallLogsAPI {
  /**
   * Sync call logs from device (public endpoint - no JWT required)
   * Uses mobile number for identification
   */
  async deviceSync(mobileNumber, callLogs, deviceId = 'mobile-device') {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/call-logs/device-sync`,
        {
          mobileNumber,
          callLogs,
          deviceId,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-device-id': deviceId,
          },
        }
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Sync call logs (authenticated endpoint)
   */
  async sync(simId, callLogs, deviceId = 'mobile-device') {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/call-logs/sync`,
        {
          simId,
          callLogs,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-device-id': deviceId,
          },
        }
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get call log stats
   */
  async getStats(token) {
    try {
      const response = await axios.get(`${API_BASE_URL}/call-logs/stats`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  handleError(error) {
    if (error.response) {
      return new Error(error.response.data?.message || 'Server error');
    } else if (error.request) {
      return new Error('Network error. Please check your connection.');
    } else {
      return new Error('An unexpected error occurred');
    }
  }
}

export default new CallLogsAPI();