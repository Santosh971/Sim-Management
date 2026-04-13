import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import storageService from '../services/StorageService';
import { COLORS } from '../utils/constants';

const SplashScreen = () => {
  const navigation = useNavigation();
  const { checkAuthState, loading: authLoading } = useAuth();

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // Check if user has mobile number stored (for background sync)
      const mobileNumber = await storageService.getMobileNumber();

      // Check auth state
      await checkAuthState();

      // Navigate based on state
      if (authLoading) return; // Still loading

      const token = await storageService.getToken();

      if (token) {
        // User is logged in - go to dashboard
        navigation.reset({
          index: 0,
          routes: [{ name: 'Dashboard' }],
        });
      } else if (mobileNumber) {
        // Has mobile number but not logged in - go to OTP screen
        navigation.reset({
          index: 0,
          routes: [{ name: 'Login', params: { mobileNumber } }],
        });
      } else {
        // First time user - go to login
        navigation.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
      }
    } catch (error) {
      console.error('Initialization error:', error);
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>📱</Text>
      <Text style={styles.title}>SIM Manager</Text>
      <Text style={styles.subtitle}>Call Log Sync</Text>
      <ActivityIndicator
        size="large"
        color={COLORS.primary}
        style={styles.loader}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
  },
  logo: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.white,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.white,
    opacity: 0.8,
    marginBottom: 32,
  },
  loader: {
    marginTop: 16,
  },
});

export default SplashScreen;