// /wwwroot/js/views/home.js

import { api } from '../api.js';
import { updateHeader } from '../header.js';
import { t } from '../i18n.js';

/**
 * Registers the home route
 * @param {RouteRegisterFn} route - Route registration function
 * @returns {void}
 */
export function registerHome(route) {
  route('/home', async el => {
    try {
      // Fetch current user data - this also refreshes CSRF token
      /** @type {User} */
      const user = await api('/auth/me');
      
      // Update header with navigation and profile dropdown
      updateHeader(user);
      
      // Check if user is admin for conditional rendering
      const isAdmin = user.roles && user.roles.includes('Admin');
      
      // Render home page content
      el.innerHTML = `
        <div class="section">
          <div class="section-header">
            <h2 class="section-title mb-0">${t('home.welcome', { name: escapeHtml(user.userName) })}</h2>
          </div>
          
          <div class="grid">
            <div class="card">
              <div class="card-title">${t('home.profileStatus.title')}</div>
              <div class="stat">${user.twoFactorEnabled ? '🔐' : '⚠️'}</div>
              <p class="text-muted">
                ${user.twoFactorEnabled 
                  ? t('home.profileStatus.twoFactorEnabled') 
                  : t('home.profileStatus.twoFactorDisabled')}
              </p>
              ${!user.twoFactorEnabled 
                ? `<a href="#/setup-2fa" class="btn btn-primary">${t('home.profileStatus.setup2FA')}</a>` 
                : ''}
            </div>
            
            ${isAdmin ? `
            <div class="card">
              <div class="card-title">${t('home.administration.title')}</div>
              <div class="stat">⚙️</div>
              <p class="text-muted">${t('home.administration.description')}</p>
              <a href="#/admin/users" class="btn btn-primary">${t('home.administration.manageUsers')}</a>
            </div>
            ` : ''}
            
            <div class="card">
              <div class="card-title">${t('home.account.title')}</div>
              <div class="stat">👤</div>
              <p class="text-muted">${t('home.account.description')}</p>
              <a href="#/profile" class="btn btn-primary">${t('home.account.editProfile')}</a>
            </div>
          </div>
        </div>
      `;
      
    } catch (err) {
      const error = /** @type {Error} */ (err);
      
      // If unauthorized, redirect to login
      if (error.message.includes('Unauthorized') || error.message.includes('401')) {
        location.hash = '/login';
        return;
      }
      
      el.innerHTML = `
        <div class="section">
          <div class="alert alert-danger">
            <strong>${t('errors.generic')}</strong> ${escapeHtml(error.message || t('errors.generic'))}
          </div>
        </div>
      `;
    }
  });
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
