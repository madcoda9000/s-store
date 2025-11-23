// /wwwroot/js/views/admin-users.js

import { api, setCsrfToken } from '../api.js';
import { updateHeader } from '../header.js';
import { icon, Icons } from '../icons.js';
import { hasRole, renderAccessDenied } from '../auth-utils.js';
import { t } from '../i18n.js';
import { showToast } from '../toast.js';

/**
 * User action types
 * @typedef {'enable'|'disable'|'enforce2fa'|'unenforce2fa'|'delete'|'edit'} UserAction
 */

/**
 * State management for admin users view
 */
const state = {
  currentPage: 1,
  pageSize: 10,
  sortBy: 'userName',
  sortOrder: 'asc',
  searchQuery: ''
};

/** @type {(e: Event) => void | null} */
let usersClickHandler = null;

/**
 * Registers the admin users route
 * @param {RouteRegisterFn} route - Route registration function
 * @returns {void}
 */
export function registerAdminUsers(route) {
  route('/admin/users', async el => {
    try {
      // Reset state on route entry
      state.currentPage = 1;
      state.pageSize = 10;
      state.sortBy = 'userName';
      state.sortOrder = 'asc';
      state.searchQuery = '';

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
      
      // Render initial view with loading state
      el.innerHTML = renderView(null, true);

      // Setup event handlers ONCE - before loading data
      setupEventHandlers(el);

      // Update clear button visibility
      updateClearButton(el);

      // Load users
      await loadUsers(el);
      
    } catch (err) {
      const error = /** @type {Error} */ (err);
      
      // If unauthorized, redirect to login
      if (error.message.includes('Unauthorized') || error.message.includes('401') || error.message.includes('403')) {
        location.hash = '/login';
        return;
      }
      
      el.innerHTML = renderError(error.message);
    }
  });
}

/**
 * Loads users from the API
 * @param {HTMLElement} el - Container element
 * @returns {Promise<void>}
 */
async function loadUsers(el) {
  try {
    // Show loading state
    const container = el.querySelector('#users-container');
    if (container) {
      container.innerHTML = `<div class="log-loading"><div class="spinner"></div><p>${t('admin.users.loadingUsers') || 'Loading users...'}</p></div>`;
    }

    // Update filter inputs
    updateFilterInputs(el);

    // Fetch users list
    /** @type {AdminUser[]} */
    const list = await api('/admin/users');

    // Filter users client-side
    let filteredUsers = list;
    
    if (state.searchQuery) {
      const query = state.searchQuery.toLowerCase();
      filteredUsers = filteredUsers.filter(user =>
        user.userName.toLowerCase().includes(query) ||
        (user.email && user.email.toLowerCase().includes(query))
      );
    }

    // Sort users
    filteredUsers = sortUsers(filteredUsers, state.sortBy, state.sortOrder);

    // Apply pagination
    const total = filteredUsers.length;
    const totalPages = Math.ceil(total / state.pageSize);
    const startIndex = (state.currentPage - 1) * state.pageSize;
    const endIndex = startIndex + state.pageSize;
    const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

    // Update ONLY the users container
    if (container) {
      container.innerHTML = renderUsersTable({
        users: paginatedUsers,
        pagination: {
          page: state.currentPage,
          size: state.pageSize,
          total: total,
          totalPages: totalPages
        }
      });
    }

  } catch (err) {
    const error = /** @type {Error} */ (err);
    const container = el.querySelector('#users-container');
    if (container) {
      container.innerHTML = `<div class="log-error"><div class="alert alert-danger">${escapeHtml(error.message)}</div></div>`;
    }
  }
}

/**
 * Updates filter input values from state
 * @param {HTMLElement} el - Container element
 * @returns {void}
 */
function updateFilterInputs(el) {
  const searchInput = /** @type {HTMLInputElement|null} */ (el.querySelector('#user-search'));
  if (searchInput) {
    searchInput.value = state.searchQuery;
  }

  const pageSizeSelect = /** @type {HTMLSelectElement|null} */ (el.querySelector('#page-size'));
  if (pageSizeSelect) {
    pageSizeSelect.value = state.pageSize.toString();
  }

  // Update clear button visibility
  updateClearButton(el);
}

/**
 * Updates the visibility of the clear search button
 * @param {HTMLElement} el - Container element
 * @returns {void}
 */
