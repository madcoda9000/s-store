// /wwwroot/js/auth-utils.js

import { api } from './api.js';
import { icon, Icons } from './icons.js';
import { t } from './i18n.js';
import { logger } from './logger.js';

/**
 * Checks if the user is authenticated by calling the /auth/me endpoint
 * @returns {Promise<boolean>} true if authenticated, false otherwise
 */
export async function checkAuth() {
  try {
    await api('/auth/me');
    return true;
  } catch {
    return false;
  }
}

/**
 * Gets the current user from the backend
 * @returns {Promise<User|null>} User object or null if not authenticated
 */
export async function getUserFromState() {
  try {
    const user = await api('/auth/me');
    return user;
  } catch {
    return null;
  }
}

/**
 * Logs an unauthorized access attempt to the backend
 * @param {User} user - User object
 * @param {string} attemptedRoute - Route that was accessed
 * @param {string} requiredRole - Required role for the route
 * @returns {Promise<void>}
 */
export async function logUnauthorizedAccess(user, attemptedRoute, requiredRole) {
  try {
    const userName = user?.userName || 'Unknown';
    const userRoles = user?.roles?.join(', ') || 'None';
    
    await logger.log(
      1, // AUDIT category
      'UnauthorizedAccess',
      'Authorization',
      `User '${userName}' (Roles: ${userRoles}) attempted to access '${attemptedRoute}' which requires '${requiredRole}' role`
    );
  } catch (error) {
    // Silent fail - don't block the UI if logging fails
    console.error('Failed to log unauthorized access:', error);
  }
}

/**
 * Checks if the current user has a specific role
 * @param {User} user - User object
 * @param {string} requiredRole - Required role name (e.g., 'Admin')
 * @returns {boolean} True if user has the role
 */
export function hasRole(user, requiredRole) {
  if (!user || !user.roles || !Array.isArray(user.roles)) {
    return false;
  }
  
  return user.roles.includes(requiredRole);
}

/**
 * Checks if the current user has any of the specified roles
 * @param {User} user - User object
 * @param {string[]} requiredRoles - Array of role names
 * @returns {boolean} True if user has at least one of the roles
 */
export function hasAnyRole(user, requiredRoles) {
  if (!user || !user.roles || !Array.isArray(user.roles)) {
    return false;
  }
  
  return requiredRoles.some(role => user.roles.includes(role));
}

/**
 * Checks if the current user has all of the specified roles
 * @param {User} user - User object
 * @param {string[]} requiredRoles - Array of role names
 * @returns {boolean} True if user has all of the roles
 */
export function hasAllRoles(user, requiredRoles) {
  if (!user || !user.roles || !Array.isArray(user.roles)) {
    return false;
  }
  
  return requiredRoles.every(role => user.roles.includes(role));
}

/**
 * Renders an "Access Denied" view and logs the unauthorized attempt
 * @param {User} user - User object
 * @param {string} attemptedRoute - Route that was accessed
 * @param {string} requiredRole - Required role for the route
 * @param {string} [message] - Optional custom message
 * @param {string} [redirectRoute] - Optional redirect route (default: '/home')
 * @returns {string} HTML string
 */
export function renderAccessDenied(user, attemptedRoute, requiredRole, message, redirectRoute = '/home') {
  // Log unauthorized access attempt (async, non-blocking)
  logUnauthorizedAccess(user, attemptedRoute, requiredRole).catch(() => {
    // Silent fail - already handled in logUnauthorizedAccess
  });
  
  const defaultMessage = t('errors.accessDenied') || 'Access Denied';
  const displayMessage = message || t('errors.accessDeniedDescription') || 
    'You do not have permission to access this page.';
  
  return `
    <div class="section">
      <div class="auth-container">
        <div class="auth-card card shadow-lg">
          <div class="auth-header">
            <div style="font-size: 4rem; margin-bottom: 1rem;">
              ${icon(Icons.LOCK)}
            </div>
            <h2>${defaultMessage}</h2>
            <p class="text-muted">${escapeHtml(displayMessage)}</p>
          </div>
          
          <div class="alert alert-danger">
            <strong>${t('common.warning') || 'Warning'}:</strong> 
            ${t('errors.unauthorizedAccess') || 'This unauthorized access attempt has been logged.'}
          </div>
          
          <a href="#${redirectRoute}" class="btn btn-primary btn-block">
            ${icon(Icons.ARROW_LEFT)}
            ${t('common.backToHome') || 'Back to Home'}
          </a>
        </div>
      </div>
    </div>
  `;
}

/**
 * Escapes HTML special characters to prevent XSS
 * @param {string|null|undefined} str - String to escape
 * @returns {string} Escaped string
 */
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, (char) => {
    /** @type {Record<string, string>} */
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };
    return map[char];
  });
}
