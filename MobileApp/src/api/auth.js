import client from './client';

class AuthAPI {
  /**
   * Send OTP to mobile number
   */
  async sendOTP(mobileNumber) {
    try {
      const response = await client.post('/auth/send-otp', { mobileNumber });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Verify OTP and login
   */
  async verifyOTP(mobileNumber, otp) {
    try {
      const response = await client.post('/auth/verify-otp', { mobileNumber, otp });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Resend OTP
   */
  async resendOTP(mobileNumber) {
    try {
      const response = await client.post('/auth/resend-otp', { mobileNumber });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get current user profile
   */
  async getProfile() {
    try {
      const response = await client.get('/auth/profile');
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Logout
   */
  async logout() {
    try {
      const response = await client.post('/auth/logout');
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  handleError(error) {
    if (error.response) {
      // Server responded with error
      return new Error(error.response.data?.message || 'Server error');
    } else if (error.request) {
      // Request made but no response
      return new Error('Network error. Please check your connection.');
    } else {
      // Something else happened
      return new Error('An unexpected error occurred');
    }
  }
}

export default new AuthAPI();