function updateClearButton(el) {
  const searchBar = el.querySelector('.log-search-bar');
  if (!searchBar) return;

  let clearBtn = /** @type {HTMLButtonElement|null} */ (searchBar.querySelector('#clear-search-btn'));

  if (state.searchQuery) {
    // Show clear button
    if (!clearBtn) {
      clearBtn = document.createElement('button');
      clearBtn.id = 'clear-search-btn';
      clearBtn.className = 'btn btn-secondary';
      clearBtn.type = 'button';
      clearBtn.innerHTML = `${icon(Icons.X, 'icon')} ${t('admin.users.clearFilters') || 'Clear'}`;
      searchBar.appendChild(clearBtn);
    }
  } else {
    // Hide clear button
    if (clearBtn) {
      clearBtn.remove();
    }
  }
}

/**
 * Sorts users by specified column and order
 * @param {AdminUser[]} users - Users to sort
 * @param {string} sortBy - Column to sort by
 * @param {string} sortOrder - Sort order (asc or desc)
 * @returns {AdminUser[]} Sorted users
 */
function sortUsers(users, sortBy, sortOrder) {
  return [...users].sort((a, b) => {
    let aVal = a[sortBy];
    let bVal = b[sortBy];

    // Handle null/undefined values
    if (aVal === null || aVal === undefined) aVal = '';
    if (bVal === null || bVal === undefined) bVal = '';

    // Convert to lowercase for string comparison
    if (typeof aVal === 'string') aVal = aVal.toLowerCase();
    if (typeof bVal === 'string') bVal = bVal.toLowerCase();

    if (sortOrder === 'asc') {
      return aVal > bVal ? 1 : -1;
    } else {
      return aVal < bVal ? 1 : -1;
    }
  });
}

/**
 * Renders the main view
 * @param {Object|null} data - User data
 * @param {boolean} loading - Whether data is loading
 * @returns {string} HTML string
 */
function renderView(data, loading) {
  return `
    <div class="section">
      <div class="section-header">
        <h2 class="section-title mb-0">${t('admin.users.title') || 'Users'}</h2>
        <button class="btn btn-primary" id="add-user-btn">${icon(Icons.USER_PLUS, 'icon')} ${t('admin.users.addUser') || 'Add User'}</button>
      </div>

      ${renderFilters()}

      <div id="users-container">
        ${loading ? renderLoading() : data ? renderUsersTable(data) : ''}
      </div>
    </div>
  `;
}

/**
 * Renders filter controls
 * @returns {string} HTML string
 */
function renderFilters() {
  return `
    <div class="users-filters-layout">
      <div class="log-search-bar">
        <input
          type="text"
          id="user-search"
          class="input"
          placeholder="${t('admin.users.searchPlaceholder') || 'Search by username or email...'}"
          value="${escapeHtml(state.searchQuery)}"
        />
        <button id="search-btn" class="btn btn-primary" type="button">
          ${icon(Icons.SEARCH, 'icon')} ${t('admin.users.search') || 'Search'}
        </button>
      </div>

      <div class="log-filters">
        <div class="page-size-selector">
          <label for="page-size">${t('admin.users.showPerPage') || 'Show'}</label>
          <select id="page-size">
            <option value="10" ${state.pageSize === 10 ? 'selected' : ''}>10</option>
            <option value="30" ${state.pageSize === 30 ? 'selected' : ''}>30</option>
            <option value="50" ${state.pageSize === 50 ? 'selected' : ''}>50</option>
            <option value="100" ${state.pageSize === 100 ? 'selected' : ''}>100</option>
          </select>
          <span>${t('admin.users.perPage') || 'per page'}</span>
        </div>
      </div>
    </div>
  `;
}

/**
 * Renders the users table
 * @param {Object} data - User data with pagination
 * @returns {string} HTML string
 */
function renderUsersTable(data) {
  if (!data.users || data.users.length === 0) {
    return `
      <div class="log-empty-state">
        ${icon(Icons.USERS, 'icon')}
        <p>${t('admin.users.noUsersFound') || 'No users found'}</p>
      </div>
    `;
  }

  return `
    <div class="log-table-container">
      <table class="log-table log-table--dense log-table--users" id="users-table">
        <thead>
          <tr>
            <th class="sortable ${state.sortBy === 'userName' ? 'sort-' + state.sortOrder : ''}" data-sort="userName">
              ${t('admin.users.username') || 'Username'}
            </th>
            <th class="sortable ${state.sortBy === 'email' ? 'sort-' + state.sortOrder : ''}" data-sort="email">
              ${t('admin.users.email') || 'Email'}
            </th>
            <th>${t('admin.users.twoFactor') || '2FA'}</th>
            <th>${t('admin.users.accountStatus') || 'Account Status'}</th>
            <th>${t('admin.users.twoFactorEnforced') || '2fa Enforced'}</th>
            <th>${t('admin.users.actions') || 'Actions'}</th>
          </tr>
        </thead>
        <tbody>
          ${data.users.map(u => renderUserRow(u)).join('')}
        </tbody>
      </table>
    </div>

    ${renderPagination(data.pagination)}
  `;
}

