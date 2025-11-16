// /wwwroot/js/types.d.ts
// Global type definitions for JSDoc in JavaScript files

/**
 * Log entry from backend
 */
interface LogEntry {
  /** Unique log entry ID */
  id: number;
  /** Pseudonymized user identifier */
  user: string;
  /** Action that triggered the log */
  action: string;
  /** Context where action occurred */
  context: string;
  /** Detailed log message */
  message: string;
  /** Log category (AUDIT, ERROR, SYSTEM, MAIL, REQUEST) */
  category: string;
  /** ISO 8601 timestamp */
  timestamp: string;
}

/**
 * Application configuration returned by /api/config
 */
interface AppConfig {
  /** Request logging settings */
  requestLogging?: AppConfigRequestLogging;
  /** Application specific settings */
  application?: AppConfigApplication;
}

/**
 * Request logging configuration flags
 */
interface AppConfigRequestLogging {
  /** Whether request logging is enabled */
  enabled: boolean;
}

/**
 * Application UI configuration flags
 */
interface AppConfigApplication {
  /** Controls the visibility of the register link on login page */
  showRegisterLinkOnLoginPage: boolean;
  /** Controls the visibility of the forgot password link on login page */
  showForgotPasswordLinkOnLoginPage: boolean;
}

/**
 * Pagination information
 */
interface PaginationInfo {
  /** Current page number */
  page: number;
  /** Items per page */
  size: number;
  /** Total number of items */
  total: number;
  /** Total number of pages */
  totalPages: number;
}

/**
 * API response for log endpoints (LIST)
 */
interface LogResponse {
  /** Array of log entries */
  logs: LogEntry[];
  /** Pagination metadata */
  pagination: PaginationInfo;
}

/**
 * Audit log entry with encryption information
 */
interface AuditLogEntry {
  /** Unique log entry ID */
  id: number;
  /** Pseudonymized user identifier */
  user: string;
  /** Action that triggered the log */
  action: string;
  /** Context where action occurred */
  context: string;
  /** Detailed log message */
  message: string;
  /** Log category (AUDIT or ERROR) */
  category: string;
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Whether this log has encrypted user info */
  hasEncryptedInfo: boolean;
  /** Decrypted username (only present if decrypted) */
  decryptedUser?: string;
  /** Pseudonymized user (stored when individually decrypted for display) */
  pseudonym?: string;
}

/**
 * API response for audit log endpoints
 */
interface AuditLogResponse {
  /** Array of audit log entries */
  logs: AuditLogEntry[];
  /** Whether logs were returned with decryption */
  decrypted: boolean;
  /** Number of logs returned */
  count: number;
  /** Justification for decryption (if decrypted=true) */
  justification?: string;
}

/**
 * Decrypt log entry data transfer object
 */
interface DecryptLogDto {
  /** Log entry ID to decrypt */
  logId: number;
  /** Reason for decryption (10-500 characters) */
  justification: string;
}

/**
 * Decrypt log entry response
 */
interface DecryptLogResponse {
  /** Log entry ID */
  logId: number;
  /** Log timestamp */
  timestamp: string;
  /** Log action */
  action: string;
  /** Pseudonymized user identifier */
  pseudonymizedUser: string;
  /** Decrypted username */
  decryptedUser: string;
  /** Justification provided */
  justification: string;
  /** Admin who performed decryption */
  decryptedBy: string;
  /** ISO timestamp of decryption */
  decryptedAt: string;
  /** New CSRF token */
  csrfToken: string;
}

/**
 * Log filter state
 */
interface LogFilterState {
  /** Current page number */
  currentPage: number;
  /** Number of items per page */
  pageSize: number;
  /** Column to sort by */
  sortBy: string;
  /** Sort order */
  sortOrder: 'asc' | 'desc';
  /** Current search query */
  searchQuery: string;
}

/**
 * User object
 */
