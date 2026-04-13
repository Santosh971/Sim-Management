// App constants
export const API_BASE_URL = 'http://localhost:5000/api';

// Storage keys
export const STORAGE_KEYS = {
  TOKEN: '@sim_manager_token',
  REFRESH_TOKEN: '@sim_manager_refresh_token',
  USER: '@sim_manager_user',
  MOBILE_NUMBER: '@sim_manager_mobile_number',
  LAST_SYNC: '@sim_manager_last_sync',
  SYNC_INTERVAL: '@sim_manager_sync_interval',
  PENDING_LOGS: '@sim_manager_pending_logs',
};

// Sync configuration
export const SYNC_CONFIG = {
  DEFAULT_INTERVAL: 15 * 60 * 1000, // 15 minutes in milliseconds
  MIN_INTERVAL: 5 * 60 * 1000, // 5 minutes minimum
  MAX_PENDING_LOGS: 1000,
  BATCH_SIZE: 100,
};

// Colors
export const COLORS = {
  primary: '#2563EB',
  primaryDark: '#1D4ED8',
  secondary: '#64748B',
  success: '#16A34A',
  warning: '#D97706',
  danger: '#DC2626',
  background: '#F8FAFC',
  card: '#FFFFFF',
  text: '#1E293B',
  textSecondary: '#64748B',
  border: '#E2E8F0',
  white: '#FFFFFF',
  black: '#000000',
};

// Font sizes
export const FONT_SIZES = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

// Spacing
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

// Call types
export const CALL_TYPES = {
  INCOMING: 'incoming',
  OUTGOING: 'outgoing',
  MISSED: 'missed',
};

// App states
export const APP_STATES = {
  CHECKING_AUTH: 'CHECKING_AUTH',
  NEEDS_PERMISSION: 'NEEDS_PERMISSION',
  READY: 'READY',
  SYNCING: 'SYNCING',
};