/**
 * Renders pagination controls
 * @param {Object} pagination - Pagination data
 * @returns {string} HTML string
 */
function renderPagination(pagination) {
  if (!pagination || pagination.totalPages <= 1) return '';

  const { page, totalPages, total } = pagination;
  const startItem = (page - 1) * state.pageSize + 1;
  const endItem = Math.min(page * state.pageSize, total);

  // Calculate page numbers to show
  const pages = [];
  const maxPages = 7; // Show max 7 page buttons

  if (totalPages <= maxPages) {
    // Show all pages
    for (let i = 1; i <= totalPages; i++) {
      pages.push(i);
    }
  } else {
    // Show pages with ellipsis
    if (page <= 4) {
      // Near start
      for (let i = 1; i <= 5; i++) pages.push(i);
      pages.push('...');
      pages.push(totalPages);
    } else if (page >= totalPages - 3) {
      // Near end
      pages.push(1);
      pages.push('...');
      for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
    } else {
      // Middle
      pages.push(1);
      pages.push('...');
      for (let i = page - 1; i <= page + 1; i++) pages.push(i);
      pages.push('...');
      pages.push(totalPages);
    }
  }

  return `
    <div class="pagination">
      <div class="pagination-info">
        ${t('admin.users.showing', { start: startItem, end: endItem, total: total }) || `Showing ${startItem} to ${endItem} of ${total} users`}
      </div>

      <div class="pagination-controls">
        <button
          class="pagination-btn"
          data-page="${page - 1}"
          ${page === 1 ? 'disabled' : ''}
        >
          ${icon(Icons.CHEVRON_LEFT, 'icon')}
        </button>

        ${pages.map(p => {
          if (p === '...') {
            return '<span class="pagination-ellipsis">...</span>';
          }
          return `
            <button
              class="pagination-btn ${p === page ? 'active' : ''} ${Math.abs(p - page) > 2 ? 'hide-mobile' : ''}"
              data-page="${p}"
              ${p === page ? 'disabled' : ''}
            >
              ${p}
            </button>
          `;
        }).join('')}

        <button
          class="pagination-btn"
          data-page="${page + 1}"
          ${page === totalPages ? 'disabled' : ''}
        >
          ${icon(Icons.CHEVRON_RIGHT, 'icon')}
        </button>
      </div>
    </div>
  `;
}

/**
 * Renders loading state
 * @returns {string} HTML string
 */
function renderLoading() {
  return `
    <div class="log-loading">
      <div class="spinner"></div>
      <p>${t('admin.users.loadingUsers') || 'Loading users...'}</p>
    </div>
  `;
}

/**
 * Renders error state
 * @param {string} message - Error message
 * @returns {string} HTML string
 */
function renderError(message) {
  return `
    <div class="section">
      <div class="log-error">
        <div class="alert alert-danger">
          <strong>Error:</strong> ${escapeHtml(message)}
        </div>
      </div>
    </div>
  `;
}

/**
 * Opens a confirmation modal before deleting a user
 * @param {string} userId - User ID to delete
 * @param {string} userName - Username to display
 * @param {HTMLElement} el - Container element
 * @returns {void}
 */