interface User {
  /** User ID */
  id: string;
  /** Username */
  userName: string;
  /** Email address */
  email: string;
  /** Whether 2FA is enabled */
  twoFactorEnabled: boolean;
  /** 2FA method ('Authenticator' or 'Email') */
  twoFactorMethod: string | null;
  /** Whether 2FA is enforced by admin (0 = no, 1 = yes) */
  twoFactorEnforced: number;
  /** User roles */
  roles: string[];
}

/**
 * Admin user object with additional properties
 */
interface AdminUser {
  /** User ID */
  id: string;
  /** Username */
  userName: string;
  /** Email address */
  email: string | null;
  /** Whether 2FA is enabled */
  twoFactorEnabled: boolean;
  /** Lockout end date (ISO string) or null if not locked */
  lockoutEnd: string | null;
  /** User roles (optional) */
  roles?: string[];
  /** Whether 2FA is enforced by admin (0 = no, 1 = yes) */
  twoFactorEnforced: number;
  /** the 2fa method */
  twoFactorMethod: string | null;
  /** wether ldap login is enabled */
  ldapLoginEnabled: number;
}

/**
 * Role object
 */
interface Role {
  /** Role ID */
  id: string;
  /** Role name */
  name: string;
  /** Normalized role name (uppercase) */
  normalizedName: string;
  /** Concurrency stamp */
  concurrencyStamp: string | null;
}

/**
 * Login data transfer object
 */
interface LoginDto {
  /** Username or email */
  username: string;
  /** User password */
  password: string;
  /** Remember me option */
  rememberMe: boolean;
}

/**
 * Registration data transfer object
 */
interface RegisterDto {
  /** Email address */
  email: string;
  /** Username */
  username: string;
  /** Password */
  password: string;
  /** First name (optional) */
  firstName?: string;
  /** Last name (optional) */
  lastName?: string;
}

/**
 * Email verification data transfer object (using token)
 */
interface VerifyEmailDto {
  /** User ID */
  userId: string;
  /** Verification token */
  token: string;
}

/**
 * Email verification data transfer object (using code)
 */
interface VerifyEmailCodeDto {
  /** Email address */
  email: string;
  /** Verification code */
  code: string;
}

/**
 * Resend verification email data transfer object
 */
interface ResendVerificationDto {
  /** Email address */
  email: string;
}

/**
 * 2FA verification data transfer object
 */
interface Verify2FaDto {
  /** 2FA verification code */
  code: string;
  /** Remember device option */
  rememberThisDevice: boolean;
}

/**
 * Create log data transfer object
 */
interface CreateLogDto {
  /** Log category (0=ERROR, 1=AUDIT, 2=REQUEST, 3=MAIL, 4=SYSTEM) */
  category: 0 | 1 | 2 | 3 | 4;
  /** Action or method name */
  action: string;
  /** Context where action occurred */
  context: string;
  /** Log message */
  message: string;
}

/**
 * Simple log data transfer object
 */
interface SimpleLogDto {
  /** Action or method name */
  action: string;
  /** Context where action occurred */
  context: string;
  /** Log message */
  message: string;
}

/**
 * API response object
 */
interface ApiResponse {
  /** Success indicator */
  ok?: boolean;
  /** Error message if failed */
  error?: string;
  /** Response message */
  message?: string;
  /** Whether 2FA is required */
  requires2fa?: boolean;
  /** Whether user needs to setup 2FA (enforced but not configured) */
  needsSetup2fa?: boolean;
  /** 2FA method to use ('Authenticator' or 'Email') */
  twoFactorMethod?: string;
  /** Email address (for Email 2FA login flow) */
  email?: string;
  /** New CSRF token (returned after login/2FA) */
  csrfToken?: string;
}

/**
 * CSRF token response
 */
interface CsrfTokenResponse {
  /** CSRF token */
  token: string;
}

/**
 * Simple log response object (for create log endpoints)
 */
interface SimpleLogResponse {
  /** Log entry ID */
  id: number;
  /** ISO timestamp */
  timestamp: string;
  /** CSRF token */
  csrfToken?: string;
}

