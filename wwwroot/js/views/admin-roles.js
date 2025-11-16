// /wwwroot/js/views/admin-roles.js

import { api } from '../api.js';
import { updateHeader } from '../header.js';
import { icon, Icons } from '../icons.js';
import { hasRole, renderAccessDenied } from '../auth-utils.js';
import { t } from '../i18n.js';
import { showToast } from '../toast.js';

/**
 * State management for admin roles view
 */
const state = {
  currentPage: 1,
  pageSize: 10,
  sortBy: 'name',
  sortOrder: 'asc',
  searchQuery: ''
};

/** @type {(e: Event) => void | null} */
let rolesClickHandler = null;

/**
 * Registers the admin roles route
 * @param {RouteRegisterFn} route - Route registration function
 * @returns {void}
 */
export function registerAdminRoles(route) {
  route('/admin/roles', async el => {
    try {
      // Reset state on route entry
      state.currentPage = 1;
      state.pageSize = 10;
      state.sortBy = 'name';
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
          '/admin/roles',
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

      // Load roles
      await loadRoles(el);
      
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
 * Loads roles from the API
 * @param {HTMLElement} el - Container element
 * @returns {Promise<void>}
 */
async function loadRoles(el) {
  try {
    // Show loading state
    const container = el.querySelector('#roles-container');
    if (container) {
      container.innerHTML = `<div class="log-loading"><div class="spinner"></div><p>${t('admin.roles.loadingRoles') || 'Loading roles...'}</p></div>`;
    }

    // Update search input
    updateSearchInput(el);

    // Fetch all roles
    /** @type {Role[]} */
    const roles = await api('/admin/roles');

    // Filter roles based on search query
    let filteredRoles = roles;
    if (state.searchQuery) {
      const query = state.searchQuery.toLowerCase();
      filteredRoles = roles.filter(role =>
        role.name.toLowerCase().includes(query)
      );
    }

    // Sort roles
    filteredRoles = sortRoles(filteredRoles, state.sortBy, state.sortOrder);

    // Apply pagination
    const total = filteredRoles.length;
    const totalPages = Math.ceil(total / state.pageSize);
    const startIndex = (state.currentPage - 1) * state.pageSize;
    const endIndex = startIndex + state.pageSize;
    const paginatedRoles = filteredRoles.slice(startIndex, endIndex);

    // Update ONLY the roles container
    if (container) {
      container.innerHTML = renderRolesTable({
        roles: paginatedRoles,
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
    const container = el.querySelector('#roles-container');
    if (container) {
      container.innerHTML = `<div class="log-error"><div class="alert alert-danger">${escapeHtml(error.message)}</div></div>`;
    }
  }
}

/**
 * Updates search input value from state
 * @param {HTMLElement} el - Container element
 * @returns {void}
 */
function updateSearchInput(el) {
  const searchInput = /** @type {HTMLInputElement|null} */ (el.querySelector('#role-search'));
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
      clearBtn.innerHTML = `${icon(Icons.X, 'icon')} ${t('admin.roles.clearSearch') || 'Clear'}`;
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
 * Sorts roles by specified column and order
 * @param {Role[]} roles - Roles to sort
 * @param {string} sortBy - Column to sort by
 * @param {string} sortOrder - Sort order (asc or desc)
 * @returns {Role[]} Sorted roles
 */
function sortRoles(roles, sortBy, sortOrder) {
  return [...roles].sort((a, b) => {
    let aVal = a[sortBy];
    let bVal = b[sortBy];

    if (sortOrder === 'asc') {
      return aVal > bVal ? 1 : -1;
    } else {
      return aVal < bVal ? 1 : -1;
    }
  });
}

/**
 * Renders the main view
 * @param {Object|null} data - Roles data
 * @param {boolean} loading - Whether data is loading
 * @returns {string} HTML string
 */
function renderView(data, loading) {
  return `
    <div class="section">
      <div class="section-header">
        <h2 class="section-title mb-0">${icon(Icons.SHIELD, 'icon')} ${t('admin.roles.title') || 'Manage Roles'}</h2>
        <button class="btn btn-primary" id="create-role-btn">
          ${icon(Icons.PLUS, 'icon')} ${t('admin.roles.createRole') || 'Create Role'}
        </button>
      </div>

      ${renderFilters()}

      <div id="roles-container">
        ${loading ? renderLoading() : data ? renderRolesTable(data) : ''}
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
    <div class="log-search-bar">
      <input
        type="text"
        id="role-search"
        class="input"
        placeholder="${t('admin.roles.searchPlaceholder') || 'Search roles...'}"
        value="${escapeHtml(state.searchQuery)}"
      />
      <button id="search-btn" class="btn btn-primary" type="button">
        ${icon(Icons.SEARCH, 'icon')} ${t('admin.roles.search') || 'Search'}
      </button>
    </div>

    <div class="log-filters">
      <div class="page-size-selector">
        <label for="page-size">${t('admin.roles.showPerPage') || 'Show'}</label>
        <select id="page-size">
          <option value="10" ${state.pageSize === 10 ? 'selected' : ''}>10</option>
          <option value="30" ${state.pageSize === 30 ? 'selected' : ''}>30</option>
          <option value="50" ${state.pageSize === 50 ? 'selected' : ''}>50</option>
          <option value="100" ${state.pageSize === 100 ? 'selected' : ''}>100</option>
        </select>
        <span>${t('admin.roles.perPage') || 'per page'}</span>
      </div>
    </div>
  `;
}

/**
 * Renders the roles table
 * @param {Object} data - Roles data with pagination
 * @returns {string} HTML string
 */
function renderRolesTable(data) {
  if (!data.roles || data.roles.length === 0) {
    return `
      <div class="log-empty-state">
        ${icon(Icons.SHIELD, 'icon')}
        <p>${t('admin.roles.noRolesFound') || 'No roles found'}</p>
      </div>
    `;
  }

  return `
    <div class="log-table-container">
      <table class="log-table log-table--dense">
        <thead>
          <tr>
            <th class="sortable ${state.sortBy === 'name' ? 'sort-' + state.sortOrder : ''}" data-sort="name">
              ${t('admin.roles.name') || 'Role Name'}
            </th>
            <th class="sortable ${state.sortBy === 'normalizedName' ? 'sort-' + state.sortOrder : ''}" data-sort="normalizedName">
              ${t('admin.roles.normalizedName') || 'Normalized Name'}
            </th>
            <th>${t('admin.roles.actions') || 'Actions'}</th>
          </tr>
        </thead>
        <tbody>
          ${data.roles.map(role => renderRoleRow(role)).join('')}
        </tbody>
      </table>
    </div>

    ${renderPagination(data.pagination)}
  `;
}

/**
 * Renders a single role row
 * @param {Role} role - Role object
 * @returns {string} HTML string
 */
function renderRoleRow(role) {
  return `
    <tr>
      <td class="log-cell-user">${escapeHtml(role.name)}</td>
      <td class="log-cell-action">${escapeHtml(role.normalizedName)}</td>
      <td>
        <button class="btn btn-sm btn-danger delete-role-btn" data-role-id="${role.id}" data-role-name="${escapeHtml(role.name)}">
          ${icon(Icons.TRASH, 'icon')} ${t('admin.roles.delete') || 'Delete'}
        </button>
      </td>
    </tr>
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
        ${t('admin.roles.showing', { start: startItem, end: endItem, total: total }) || `Showing ${startItem} to ${endItem} of ${total} roles`}
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
      <p>${t('admin.roles.loadingRoles') || 'Loading roles...'}</p>
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
 * Opens the create role modal
 * @param {HTMLElement} el - Container element
 * @returns {void}
 */
function openCreateRoleModal(el) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-overlay"></div>
    <div class="modal-content modal-content-wide">
      <div class="modal-header">
        <h3>${icon(Icons.PLUS, 'icon')} ${t('admin.roles.createModal.title') || 'Create New Role'}</h3>
        <button class="modal-close" aria-label="Close">
          ${icon(Icons.X, 'icon')}
        </button>
      </div>
      <div class="modal-body">
        <form id="create-role-form">
          <div class="form-group">
            <label for="role-name" class="label">
              ${t('admin.roles.createModal.roleName') || 'Role Name'} <span class="text-danger">*</span>
            </label>
            <input
              type="text"
              id="role-name"
              class="input"
              required
              placeholder="${t('admin.roles.createModal.roleNamePlaceholder') || 'Enter role name...'}"
            />
            <p class="form-hint">${t('admin.roles.createModal.roleNameHint') || 'Enter a unique role name (e.g., Editor, Moderator)'}</p>
          </div>

          <div class="button-group">
            <button type="submit" class="btn btn-primary">
              ${icon(Icons.CHECK, 'icon')} ${t('admin.roles.createModal.createButton') || 'Create Role'}
            </button>
            <button type="button" class="btn btn-secondary modal-cancel">
              ${icon(Icons.X, 'icon')} ${t('common.cancel') || 'Cancel'}
            </button>
          </div>

          <div id="create-role-result"></div>
        </form>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const closeBtn = modal.querySelector('.modal-close');
  const cancelBtn = modal.querySelector('.modal-cancel');
  const overlay = modal.querySelector('.modal-overlay');
  const form = /** @type {HTMLFormElement} */ (modal.querySelector('#create-role-form'));
  const resultDiv = modal.querySelector('#create-role-result');

  const closeModal = () => modal.remove();

  closeBtn?.addEventListener('click', closeModal);
  cancelBtn?.addEventListener('click', closeModal);
  overlay?.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const roleNameInput = /** @type {HTMLInputElement} */ (form.querySelector('#role-name'));
    const roleName = roleNameInput.value.trim();

    if (!roleName) {
      if (resultDiv) {
        resultDiv.innerHTML = `<div class="alert alert-danger">${t('admin.roles.createModal.roleNameRequired') || 'Role name is required'}</div>`;
      }
      return;
    }

    // Disable form during submission
    const submitBtn = /** @type {HTMLButtonElement|null} */ (form.querySelector('button[type="submit"]'));
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<div class="spinner spinner-sm"></div> ${t('admin.roles.createModal.creating') || 'Creating...'}`;
    }

    try {
      await api('/admin/roles', {
        method: 'POST',
        body: { name: roleName }
      });

      showToast({
        type: 'success',
        title: t('admin.roles.createModal.successTitle') || 'Success',
        message: t('admin.roles.createModal.successMessage') || 'Role created successfully'
      });
      closeModal();
      await loadRoles(el);
    } catch (err) {
      const error = /** @type {Error} */ (err);
      if (resultDiv) {
        resultDiv.innerHTML = `<div class="alert alert-danger">${escapeHtml(error.message)}</div>`;
      }
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `${icon(Icons.CHECK, 'icon')} ${t('admin.roles.createModal.createButton') || 'Create Role'}`;
      }
    }
  });
}

/**
 * Opens a confirmation modal before deleting a role
 * @param {string} roleId - Role ID to delete
 * @param {string} roleName - Role name to display
 * @param {HTMLElement} el - Container element
 * @returns {void}
 */
function openDeleteConfirmModal(roleId, roleName, el) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-overlay"></div>
    <div class="modal-content">
      <div class="modal-header">
        <h3>${icon(Icons.ALERT_TRIANGLE, 'icon')} ${t('admin.roles.deleteModal.title') || 'Delete Role'}</h3>
        <button class="modal-close" aria-label="Close">
          ${icon(Icons.X, 'icon')}
        </button>
      </div>
      <div class="modal-body">
        <div class="alert alert-danger">
          <strong>${t('common.warning') || 'Warning'}:</strong> ${t('admin.roles.deleteModal.warning') || 'This action cannot be undone!'}
        </div>
        
        <p>${t('admin.roles.deleteModal.message') || 'Are you sure you want to delete the role'} <strong>${escapeHtml(roleName)}</strong>?</p>
        
        <div id="delete-role-check-result"></div>
        
        <div class="button-group">
          <button type="button" class="btn btn-danger" id="confirm-delete-btn">
            ${icon(Icons.TRASH, 'icon')} ${t('admin.roles.deleteModal.confirm') || 'Yes, Delete Role'}
          </button>
          <button type="button" class="btn btn-secondary modal-cancel">
            ${icon(Icons.X, 'icon')} ${t('admin.roles.deleteModal.cancel') || 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const closeBtn = modal.querySelector('.modal-close');
  const cancelBtn = modal.querySelector('.modal-cancel');
  const overlay = modal.querySelector('.modal-overlay');
  const confirmBtn = /** @type {HTMLButtonElement|null} */ (modal.querySelector('#confirm-delete-btn'));
  const checkResultDiv = modal.querySelector('#delete-role-check-result');

  const closeModal = () => modal.remove();

  closeBtn?.addEventListener('click', closeModal);
  cancelBtn?.addEventListener('click', closeModal);
  overlay?.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });

  // Check if role has users before allowing deletion
  (async () => {
    try {
      if (checkResultDiv) {
        checkResultDiv.innerHTML = `<div class="spinner spinner-sm"></div> ${t('admin.roles.deleteModal.checking') || 'Checking for users in this role...'}`;
      }

      const result = await api(`/admin/roles/${roleId}/check-users`);
      
      if (result.hasUsers) {
        if (checkResultDiv) {
          checkResultDiv.innerHTML = `<div class="alert alert-warning">${t('admin.roles.deleteModal.hasUsers', { count: result.userCount }) || `This role has ${result.userCount} user(s). Please remove all users from this role before deleting it.`}</div>`;
        }
        if (confirmBtn) {
          confirmBtn.disabled = true;
        }
      } else {
        if (checkResultDiv) {
          checkResultDiv.innerHTML = '';
        }
      }
    } catch (err) {
      const error = /** @type {Error} */ (err);
      if (checkResultDiv) {
        checkResultDiv.innerHTML = `<div class="alert alert-danger">${escapeHtml(error.message)}</div>`;
      }
      if (confirmBtn) {
        confirmBtn.disabled = true;
      }
    }
  })();

  confirmBtn?.addEventListener('click', async () => {
    if (confirmBtn.disabled) return;

    confirmBtn.disabled = true;
    confirmBtn.innerHTML = `<div class="spinner spinner-sm"></div> ${t('admin.roles.deleteModal.deleting') || 'Deleting...'}`;

    try {
      await api(`/admin/roles/${roleId}`, {
        method: 'DELETE'
      });

      showToast({
        type: 'success',
        title: t('admin.roles.deleteModal.successTitle') || 'Success',
        message: t('admin.roles.deleteModal.successMessage') || 'Role deleted successfully'
      });
      closeModal();
      await loadRoles(el);
    } catch (err) {
      const error = /** @type {Error} */ (err);
      if (checkResultDiv) {
        checkResultDiv.innerHTML = `<div class="alert alert-danger">${escapeHtml(error.message)}</div>`;
      }
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = `${icon(Icons.TRASH, 'icon')} ${t('admin.roles.deleteModal.confirm') || 'Yes, Delete Role'}`;
    }
  });
}

/**
 * Sets up event handlers (called only once)
 * @param {HTMLElement} el - Container element
 * @returns {void}
 */
function setupEventHandlers(el) {
  // Remove old handler if exists
  if (rolesClickHandler) {
    el.removeEventListener('click', rolesClickHandler);
  }

  // Create new handler
  rolesClickHandler = async (e) => {
    const target = /** @type {HTMLElement} */ (e.target);

    // Search button
    if (target.closest('#search-btn')) {
      const searchInput = /** @type {HTMLInputElement|null} */ (el.querySelector('#role-search'));
      if (searchInput) {
        state.searchQuery = searchInput.value.trim();
        state.currentPage = 1;
        await loadRoles(el);
      }
      return;
    }

    // Search on Enter key
    if (target.id === 'role-search') {
      const input = /** @type {HTMLInputElement} */ (target);
      input.addEventListener('keypress', async (e) => {
        if (e.key === 'Enter') {
          state.searchQuery = input.value.trim();
          state.currentPage = 1;
          await loadRoles(el);
        }
      });
      return;
    }

    // Clear search button
    if (target.closest('#clear-search-btn')) {
      state.searchQuery = '';
      state.currentPage = 1;
      await loadRoles(el);
      return;
    }

    // Page size change
    if (target.id === 'page-size') {
      const select = /** @type {HTMLSelectElement} */ (target);
      state.pageSize = parseInt(select.value);
      state.currentPage = 1;
      await loadRoles(el);
      return;
    }

    // Pagination
    if (target.closest('.pagination-btn')) {
      const btn = target.closest('.pagination-btn');
      const page = parseInt(btn?.getAttribute('data-page') || '1');
      if (!isNaN(page) && page !== state.currentPage) {
        state.currentPage = page;
        await loadRoles(el);
      }
      return;
    }

    // Sortable headers
    if (target.closest('.sortable')) {
      const th = target.closest('.sortable');
      const sortBy = th?.getAttribute('data-sort');
      if (sortBy) {
        if (state.sortBy === sortBy) {
          state.sortOrder = state.sortOrder === 'asc' ? 'desc' : 'asc';
        } else {
          state.sortBy = sortBy;
          state.sortOrder = 'asc';
        }
        await loadRoles(el);
      }
      return;
    }

    // Create role button
    if (target.closest('#create-role-btn')) {
      openCreateRoleModal(el);
      return;
    }

    // Delete role button
    if (target.closest('.delete-role-btn')) {
      const btn = target.closest('.delete-role-btn');
      const roleId = btn?.getAttribute('data-role-id');
      const roleName = btn?.getAttribute('data-role-name');
      if (roleId && roleName) {
        openDeleteConfirmModal(roleId, roleName, el);
      }
      return;
    }
  };

  // Add event listener
  el.addEventListener('click', rolesClickHandler);
}

/**
 * Escapes HTML to prevent XSS
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