function openDeleteConfirmModal(userId, userName, el) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-overlay"></div>
    <div class="modal-content">
      <div class="modal-header">
        <h3>${icon(Icons.ALERT_TRIANGLE, 'icon')} ${t('admin.users.deleteModal.title') || 'Delete User'}</h3>
        <button class="modal-close" aria-label="Close">
          ${icon(Icons.X, 'icon')}
        </button>
      </div>
      <div class="modal-body">
        <div class="alert alert-danger">
          <strong>${t('common.warning') || 'Warning'}:</strong> ${t('admin.users.deleteModal.warning') || 'This action cannot be undone!'}
        </div>
        
        <p>${t('admin.users.deleteModal.message') || 'Are you sure you want to delete the user'} <strong>${escapeHtml(userName)}</strong>?</p>
        
        <div class="button-group">
          <button type="button" class="btn btn-danger" id="confirm-delete-btn">
            ${icon(Icons.TRASH, 'icon')} ${t('admin.users.deleteModal.confirm') || 'Yes, Delete User'}
          </button>
          <button type="button" class="btn btn-secondary modal-cancel">
            ${icon(Icons.X, 'icon')} ${t('admin.users.deleteModal.cancel') || 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Remember and disable body scroll while modal is open
  const previousBodyOverflow = document.body.style.overflow;
  document.body.dataset.userModalPrevOverflow = previousBodyOverflow;
  document.body.style.overflow = 'hidden';

  // Setup modal event handlers
  const closeBtn = modal.querySelector('.modal-close');
  const cancelBtn = modal.querySelector('.modal-cancel');
  const overlay = modal.querySelector('.modal-overlay');
  const confirmBtn = /** @type {HTMLButtonElement|null} */ (modal.querySelector('#confirm-delete-btn'));

  const closeModal = () => {
    modal.remove();
  };

  closeBtn?.addEventListener('click', closeModal);
  cancelBtn?.addEventListener('click', closeModal);
  
  // Only close when clicking directly on the overlay
  overlay?.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeModal();
    }
  });

  // Handle delete confirmation
  confirmBtn?.addEventListener('click', async () => {
    if (!confirmBtn) return;
    
    // Disable button during deletion
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = `<div class="spinner spinner-sm"></div> ${t('admin.users.deleteModal.deleting') || 'Deleting...'}`;

    try {
      const res = await api(`/admin/users/${userId}/delete`, { method: 'DELETE' });
      
      showToast({
        type: 'success',
        title: t('common.success') || 'Success',
        message: t('admin.users.deleteModal.success') || 'User deleted successfully!'
      });

      // Update CSRF token if returned from backend
      if (res?.csrfToken) {
        setCsrfToken(res.csrfToken);
      }
      
      // Close modal
      closeModal();
      
      // Refresh the users list
      await loadUsers(el);
    } catch (err) {
      const error = /** @type {Error} */ (err);
      showToast({
        type: 'error',
        title: t('common.error') || 'Error',
        message: error.message || t('admin.users.deleteModal.failed') || 'Failed to delete user'
      });
      
      // Re-enable button
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = `${icon(Icons.TRASH, 'icon')} ${t('admin.users.deleteModal.confirm') || 'Yes, Delete User'}`;
    }
  });
}

/**
 * Sets up event handlers (called only once)
 * @param {HTMLElement} el - Container element
 * @returns {void}
 */
