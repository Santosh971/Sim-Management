import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';
import storageService from '../services/StorageService';

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add auth token
client.interceptors.request.use(
  async (config) => {
    const token = await storageService.getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handle errors
client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Handle 401 - token expired
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = await storageService.getRefreshToken();
        if (refreshToken) {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh-token`, {
            refreshToken,
          });

          if (response.data.success) {
            await storageService.setToken(response.data.token);
            originalRequest.headers.Authorization = `Bearer ${response.data.token}`;
            return axios(originalRequest);
          }
        }
      } catch (refreshError) {
        // Refresh failed - clear auth data
        await storageService.clearAuthData();
      }
    }

    return Promise.reject(error);
  }
);

export default client;