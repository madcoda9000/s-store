// /wwwroot/js/types.d.ts
// Global type definitions for JSDoc in JavaScript files

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
  /** the 2fa method **/
  twoFactorMethod: string | null;
  /** wether ldap login is enabled  **/
  ldapLoginEnabled: number;
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
 * Log response object
 */
interface LogResponse {
  /** Log entry ID */
  id: number;
  /** ISO timestamp */
  timestamp: string;
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
  (element: HTMLElement): void | Promise<void>;
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
