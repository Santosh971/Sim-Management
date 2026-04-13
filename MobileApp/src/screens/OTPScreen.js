import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Button from '../components/Button';
import { useAuth } from '../context/AuthContext';
import authAPI from '../api/auth';
import { COLORS } from '../utils/constants';

const OTPScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { mobileNumber, devOTP } = route.params || {};
  const { login } = useAuth();

  const [otp, setOtp] = useState(devOTP || '');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(30);
  const [canResend, setCanResend] = useState(false);
  const inputRefs = useRef([]);

  useEffect(() => {
    // Development mode: auto-fill OTP if returned in response
    if (devOTP) {
      setOtp(devOTP);
    }
  }, [devOTP]);

  useEffect(() => {
    // Countdown timer for resend
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setCanResend(true);
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleVerifyOTP = async () => {
    if (otp.length !== 6) {
      setError('Please enter a valid 6-digit OTP');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const result = await login(mobileNumber, otp);

      if (result.success) {
        // Navigate to permission screen (first time) or dashboard
        navigation.reset({
          index: 0,
          routes: [{ name: 'Permission' }],
        });
      } else {
        setError(result.message || 'Invalid OTP. Please try again.');
      }
    } catch (err) {
      setError(err.message || 'Failed to verify OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setResending(true);
    setError('');
    setOtp('');

    try {
      const response = await authAPI.resendOTP(mobileNumber);

      if (response.success) {
        setCountdown(30);
        setCanResend(false);
        // Start countdown again
        const timer = setInterval(() => {
          setCountdown((prev) => {
            if (prev <= 1) {
              setCanResend(true);
              clearInterval(timer);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);

        // Development mode: auto-fill OTP
        if (response.otp) {
          setOtp(response.otp);
        }
      } else {
        setError(response.message || 'Failed to resend OTP');
      }
    } catch (err) {
      setError(err.message || 'Failed to resend OTP');
    } finally {
      setResending(false);
    }
  };

  const handleOtpChange = (text, index) => {
    // Only allow digits
    const digit = text.replace(/\D/g, '');
    if (digit.length > 1) {
      // Handle paste
      const otpArray = digit.slice(0, 6).split('');
      const newOtp = otpArray.join('').padEnd(6, ' ').slice(0, 6);
      setOtp(newOtp.replace(/\s/g, ''));
    } else {
      const otpArray = otp.split('');
      otpArray[index] = digit;
      const newOtp = otpArray.join('');
      setOtp(newOtp);

      // Auto-focus next input
      if (digit && index < 5) {
        inputRefs.current[index + 1]?.focus();
      }
    }
  };

  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <Text style={styles.title}>Enter OTP</Text>
        <Text style={styles.subtitle}>
          Enter the 6-digit OTP sent to your email for{'\n'}
          <Text style={styles.phoneNumber}>+91 {mobileNumber}</Text>
        </Text>

        <View style={styles.otpContainer}>
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <TextInput
              key={index}
              ref={(ref) => (inputRefs.current[index] = ref)}
              style={[
                styles.otpInput,
                otp.length === 6 && error && styles.otpInputError,
              ]}
              value={otp[index] || ''}
              onChangeText={(text) => handleOtpChange(text, index)}
              onKeyPress={(e) => handleKeyPress(e, index)}
              keyboardType="number-pad"
              maxLength={index === 0 ? 6 : 1}
              selectTextOnFocus
              textAlign="center"
            />
          ))}
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        <Button
          title={loading ? 'Verifying...' : 'Verify OTP'}
          onPress={handleVerifyOTP}
          loading={loading}
          disabled={otp.length !== 6}
          style={styles.button}
        />

        <Button
          title={
            resending
              ? 'Resending...'
              : canResend
              ? 'Resend OTP'
              : `Resend in ${countdown}s`
          }
          onPress={handleResendOTP}
          variant="secondary"
          disabled={!canResend || resending}
          style={styles.resendButton}
        />

        <Button
          title="Change Number"
          onPress={() => navigation.goBack()}
          variant="ghost"
          style={styles.changeButton}
        />
      </View>
    </KeyboardAvoidingView>
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
    justifyContent: 'center',
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
    marginBottom: 32,
  },
  phoneNumber: {
    fontWeight: '600',
    color: COLORS.text,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    width: '100%',
    maxWidth: 320,
  },
  otpInput: {
    width: 48,
    height: 56,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderRadius: 12,
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    backgroundColor: COLORS.card,
    color: COLORS.text,
  },
  otpInputError: {
    borderColor: COLORS.danger,
  },
  error: {
    fontSize: 14,
    color: COLORS.danger,
    marginBottom: 16,
    textAlign: 'center',
  },
  button: {
    width: '100%',
    maxWidth: 320,
  },
  resendButton: {
    width: '100%',
    maxWidth: 320,
    marginTop: 12,
  },
  changeButton: {
    marginTop: 12,
  },
});

export default OTPScreen;