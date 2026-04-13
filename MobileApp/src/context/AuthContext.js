import React, { createContext, useState, useEffect, useContext } from 'react';
import authAPI from '../api/auth';
import storageService from '../services/StorageService';
import { STORAGE_KEYS } from '../utils/constants';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check authentication state on mount
  useEffect(() => {
    checkAuthState();
  }, []);

  const checkAuthState = async () => {
    try {
      const storedToken = await storageService.getToken();
      const storedUser = await storageService.getUser();

      if (storedToken && storedUser) {
        // Verify token is still valid
        try {
          await authAPI.getProfile();
          setToken(storedToken);
          setUser(storedUser);
          setIsAuthenticated(true);
        } catch (error) {
          // Token is invalid, clear auth data
          await storageService.clearAuthData();
        }
      }
    } catch (error) {
      console.error('Error checking auth state:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (mobileNumber, otp) => {
    try {
      setLoading(true);
      const response = await authAPI.verifyOTP(mobileNumber, otp);

      if (response.success) {
        await storageService.setToken(response.token);
        await storageService.setRefreshToken(response.refreshToken);
        await storageService.setUser(response.user);
        // Also store mobile number for background sync (persists after logout)
        await storageService.setMobileNumber(mobileNumber);

        setToken(response.token);
        setUser(response.user);
        setIsAuthenticated(true);

        return { success: true };
      }

      return { success: false, message: response.message };
    } catch (error) {
      return { success: false, message: error.message };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      setLoading(true);
      await authAPI.logout();
    } catch (error) {
      // Ignore logout API errors
      console.error('Logout API error:', error);
    } finally {
      await storageService.clearAuthData();
      setToken(null);
      setUser(null);
      setIsAuthenticated(false);
      setLoading(false);
    }
  };

  const updateUser = async (userData) => {
    try {
      await storageService.setUser(userData);
      setUser(userData);
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  };

  const value = {
    user,
    token,
    loading,
    isAuthenticated,
    login,
    logout,
    updateUser,
    checkAuthState,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;