// /wwwroot/js/views/admin-users.js

import { api, setCsrfToken } from '../api.js';
import { updateHeader } from '../header.js';
import { hasRole, renderAccessDenied } from '../auth-utils.js';
import { t } from '../i18n.js';

/**
 * User action types
 * @typedef {'enable'|'disable'|'enforce2fa'|'unenforce2fa'|'delete'} UserAction
 */

/**
 * Registers the admin users route
 * @param {RouteRegisterFn} route - Route registration function
 * @returns {void}
 */
export function registerAdminUsers(route) {
  route('/admin/users', async el => {
    try {
      // Fetch current user data first to update header
      /** @type {User} */
      const currentUser = await api('/auth/me');
      
      // Update header with navigation and profile dropdown
      updateHeader(currentUser);
      
      // Check if user has Admin role
      if (!hasRole(currentUser, 'Admin')) {
        el.innerHTML = renderAccessDenied(
          currentUser,
          '/admin/users',
          'Admin',
          t('errors.adminAccessRequired') || 'You need administrator privileges to access this page.'
        );
        return;
      }
      
      // Fetch users list
      /** @type {AdminUser[]} */
      const list = await api('/admin/users');
      
      el.innerHTML = `
        <div class="section">
          <div class="section-header">
            <h2 class="section-title mb-0">Users</h2>
            <button class="btn btn-primary" id="add-user-btn">Add User</button>
          </div>
          
          <div class="card">
            <div class="table-container">
              <table class="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>2FA</th>
                    <th>Account Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${list.map(u => renderUserRow(u)).join('')}
                </tbody>
              </table>
            </div>
          </div>
          
          <div id="message" class="alert alert-success hidden"></div>
        </div>`;
      
      // Handle button clicks and toggle changes
      el.addEventListener('click', async (ev) => {
        const target = /** @type {HTMLElement} */ (ev.target);
        const btn = target.closest('button[data-action]');
        if (!btn) return;
        
        const action = /** @type {UserAction} */ (btn.getAttribute('data-action'));
        const apiMethod = /** @type {HttpMethod} */ (btn.getAttribute('data-method'));
        const userId = btn.getAttribute('data-id');
        const messageEl = /** @type {HTMLElement} */ (el.querySelector('#message'));
        
        if (!userId || !messageEl) return;
        
        /** @type {Record<UserAction, string>} */
        const actionMap = {
          enable: `/admin/users/${userId}/enable`,
          disable: `/admin/users/${userId}/disable`,
          enforce2fa: `/admin/users/${userId}/enforce-2fa`,
          unenforce2fa: `/admin/users/${userId}/unenforce-2fa`,
          delete: `/admin/users/${userId}/delete`
        };
        
        try {
          const res = await api(actionMap[action], { method: apiMethod });
          
          messageEl.textContent = 'Action completed successfully!';
          messageEl.className = 'alert alert-success';
          messageEl.classList.remove('hidden');

          // Update CSRF token if returned from backend
          if (res?.csrfToken) {
            setCsrfToken(res.csrfToken);
          }
          
          // Reload view
          setTimeout(() => {
            location.reload();
          }, 1000);
        } catch (err) {
          const error = /** @type {Error} */ (err);
          messageEl.textContent = error.message || 'An error occurred';
          messageEl.className = 'alert alert-danger';
          messageEl.classList.remove('hidden');
        }
      });
      
      // Handle toggle switches
      el.addEventListener('change', async (ev) => {
        const target = /** @type {HTMLInputElement} */ (ev.target);
        if (target.type !== 'checkbox') return;
        
        const action = target.getAttribute('data-action');
        const userId = target.getAttribute('data-id');
        const messageEl = /** @type {HTMLElement} */ (el.querySelector('#message'));
        
        if (!userId || !messageEl || !action) return;
        
        // Determine the API endpoint based on toggle state
        let endpoint = '';
        let method = /** @type {HttpMethod} */ ('PUT');
        
        if (action === 'toggle-status') {
          const currentStatus = target.getAttribute('data-current-status');
          // If currently active (checked), user is disabling -> call disable
          // If currently disabled (unchecked), user is enabling -> call enable
          endpoint = target.checked 
            ? `/admin/users/${userId}/enable`
            : `/admin/users/${userId}/disable`;
        } else if (action === 'toggle-2fa-enforce') {
          const current2FA = target.getAttribute('data-current-2fa');
          // If currently enforced (checked), user is unenforcing -> call unenforce
          // If currently unenforced (unchecked), user is enforcing -> call enforce
          endpoint = target.checked
            ? `/admin/users/${userId}/enforce-2fa`
            : `/admin/users/${userId}/unenforce-2fa`;
        }
        
        if (!endpoint) return;
        
        // Disable the toggle while processing
        target.disabled = true;
        
        try {
          const res = await api(endpoint, { method });
          
          messageEl.textContent = 'Action completed successfully!';
          messageEl.className = 'alert alert-success';
          messageEl.classList.remove('hidden');

          // Update CSRF token if returned from backend
          if (res?.csrfToken) {
            setCsrfToken(res.csrfToken);
          }
          
          // Reload view to reflect changes
          setTimeout(() => {
            location.reload();
          }, 1000);
        } catch (err) {
          const error = /** @type {Error} */ (err);
          messageEl.textContent = error.message || 'An error occurred';
          messageEl.className = 'alert alert-danger';
          messageEl.classList.remove('hidden');
          
          // Revert toggle state on error
          target.checked = !target.checked;
          target.disabled = false;
        }
      });
      
    } catch (err) {
      const error = /** @type {Error} */ (err);
      
      // If unauthorized, redirect to login
      if (error.message.includes('Unauthorized') || error.message.includes('401') || error.message.includes('403')) {
        location.hash = '/login';
        return;
      }
      
      el.innerHTML = `
        <div class="section">
          <div class="alert alert-danger">
            <strong>Error:</strong> ${escapeHtml(error.message || 'Failed to load users')}
          </div>
        </div>`;
    }
  });
}

