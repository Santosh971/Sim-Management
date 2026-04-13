import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Input from '../components/Input';
import Button from '../components/Button';
import authAPI from '../api/auth';
import storageService from '../services/StorageService';
import { COLORS } from '../utils/constants';

const LoginScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const [mobileNumber, setMobileNumber] = useState(route.params?.mobileNumber || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // If mobile number passed from splash, pre-fill it
    if (route.params?.mobileNumber) {
      setMobileNumber(route.params.mobileNumber);
    }
  }, [route.params?.mobileNumber]);

  const handleSendOTP = async () => {
    // Validate mobile number
    if (!mobileNumber) {
      setError('Mobile number is required');
      return;
    }

    if (!/^\d{10}$/.test(mobileNumber)) {
      setError('Please enter a valid 10-digit mobile number');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const response = await authAPI.sendOTP(mobileNumber);

      if (response.success) {
        // Store mobile number for background sync (persists after logout)
        await storageService.setMobileNumber(mobileNumber);

        // Navigate to OTP screen
        navigation.navigate('OTP', {
          mobileNumber,
          // In development, OTP might be returned in response
          devOTP: response.otp,
        });
      } else {
        setError(response.message || 'Failed to send OTP');
      }
    } catch (err) {
      setError(err.message || 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.logo}>📱</Text>
          <Text style={styles.title}>SIM Manager</Text>
          <Text style={styles.subtitle}>
            Enter your mobile number to receive an OTP via email
          </Text>
        </View>

        <View style={styles.form}>
          <Input
            label="Mobile Number"
            value={mobileNumber}
            onChangeText={(text) => {
              setMobileNumber(text.replace(/\D/g, '').slice(0, 10));
              setError('');
            }}
            placeholder="Enter 10-digit mobile number"
            keyboardType="phone-pad"
            maxLength={10}
            error={error}
            style={styles.input}
          />

          <Text style={styles.note}>
            An OTP will be sent to your registered email address
          </Text>

          <Button
            title={loading ? 'Sending OTP...' : 'Send OTP'}
            onPress={handleSendOTP}
            loading={loading}
            disabled={mobileNumber.length !== 10}
            style={styles.button}
          />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            By continuing, you agree to our Terms of Service and Privacy Policy
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginTop: 48,
    marginBottom: 32,
  },
  logo: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  form: {
    marginTop: 24,
  },
  input: {
    marginBottom: 8,
  },
  note: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 24,
    textAlign: 'center',
  },
  button: {
    marginTop: 8,
  },
  footer: {
    marginTop: 'auto',
    paddingTop: 24,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
});

export default LoginScreen;