function setupEventHandlers(el) {
  if (usersClickHandler) {
    el.removeEventListener('click', usersClickHandler);
  }

  usersClickHandler = async function handleClick(e) {
    if (!location.hash.startsWith('#/admin/users')) {
      return;
    }

    const target = /** @type {HTMLElement} */ (e.target);

    // Add user button
    if (target.closest('#add-user-btn')) {
      await openUserModal(el, null);
      return;
    }

    // Search button
    if (target.closest('#search-btn')) {
      const searchInput = /** @type {HTMLInputElement|null} */ (el.querySelector('#user-search'));
      if (searchInput) {
        state.searchQuery = searchInput.value.trim();
        state.currentPage = 1;
        await loadUsers(el);
      }
      return;
    }

    // Clear filters button
    if (target.closest('#clear-search-btn')) {
      state.searchQuery = '';
      state.currentPage = 1;
      await loadUsers(el);
      return;
    }

    // Pagination buttons
    const paginationBtn = target.closest('.pagination-btn[data-page]');
    if (paginationBtn && !paginationBtn.hasAttribute('disabled')) {
      const page = parseInt(paginationBtn.getAttribute('data-page') || '1');
      state.currentPage = page;
      await loadUsers(el);
      return;
    }

    // Sortable headers
    const sortableHeader = target.closest('.sortable[data-sort]');
    if (sortableHeader) {
      const sortBy = sortableHeader.getAttribute('data-sort') || 'userName';
      if (state.sortBy === sortBy) {
        state.sortOrder = state.sortOrder === 'asc' ? 'desc' : 'asc';
      } else {
        state.sortBy = sortBy;
        state.sortOrder = 'asc';
      }
      await loadUsers(el);
      return;
    }

    // User action buttons
    const btn = target.closest('button[data-action]');
    if (!btn) return;
    
    const action = /** @type {UserAction} */ (btn.getAttribute('data-action'));
    const apiMethod = /** @type {HttpMethod} */ (btn.getAttribute('data-method'));
    const userId = btn.getAttribute('data-id');
    
    if (!userId) return;

    // Show edit modal for edit action
    if (action === 'edit') {
      await openUserModal(el, userId);
      return;
    }

    // Show confirmation modal for delete action
    if (action === 'delete') {
      const userName = btn.closest('tr')?.querySelector('td strong')?.textContent || 'this user';
      openDeleteConfirmModal(userId, userName, el);
      return;
    }
    
    /** @type {Record<UserAction, string>} */
    const actionMap = {
      enable: `/admin/users/${userId}/enable`,
      disable: `/admin/users/${userId}/disable`,
      enforce2fa: `/admin/users/${userId}/enforce-2fa`,
      unenforce2fa: `/admin/users/${userId}/unenforce-2fa`,
      delete: `/admin/users/${userId}/delete`,
      edit: `/admin/users/${userId}` // Not used in API call, handled separately
    };
    
    try {
      const res = await api(actionMap[action], { method: apiMethod });
      
      showToast({
        type: 'success',
        title: t('common.success') || 'Success',
        message: t('admin.users.actionSuccess') || 'Action completed successfully!'
      });

      // Update CSRF token if returned from backend
      if (res?.csrfToken) {
        setCsrfToken(res.csrfToken);
      }
      
      // Refresh the users list
      await loadUsers(el);
    } catch (err) {
      const error = /** @type {Error} */ (err);
      showToast({
        type: 'error',
        title: t('common.error') || 'Error',
        message: error.message || t('admin.users.actionFailed') || 'An error occurred'
      });
    }
  };

  // Use event delegation on the main container
  el.addEventListener('click', usersClickHandler);

  // Handle toggle switches
  el.addEventListener('change', async (ev) => {
    const target = /** @type {HTMLInputElement} */ (ev.target);
    if (target.type !== 'checkbox') return;
    
    const action = target.getAttribute('data-action');
    const userId = target.getAttribute('data-id');
    
    if (!userId || !action) return;
    
    // Determine the API endpoint based on toggle state
    let endpoint = '';
    let method = /** @type {HttpMethod} */ ('PUT');
    
    if (action === 'toggle-status') {
      endpoint = target.checked 
        ? `/admin/users/${userId}/enable`
        : `/admin/users/${userId}/disable`;
    } else if (action === 'toggle-2fa-enforce') {
      endpoint = target.checked
        ? `/admin/users/${userId}/enforce-2fa`
        : `/admin/users/${userId}/unenforce-2fa`;
    }
    
    if (!endpoint) return;
    
    // Disable the toggle while processing
    target.disabled = true;
    
    try {
      const res = await api(endpoint, { method });
      
      showToast({
        type: 'success',
        title: t('common.success') || 'Success',
        message: t('admin.users.statusUpdated') || 'User status updated successfully!'
      });

      // Update CSRF token if returned from backend
      if (res?.csrfToken) {
        setCsrfToken(res.csrfToken);
      }
      
      // Refresh the users list
      await loadUsers(el);
    } catch (err) {
      const error = /** @type {Error} */ (err);
      showToast({
        type: 'error',
        title: t('common.error') || 'Error',
        message: error.message || t('admin.users.updateFailed') || 'An error occurred'
      });
      
      // Revert toggle state on error
      target.checked = !target.checked;
      target.disabled = false;
    }
  });

  // Setup page size change listener
  const pageSizeSelect = /** @type {HTMLSelectElement|null} */ (el.querySelector('#page-size'));
  if (pageSizeSelect) {
    pageSizeSelect.addEventListener('change', async () => {
      state.pageSize = parseInt(pageSizeSelect.value);
      state.currentPage = 1;
      await loadUsers(el);
    });
  }
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
      <td data-label="${t('admin.users.username') || 'Username'}"><strong>${escapeHtml(user.userName)}</strong></td>
      <td data-label="${t('admin.users.email') || 'Email'}">${escapeHtml(user.email || '')}</td>
      <td data-label="${t('admin.users.twoFactor') || '2FA'}">
        ${user.twoFactorEnabled 
          ? `<span class="icon-badge-success">${icon(Icons.CHECK_CIRCLE_FILLED, 'icon icon-lg')}</span>` 
          : `<span class="icon-badge-danger">${icon(Icons.CIRCLE_X_FILLED, 'icon icon-lg')}</span>`}
      </td>
      <td data-label="${t('admin.users.accountStatus') || 'Account Status'}">
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
        </div>
      </td>
      <td data-label="${t('admin.users.twoFactorEnforced') || '2FA Enforced'}">
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
          </div>
      </td>
      <td data-label="${t('admin.users.actions') || 'Actions'}">
        <div class="action-buttons">          
          <button class="btn btn-sm btn-danger" data-action="delete" data-method="DELETE" data-id="${user.id}">${icon(Icons.TRASH, 'icon')}</button>
          <button class="btn btn-sm btn-primary" data-action="edit" data-method="GET" data-id="${user.id}">${icon(Icons.EDIT, 'icon')}</button>
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

/**
 * Opens the create/edit user modal
 * @param {HTMLElement} el - Container element
 * @param {string|null} userId - User ID for editing, null for creating
 * @returns {Promise<void>}
 */
async function openUserModal(el, userId = null) {
  const isEdit = userId !== null;
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.id = 'user-modal';

  // Show loading state initially
  modal.innerHTML = `
    <div class="modal-overlay"></div>
    <div class="modal-content">
      <div class="modal-header">
        <h3>${icon(Icons.USER, 'icon')} ${isEdit ? t('admin.users.createModal.editTitle') : t('admin.users.createModal.title')}</h3>
        <button class="modal-close" aria-label="Close">
          ${icon(Icons.X, 'icon')}
        </button>
      </div>
      <div class="modal-body">
        <div class="log-loading">
          <div class="spinner"></div>
          <p>${isEdit ? t('admin.users.createModal.loadingUser') : t('admin.users.createModal.loadingRoles')}</p>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Setup close handlers immediately
  const closeModal = () => {
    // Add closing class to allow CSS animation (mobile bottom sheet)
    modal.classList.add('closing');

    const content = modal.querySelector('.modal-content');

    const removeModal = () => {
      if (document.body.contains(modal)) {
        modal.remove();
      }

      // Restore body scroll state when modal closes
      const prevOverflow = document.body.dataset.userModalPrevOverflow;
      if (prevOverflow !== undefined) {
        document.body.style.overflow = prevOverflow;
        delete document.body.dataset.userModalPrevOverflow;
      } else {
        document.body.style.overflow = '';
      }
    };

    if (content) {
      const handleAnimationEnd = () => {
        content.removeEventListener('animationend', handleAnimationEnd);
        removeModal();
      };

      // If an animation is defined, wait for it to finish
      content.addEventListener('animationend', handleAnimationEnd);

      // Fallback: ensure removal even if animation doesn't fire
      setTimeout(removeModal, 250);
    } else {
      // Fallback: remove immediately
      removeModal();
    }
  };

  const closeBtn = modal.querySelector('.modal-close');
  const overlay = modal.querySelector('.modal-overlay');

  closeBtn?.addEventListener('click', closeModal);
  overlay?.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeModal();
    }
  });

  try {
    // Fetch available roles
    const roles = await api('/admin/roles');
    
    // Fetch user data if editing
    let userData = null;
    if (isEdit) {
      userData = await api(`/admin/users/details/${userId}`);
    }

    // Render the form
    const modalBody = modal.querySelector('.modal-body');
    if (modalBody) {
      modalBody.innerHTML = renderUserForm(roles, userData, isEdit);
    }

    // Setup form event handlers
    setupModalHandlers(modal, el, isEdit, userId, closeModal);

  } catch (err) {
    const error = /** @type {Error} */ (err);
    const modalBody = modal.querySelector('.modal-body');
    if (modalBody) {
      modalBody.innerHTML = `
        <div class="alert alert-danger">
          <strong>${t('common.error')}:</strong> ${escapeHtml(error.message)}
        </div>
      `;
    }
  }
}

/**
 * Renders the user creation/edit form
 * @param {Array} roles - Available roles
 * @param {Object|null} userData - User data for editing
 * @param {boolean} isEdit - Whether this is an edit operation
 * @returns {string} HTML string
 */
function renderUserForm(roles, userData, isEdit) {
  const userRoles = userData?.Roles || userData?.roles || [];
  
  return `
    <form class="form" id="user-form">
      <div class="form-group">
        <label class="label" for="user-username">${t('admin.users.createModal.username')}</label>
        <input
          type="text"
          id="user-username"
          class="input"
          placeholder="${t('admin.users.createModal.usernamePlaceholder')}"
          value="${userData ? escapeHtml(userData.UserName || userData.userName || '') : ''}"
          required
          minlength="3"
          maxlength="50"
          pattern="[a-zA-Z0-9._\\-]+"
        />
      </div>

      <div class="form-group">
        <label class="label" for="user-email">${t('admin.users.createModal.email')}</label>
        <input
          type="email"
          id="user-email"
          class="input"
          placeholder="${t('admin.users.createModal.emailPlaceholder')}"
          value="${userData ? escapeHtml(userData.Email || userData.email || '') : ''}"
          required
          maxlength="256"
        />
      </div>

      <div class="form-group">
        <label class="label" for="user-password">${isEdit ? t('admin.users.createModal.newPassword') : t('admin.users.createModal.password')}</label>
        <input
          type="password"
          id="user-password"
          class="input"
          placeholder="${isEdit ? t('admin.users.createModal.newPasswordPlaceholder') : t('admin.users.createModal.passwordPlaceholder')}"
          ${!isEdit ? 'required' : ''}
          minlength="12"
          maxlength="128"
        />
        ${isEdit ? `<span class="form-hint">${t('admin.users.createModal.newPasswordHint')}</span>` : ''}
      </div>

      <div class="form-group">
        <label class="label" for="user-firstname">${t('admin.users.createModal.firstName')} <span class="text-danger">*</span></label>
        <input
          type="text"
          id="user-firstname"
          class="input"
          placeholder="${t('admin.users.createModal.firstNamePlaceholder')}"
          value="${userData ? escapeHtml(userData.FirstName || userData.firstName || '') : ''}"
          required
          maxlength="100"
        />
      </div>

      <div class="form-group">
        <label class="label" for="user-lastname">${t('admin.users.createModal.lastName')} <span class="text-danger">*</span></label>
        <input
          type="text"
          id="user-lastname"
          class="input"
          placeholder="${t('admin.users.createModal.lastNamePlaceholder')}"
          value="${userData ? escapeHtml(userData.LastName || userData.lastName || '') : ''}"
          required
          maxlength="100"
        />
      </div>

      <div class="form-group">
        <label class="label">${t('admin.users.createModal.roles')} <span class="text-danger">*</span></label>
        <div class="roles-checkboxes">
          ${roles.map(role => {
            const roleName = role.Name || role.name || '';
            const isChecked = userRoles.includes(roleName);
            return `
              <label class="checkbox">
                <input
                  type="checkbox"
                  name="user-roles"
                  value="${escapeHtml(roleName)}"
                  ${isChecked ? 'checked' : ''}
                />
                <span>${escapeHtml(roleName)}</span>
              </label>
            `;
          }).join('')}
        </div>
        <span class="form-hint">${t('admin.users.createModal.rolesRequired')}</span>
      </div>

      <div class="form-group">
        <label class="checkbox">
          <input
            type="checkbox"
            id="user-2fa-enforced"
            ${userData?.TwoFactorEnforced === 1 ? 'checked' : ''}
          />
          <span>${t('admin.users.createModal.twoFactorEnforced')}</span>
        </label>
        <span class="form-hint">${t('admin.users.createModal.twoFactorEnforcedHint')}</span>
      </div>

      <div class="form-group">
        <label class="checkbox">
          <input
            type="checkbox"
            id="user-ldap-enabled"
            ${userData?.LdapLoginEnabled === 1 ? 'checked' : ''}
          />
          <span>${t('admin.users.createModal.ldapEnabled')}</span>
        </label>
        <span class="form-hint">${t('admin.users.createModal.ldapEnabledHint')}</span>
      </div>

      <div class="button-group">
        <button type="submit" class="btn btn-primary" id="submit-user-btn">
          ${icon(Icons.CHECK, 'icon')} ${isEdit ? t('admin.users.createModal.updateButton') : t('admin.users.createModal.createButton')}
        </button>
        <button type="button" class="btn btn-secondary modal-cancel">
          ${icon(Icons.X, 'icon')} ${t('admin.users.createModal.cancel')}
        </button>
      </div>
    </form>
  `;
}

/**
 * Sets up event handlers for the user modal
 * @param {HTMLElement} modal - Modal element
 * @param {HTMLElement} el - Container element
 * @param {boolean} isEdit - Whether this is an edit operation
 * @param {string|null} userId - User ID for editing
 * @param {() => void} closeModal - Function to close the modal
 * @returns {void}
 */
function setupModalHandlers(modal, el, isEdit, userId, closeModal) {
  const cancelBtn = modal.querySelector('.modal-cancel');
  const form = /** @type {HTMLFormElement|null} */ (modal.querySelector('#user-form'));
  const submitBtn = /** @type {HTMLButtonElement|null} */ (modal.querySelector('#submit-user-btn'));

  cancelBtn?.addEventListener('click', () => closeModal());

  // Handle form submission
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!submitBtn || !form) return;

    // Get form values
    const username = /** @type {HTMLInputElement} */ (form.querySelector('#user-username'))?.value.trim();
    const email = /** @type {HTMLInputElement} */ (form.querySelector('#user-email'))?.value.trim();
    const password = /** @type {HTMLInputElement} */ (form.querySelector('#user-password'))?.value;
    const firstName = /** @type {HTMLInputElement} */ (form.querySelector('#user-firstname'))?.value.trim();
    const lastName = /** @type {HTMLInputElement} */ (form.querySelector('#user-lastname'))?.value.trim();
    const twoFactorEnforced = /** @type {HTMLInputElement} */ (form.querySelector('#user-2fa-enforced'))?.checked || false;
    const ldapEnabled = /** @type {HTMLInputElement} */ (form.querySelector('#user-ldap-enabled'))?.checked || false;

    // Get selected roles
    const roleCheckboxes = /** @type {NodeListOf<HTMLInputElement>} */ (form.querySelectorAll('input[name="user-roles"]:checked'));
    const selectedRoles = Array.from(roleCheckboxes).map(cb => cb.value);

    // Validate required fields
    if (!firstName || firstName.length === 0) {
      showToast({
        type: 'error',
        title: t('common.error'),
        message: t('admin.users.createModal.firstName') + ' is required'
      });
      return;
    }

    if (!lastName || lastName.length === 0) {
      showToast({
        type: 'error',
        title: t('common.error'),
        message: t('admin.users.createModal.lastName') + ' is required'
      });
      return;
    }

    // Validate at least one role is selected
    if (selectedRoles.length === 0) {
      showToast({
        type: 'error',
        title: t('common.error'),
        message: t('admin.users.createModal.rolesRequired')
      });
      return;
    }

    // Validate password for create mode
    if (!isEdit && (!password || password.length < 12)) {
      showToast({
        type: 'error',
        title: t('common.error'),
        message: t('admin.users.createModal.passwordPlaceholder')
      });
      return;
    }

    // Disable button during submission
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<div class="spinner spinner-sm"></div> ${isEdit ? t('admin.users.createModal.updating') : t('admin.users.createModal.creating')}`;

    try {
      const endpoint = isEdit ? `/admin/users/${userId}/update-extended` : '/admin/users/create-extended';
      const method = isEdit ? 'PUT' : 'POST';

      const payload = {
        Username: username,
        Email: email,
        FirstName: firstName,
        LastName: lastName,
        TwoFactorEnforced: twoFactorEnforced,
        LdapLoginEnabled: ldapEnabled,
        Roles: selectedRoles
      };

      // Add password for create, or newPassword for edit if provided
      if (isEdit) {
        if (password && password.length >= 12) {
          payload.NewPassword = password;
        }
      } else {
        payload.Password = password;
      }

      const res = await api(endpoint, { 
        method,
        body: payload
      });

      showToast({
        type: 'success',
        title: t('common.success'),
        message: isEdit ? t('admin.users.createModal.updateSuccess') : t('admin.users.createModal.success')
      });

      // Update CSRF token if returned
      if (res?.csrfToken) {
        setCsrfToken(res.csrfToken);
      }

      // Close modal
      closeModal();

      // Refresh users list
      await loadUsers(el);

    } catch (err) {
      const error = /** @type {Error} */ (err);
      showToast({
        type: 'error',
        title: t('common.error'),
        message: error.message || (isEdit ? t('admin.users.createModal.updateFailed') : t('admin.users.createModal.failed'))
      });

      // Re-enable button
      submitBtn.disabled = false;
      submitBtn.innerHTML = `${icon(Icons.CHECK, 'icon')} ${isEdit ? t('admin.users.createModal.updateButton') : t('admin.users.createModal.createButton')}`;
    }
  });
}