/**
 * Renders a table row for a user
 * @param {AdminUser} user - User data
 * @returns {string} HTML string for table row
 */
function renderUserRow(user) {
  const isActive = !user.lockoutEnd;
  const is2FAEnforced = user.twoFactorEnforced === 1;
  
  return `
    <tr>
      <td><strong>${escapeHtml(user.userName)}</strong></td>
      <td>${escapeHtml(user.email || '')}</td>
      <td>
        ${user.twoFactorEnabled 
          ? '<span class="badge badge-success">Enabled</span>' 
          : '<span class="badge">Disabled</span>'}
      </td>
      <td>
        <div class="toggle-wrapper">
          <label class="toggle-switch">
            <input 
              type="checkbox" 
              ${isActive ? 'checked' : ''}
              data-action="toggle-status"
              data-id="${user.id}"
              data-current-status="${isActive ? 'active' : 'disabled'}">
            <span class="toggle-slider"></span>
          </label>
          <span class="toggle-label">${isActive ? 'Active' : 'Disabled'}</span>
        </div>
      </td>
      <td>
        <div style="display: flex; align-items: center; gap: var(--space-md);">
          <div class="toggle-wrapper">
            <label class="toggle-switch">
              <input 
                type="checkbox" 
                ${is2FAEnforced ? 'checked' : ''}
                data-action="toggle-2fa-enforce"
                data-id="${user.id}"
                data-current-2fa="${is2FAEnforced ? 'enforced' : 'unenforced'}">
              <span class="toggle-slider"></span>
            </label>
            <span class="toggle-label">Enforce 2FA</span>
          </div>
          <button class="btn btn-sm btn-danger" data-action="delete" data-method="DELETE" data-id="${user.id}">Delete</button>
        </div>
      </td>
    </tr>
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
