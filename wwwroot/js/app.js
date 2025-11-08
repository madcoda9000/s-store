import { start, route } from '/js/router.js';
import { api, initCsrfToken } from '/js/api.js';
import { logger } from '/js/logger.js';
import { initI18n } from '/js/i18n.js';
import { registerLogin } from '/js/views/login.js';
import { registerLogout } from '/js/views/logout.js';
import { registerHome } from '/js/views/home.js';
import { registerAdminUsers } from '/js/views/admin-users.js';
import { registerProfile } from '/js/views/profile.js';
import { registerRegister } from '/js/views/register.js';
import { registerVerifyEmail } from '/js/views/verify-email.js';
import { registerForgotPassword } from '/js/views/forgot-password.js';
import { registerResetPassword } from '/js/views/reset-password.js';
import { registerSetup2fa } from '/js/views/setup-2fa.js';
import { registerVerify2fa } from '/js/views/verify-2fa.js';
import { icon, Icons } from '/js/icons.js';

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
 * Protects a route by checking authentication before rendering
 * @param {RouteRenderFn} renderFn - The function to render the view
 * @returns {RouteRenderFn} Protected render function
 */
function protect(renderFn) {
  return async (el) => {
    const isAuth = await checkAuth();
    if (!isAuth) {
      location.hash = '/login';
      return;
    }
    await renderFn(el);
  };
}

/**
 * Initialize theme functionality with event delegation
 * @returns {void}
 */
function initTheme() {
  const html = document.documentElement;
  
  // Check saved theme or system preference
  const savedTheme = localStorage.getItem('theme');
  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  const currentTheme = savedTheme || systemTheme;
  
  html.setAttribute('data-theme', currentTheme);
  
  // Update initial theme toggle icon
  updateThemeToggleIcon();
  
  // Use event delegation for theme toggle
  document.addEventListener('click', (e) => {
    const target = /** @type {HTMLElement} */ (e.target);
    
    // Check if clicked element is theme toggle or auth theme toggle
    if (target.closest('#theme-toggle') || target.closest('#auth-theme-toggle')) {
      const currentTheme = html.getAttribute('data-theme');
      const newTheme = currentTheme === 'light' ? 'dark' : 'light';
      html.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);
      
      // Update theme toggle icon
      updateThemeToggleIcon();
    }
  });
}

/**
 * Updates the theme toggle icon based on current theme
 * @returns {void}
 */
function updateThemeToggleIcon() {
  const themeToggle = document.getElementById('theme-toggle');
  if (!themeToggle) return;
  
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  const activeTheme = currentTheme || systemTheme;
  
  themeToggle.innerHTML = activeTheme === 'dark' 
    ? icon(Icons.SUN, 'icon icon-lg') 
    : icon(Icons.MOON, 'icon icon-lg');
}

// Register all views
registerLogin(route);
registerLogout(route);
registerHome(route);
registerAdminUsers(route);
registerProfile(route);
registerRegister(route);
registerVerifyEmail(route);
registerForgotPassword(route);
registerResetPassword(route);
registerSetup2fa(route);
registerVerify2fa(route);

// 404 handler
route('/404', el => {
  el.innerHTML = `
    <div class="auth-container">
      <div class="auth-wrapper">
        <div class="card auth-card">
          <div class="auth-header">
            <div class="from">
              <h1 class="text-4xl">404</h1>
              <p class="text-muted">Page not found</p>
            </div>
          </div>
          <a href="#/login" class="btn btn-primary btn-block">Go to Login</a>
        </div>
      </div>
    </div>`;
});

/**
 * Refreshes CSRF token when page becomes visible again
 * This prevents token expiration issues when the page is left open
 * @returns {void}
 */
function setupTokenRefresh() {
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible') {
      // Refresh token when user returns to the page
      // Only if authenticated (to avoid unnecessary calls on login page)
      const isAuth = await checkAuth();
      if (isAuth) {
        await initCsrfToken();
      }
    }
  });
}

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  
  // Initialize i18n BEFORE anything else
  await initI18n();
  
  // Initialize CSRF token before any API calls
  await initCsrfToken();
  
  // Setup automatic token refresh on page visibility
  setupTokenRefresh();
  
  // Start the router AFTER i18n and CSRF token are initialized
  start();
  
  // Optional: Setup global error handler for automatic error logging
  // Uncomment the line below to enable automatic frontend error logging
  logger.setupGlobalErrorHandler();
});

// Export logger for use in other modules
export { protect, logger, updateThemeToggleIcon };