/**
 * HTTP methods
 */
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD';

/**
 * API request options
 */
interface ApiOptions {
  /** HTTP method (default: 'GET') */
  method?: HttpMethod;
  /** Request body */
  body?: any;
}

/**
 * Route render function
 */
interface RouteRenderFn {
  (element: HTMLElement, params?: URLSearchParams): void | Promise<void>;
}

/**
 * Route registration function
 */
interface RouteRegisterFn {
  (path: string, render: RouteRenderFn): void;
}

/**
 * Profile data object
 */
interface ProfileData {
  /** User ID */
  id: string;
  /** Username */
  userName: string;
  /** Email address */
  email: string;
  /** First name */
  firstName: string | null;
  /** Last name */
  lastName: string | null;
  /** Whether 2FA is enabled */
  twoFactorEnabled: boolean;
  /** 2FA method ('Authenticator' or 'Email') */
  twoFactorMethod: string | null;
  /** Whether 2FA is enforced by admin (0 = no, 1 = yes) */
  twoFactorEnforced: number;
  /** Account creation date (ISO string) */
  createdAt: string;
  /** Last update date (ISO string) */
  updatedAt: string | null;
}

/**
 * Update profile data transfer object
 */
interface UpdateProfileDto {
  /** First name */
  firstName?: string;
  /** Last name */
  lastName?: string;
  /** Email address (also updates username) */
  email?: string;
}

/**
 * Change password data transfer object
 */
interface ChangePasswordDto {
  /** Current password */
  currentPassword: string;
  /** New password */
  newPassword: string;
}

/**
 * Profile update response
 */
interface ProfileUpdateResponse extends ApiResponse {
  /** Whether email was changed (requires re-login) */
  emailChanged?: boolean;
  /** Response message */
  message?: string;
}

/**
 * Forgot password data transfer object
 */
interface ForgotPasswordDto {
  /** Email address */
  email: string;
}

/**
 * Reset password data transfer object
 */
interface ResetPasswordDto {
  /** Email address */
  email: string;
  /** Reset token from URL (optional) */
  token: string;
  /** 6-digit reset code (optional) */
  code: string;
  /** New password */
  newPassword: string;
}

/**
 * Setup 2FA Authenticator response
 */
interface Setup2FaAuthenticatorResponse extends ApiResponse {
  /** QR code data URL for Authenticator app */
  qrCodeUrl?: string;
  /** Manual entry key for Authenticator app */
  manualEntryKey?: string;
}

/**
 * Verify Authenticator Setup data transfer object
 */
interface VerifyAuthenticatorSetupDto {
  /** 6-digit code from Authenticator app */
  code: string;
}

/**
 * Setup 2FA Response (with recovery codes)
 */
interface Setup2FaResponse extends ApiResponse {
  /** Array of 10 recovery codes (shown only once!) */
  recoveryCodes?: string[];
}

/**
 * Verify 2FA Authenticator data transfer object (for login)
 */
interface Verify2FaAuthenticatorDto {
  /** 6-digit code from Authenticator app */
  code: string;
  /** Remember this device option */
  rememberThisDevice: boolean;
}

/**
 * Verify 2FA Email data transfer object (for login)
 */
interface Verify2FaEmailDto {
  /** Email address */
  email: string;
  /** 6-digit code from email */
  code: string;
  /** Remember this device option */
  rememberThisDevice: boolean;
}

/**
 * Disable 2FA data transfer object
 */
interface Disable2FaDto {
  /** Current password for confirmation */
  password: string;
}

/**
 * Toast notification type
 */
type ToastType = 'success' | 'error' | 'warning' | 'info';

/**
 * Toast options
 */
interface ToastOptions {
  /** Toast message */
  message: string;
  /** Toast type (default: 'info') */
  type?: ToastType;
  /** Duration in milliseconds (0 = no auto-dismiss, default: 4000) */
  duration?: number;
  /** Optional toast title */
  title?: string;
}