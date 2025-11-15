// /wwwroot/js/views/audit-logs.js

import { api } from '../api.js';
import { updateHeader } from '../header.js';
import { icon, Icons } from '../icons.js';
import { t } from '../i18n.js';
import { hasRole, renderAccessDenied } from '../auth-utils.js';

/**
 * State management for audit logs view
 */
const state = {
  currentPage: 1,
  pageSize: 10,
  sortBy: 'timestamp',
  sortOrder: 'desc',
  searchQuery: '',
  fromDate: '',
  toDate: '',
  isInvestigator: false,
  decryptedLogs: new Map() // Map<logId, decryptedUser>
};

/** @type {(e: Event) => void | null} */
let auditClickHandler = null;

/**
 * Registers the audit logs route
 * @param {Function} route - Route registration function
 * @returns {void}
 */
export function registerAuditLogs(route) {
  route('/logs/audit', async (el) => {
    try {
      // Reset state on route entry
      state.currentPage = 1;
      state.pageSize = 10;
      state.sortBy = 'timestamp';
      state.sortOrder = 'desc';
      state.searchQuery = '';
      state.fromDate = '';
      state.toDate = '';

      state.decryptedLogs.clear();

      // Fetch current user
      const user = await api('/auth/me');
      updateHeader(user);

      // Check admin authorization
      if (!hasRole(user, 'Admin') && !hasRole(user, 'AuditInvestigator')) {
        el.innerHTML = renderAccessDenied(
          user,
          '/logs/audit',
          'Admin',
          t('errors.adminAccessRequired') || 'You need administrator privileges to access this page.'
        );
        return;
      }

      // Check if user is an AuditInvestigator
      state.isInvestigator = hasRole(user, 'AuditInvestigator');

      // Render initial view with loading state
      el.innerHTML = renderView(null, true);

      // Setup event handlers ONCE - before loading data
      setupEventHandlers(el);

      // Update clear button visibility
      updateClearButton(el);

      // Load logs
      await loadLogs(el);

    } catch (err) {
      const error = /** @type {Error} */ (err);

      if (error.message.includes('Unauthorized') || error.message.includes('401')) {
        location.hash = '/login';
        return;
      }

      el.innerHTML = renderError(error.message);
    }
  });
}

/**
 * Loads logs from the API
 * @param {HTMLElement} el - Container element
 * @returns {Promise<void>}
 */
async function loadLogs(el) {
  try {
    // Show loading state
    const container = el.querySelector('#logs-container');
    if (container) {
      container.innerHTML = `<div class="log-loading"><div class="spinner"></div><p>${t('admin.auditLogs.loadingLogs')}</p></div>`;
    }

    // Update filter inputs
    updateFilterInputs(el);

    // Build query parameters
    const params = new URLSearchParams({
      decrypt: 'false',
      limit: '1000' // Get all for client-side filtering
    });

    if (state.fromDate) {
      params.append('fromDate', new Date(state.fromDate).toISOString());
    }

    if (state.toDate) {
      params.append('toDate', new Date(state.toDate).toISOString());
    }

    // Fetch logs
    /** @type {AuditLogResponse} */
    const response = await api(`/admin/audit?${params.toString()}`);

    // Filter and sort logs client-side
    let filteredLogs = response.logs;
    
    if (state.searchQuery) {
      const query = state.searchQuery.toLowerCase();
      filteredLogs = filteredLogs.filter(log =>
        log.action.toLowerCase().includes(query) ||
        log.context.toLowerCase().includes(query) ||
        log.message.toLowerCase().includes(query) ||
        log.user.toLowerCase().includes(query)
      );
    }

    // Sort logs
    filteredLogs = sortLogs(filteredLogs, state.sortBy, state.sortOrder);

    // Apply pagination
    const total = filteredLogs.length;
    const totalPages = Math.ceil(total / state.pageSize);
    const startIndex = (state.currentPage - 1) * state.pageSize;
    const endIndex = startIndex + state.pageSize;
    const paginatedLogs = filteredLogs.slice(startIndex, endIndex);

    // Update ONLY the logs container
    if (container) {
      container.innerHTML = renderLogsTable({
        logs: paginatedLogs,
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
    const container = el.querySelector('#logs-container');
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
  const searchInput = /** @type {HTMLInputElement|null} */ (el.querySelector('#log-search'));
  if (searchInput) {
    searchInput.value = state.searchQuery;
  }

  const fromDateInput = /** @type {HTMLInputElement|null} */ (el.querySelector('#from-date'));
  if (fromDateInput) {
    fromDateInput.value = state.fromDate;
  }

  const toDateInput = /** @type {HTMLInputElement|null} */ (el.querySelector('#to-date'));
  if (toDateInput) {
    toDateInput.value = state.toDate;
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

  if (state.searchQuery || state.fromDate || state.toDate) {
    // Show clear button
    if (!clearBtn) {
      clearBtn = document.createElement('button');
      clearBtn.id = 'clear-search-btn';
      clearBtn.className = 'btn btn-secondary';
      clearBtn.type = 'button';
      clearBtn.innerHTML = `${icon(Icons.X, 'icon')} ${t('admin.auditLogs.clearFilters')}`;
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
 * Sorts logs by specified column and order
 * @param {AuditLogEntry[]} logs - Logs to sort
 * @param {string} sortBy - Column to sort by
 * @param {string} sortOrder - Sort order (asc or desc)
 * @returns {AuditLogEntry[]} Sorted logs
 */
function sortLogs(logs, sortBy, sortOrder) {
  return [...logs].sort((a, b) => {
    let aVal = a[sortBy];
    let bVal = b[sortBy];

    // Handle timestamp sorting
    if (sortBy === 'timestamp') {
      aVal = new Date(aVal).getTime();
      bVal = new Date(bVal).getTime();
    }

    if (sortOrder === 'asc') {
      return aVal > bVal ? 1 : -1;
    } else {
      return aVal < bVal ? 1 : -1;
    }
  });
}

/**
 * Renders the main view
 * @param {AuditLogResponse|null} data - Log data
 * @param {boolean} loading - Whether data is loading
 * @returns {string} HTML string
 */
function renderView(data, loading) {
  return `
    <div class="section">
      <div class="section-header">
        <h2 class="section-title mb-0">${icon(Icons.SHIELD, 'icon')} ${t('admin.auditLogs.title')}</h2>
      </div>

      ${renderFilters()}

      <div id="logs-container">
        ${loading ? renderLoading() : data ? renderLogsTable(data) : ''}
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
        id="log-search"
        class="input"
        placeholder="${t('admin.auditLogs.searchPlaceholder')}"
        value="${escapeHtml(state.searchQuery)}"
      />
      <button id="search-btn" class="btn btn-primary" type="button">
        ${icon(Icons.SEARCH, 'icon')} ${t('admin.auditLogs.search')}
      </button>
    </div>

    <div class="log-filters">
      <div class="form-group">
        <label for="from-date" class="label">${t('admin.auditLogs.fromDate')}</label>
        <input
          type="datetime-local"
          id="from-date"
          class="input"
          value="${state.fromDate}"
        />
      </div>

      <div class="form-group">
        <label for="to-date" class="label">${t('admin.auditLogs.toDate')}</label>
        <input
          type="datetime-local"
          id="to-date"
          class="input"
          value="${state.toDate}"
        />
      </div>

      <div class="form-group">
        <label class="label label-invisible">Apply</label>
        <button id="apply-filters-btn" class="btn btn-primary" type="button">
          ${t('admin.auditLogs.applyFilters')}
        </button>
      </div>
    </div>

    <div class="log-filters">
      <div class="page-size-selector">
        <label for="page-size">${t('admin.auditLogs.showPerPage')}</label>
        <select id="page-size">
          <option value="10" ${state.pageSize === 10 ? 'selected' : ''}>10</option>
          <option value="30" ${state.pageSize === 30 ? 'selected' : ''}>30</option>
          <option value="50" ${state.pageSize === 50 ? 'selected' : ''}>50</option>
          <option value="100" ${state.pageSize === 100 ? 'selected' : ''}>100</option>
        </select>
        <span>${t('admin.auditLogs.perPage')}</span>
      </div>
    </div>
  `;
}

/**
 * Renders the logs table
 * @param {Object} data - Log data with pagination
 * @returns {string} HTML string
 */
function renderLogsTable(data) {
  if (!data.logs || data.logs.length === 0) {
    return `
      <div class="log-empty-state">
        ${icon(Icons.SHIELD, 'icon')}
        <p>${t('admin.auditLogs.noLogsFound')}</p>
      </div>
    `;
  }

  return `
    <div class="log-table-container">
      <table class="log-table log-table--dense">
        <thead>
          <tr>
            <th class="sortable ${state.sortBy === 'timestamp' ? 'sort-' + state.sortOrder : ''}" data-sort="timestamp">
              ${t('admin.auditLogs.timestamp')}
            </th>
            <th class="sortable ${state.sortBy === 'user' ? 'sort-' + state.sortOrder : ''}" data-sort="user">
              ${t('admin.auditLogs.user')}
            </th>
            <th class="sortable ${state.sortBy === 'action' ? 'sort-' + state.sortOrder : ''}" data-sort="action">
              ${t('admin.auditLogs.action')}
            </th>
            <th class="sortable hide-mobile ${state.sortBy === 'context' ? 'sort-' + state.sortOrder : ''}" data-sort="context">
              ${t('admin.auditLogs.context')}
            </th>
            <th>${t('admin.auditLogs.message')}</th>
            ${state.isInvestigator ? `<th>${t('admin.auditLogs.actions')}</th>` : ''}
          </tr>
        </thead>
        <tbody>
          ${data.logs.map(log => renderLogRow(log)).join('')}
        </tbody>
      </table>
    </div>

    ${renderPagination(data.pagination)}
  `;
}

/**
 * Renders a single log row
 * @param {AuditLogEntry} log - Log entry
 * @returns {string} HTML string
 */
function renderLogRow(log) {
  // Check if this log has been decrypted
  const decryptedUser = state.decryptedLogs.get(log.id);

  return `
    <tr>
      <td class="log-cell-timestamp">${formatTimestamp(log.timestamp)}</td>
      <td class="log-cell-user">
        ${decryptedUser 
          ? `<span class="user-decrypted">${escapeHtml(decryptedUser)}</span><br><span class="user-pseudonym-small text-muted">${escapeHtml(log.user)}</span>`
          : escapeHtml(log.user)
        }
      </td>
      <td class="log-cell-action">${escapeHtml(log.action)}</td>
      <td class="log-cell-context hide-mobile">${escapeHtml(log.context)}</td>
      <td class="log-cell-message">${escapeHtml(log.message)}</td>
      ${state.isInvestigator 
        ? `<td>
            ${log.hasEncryptedInfo 
              ? `<button class="btn btn-sm btn-warning decrypt-btn" data-log-id="${log.id}" data-log-action="${escapeHtml(log.action)}" data-log-timestamp="${escapeHtml(log.timestamp)}" data-log-user="${escapeHtml(log.user)}">
                  ${icon(Icons.KEY, 'icon')} ${t('admin.auditLogs.decrypt')}
                </button>`
              : `<span class="text-muted no-encrypted-data">${t('admin.auditLogs.noEncryptedData')}</span>`
            }
          </td>`
        : ''
      }
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
        ${t('admin.auditLogs.showing', { start: startItem, end: endItem, total: total })}
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
      <p>${t('admin.auditLogs.loadingLogs')}</p>
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
 * Opens the decrypt modal for a specific log entry
 * @param {number} logId - Log ID
 * @param {string} action - Log action
 * @param {string} timestamp - Log timestamp
 * @param {string} pseudonym - Pseudonymized user
 * @returns {void}
 */
function openDecryptModal(logId, action, timestamp, pseudonym) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-overlay"></div>
    <div class="modal-content modal-content-wide">
      <div class="modal-header">
        <h3>${icon(Icons.UNLOCK, 'icon')} ${t('admin.auditLogs.decryptModal.title')}</h3>
        <button class="modal-close" aria-label="Close">
          ${icon(Icons.X, 'icon')}
        </button>
      </div>
      <div class="modal-body">
        <div class="alert alert-warning">
          <strong>Warning:</strong> ${t('admin.auditLogs.decryptModal.warning')}
        </div>

        <div class="decrypt-log-details">
          <p><strong>${t('admin.auditLogs.decryptModal.logId')}</strong> ${logId}</p>
          <p><strong>${t('admin.auditLogs.decryptModal.action')}</strong> ${escapeHtml(action)}</p>
          <p><strong>${t('admin.auditLogs.decryptModal.timestamp')}</strong> ${formatTimestamp(timestamp)}</p>
          <p><strong>${t('admin.auditLogs.decryptModal.pseudonym')}</strong> <code>${escapeHtml(pseudonym)}</code></p>
        </div>

        <form id="decrypt-form">
          <div class="form-group">
            <label for="justification" class="label">
              ${t('admin.auditLogs.decryptModal.justificationLabel')} <span class="decrypt-required-star">${t('admin.auditLogs.decryptModal.justificationRequired')}</span>
            </label>
            <textarea
              id="justification"
              class="textarea"
              required
              minlength="10"
              maxlength="500"
              placeholder="${t('admin.auditLogs.decryptModal.justificationPlaceholder')}"
            ></textarea>
            <p class="form-hint">${t('admin.auditLogs.decryptModal.justificationHint')}</p>
          </div>

          <div class="button-group">
            <button type="submit" class="btn btn-warning">
              ${icon(Icons.UNLOCK, 'icon')} ${t('admin.auditLogs.decryptModal.decryptButton')}
            </button>
            <button type="button" class="btn btn-secondary modal-cancel">
              ${t('admin.auditLogs.decryptModal.cancel')}
            </button>
          </div>

          <div id="decrypt-result"></div>
        </form>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Setup modal event handlers
  const closeBtn = modal.querySelector('.modal-close');
  const cancelBtn = modal.querySelector('.modal-cancel');
  const overlay = modal.querySelector('.modal-overlay');
  const form = /** @type {HTMLFormElement} */ (modal.querySelector('#decrypt-form'));
  const resultDiv = modal.querySelector('#decrypt-result');

  const closeModal = (e) => {
    e?.stopPropagation();
    modal.remove();
  };

  closeBtn?.addEventListener('click', closeModal);
  cancelBtn?.addEventListener('click', closeModal);
  
  // Only close when clicking directly on the overlay, not its children
  overlay?.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeModal(e);
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const justificationInput = /** @type {HTMLTextAreaElement} */ (form.querySelector('#justification'));
    const justification = justificationInput.value.trim();

    if (!justification || justification.length < 10) {
      if (resultDiv) {
        resultDiv.innerHTML = `<div class="alert alert-danger">${t('admin.auditLogs.decryptModal.justificationTooShort')}</div>`;
      }
      return;
    }

    // Disable form during submission
    const submitBtn = /** @type {HTMLButtonElement|null} */ (form.querySelector('button[type="submit"]'));
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<div class="spinner spinner-sm"></div> ${t('admin.auditLogs.decryptModal.decrypting')}`;
    }

    try {
      /** @type {DecryptLogResponse} */
      const result = await api('/admin/audit/decrypt', {
        method: 'POST',
        body: {
          logId: logId,
          justification: justification
        }
      });

      // Store decrypted user in state
      state.decryptedLogs.set(logId, result.decryptedUser);

      // Hide the entire form and warning, show only success result
      const modalBody = modal.querySelector('.modal-body');
      if (modalBody) {
        modalBody.innerHTML = `
          <div class="alert alert-success">
            <strong>${t('admin.auditLogs.decryptModal.success')}</strong>
          </div>
          
          <div class="decrypt-user-display">
            <p><strong>${t('admin.auditLogs.decryptModal.decryptedUser')}</strong></p>
            <p class="decrypt-user-name">${escapeHtml(result.decryptedUser)}</p>
          </div>

          <div class="decrypt-meta-info">
            <p><strong>${t('admin.auditLogs.decryptModal.decryptedBy')}</strong> ${escapeHtml(result.decryptedBy)}</p>
            <p><strong>${t('admin.auditLogs.decryptModal.decryptedAt')}</strong> ${new Date(result.decryptedAt).toLocaleString()}</p>
            <p><strong>${t('admin.auditLogs.decryptModal.justificationUsed')}</strong> ${escapeHtml(result.justification)}</p>
          </div>

          <button type="button" class="btn btn-primary modal-close-success">
            ${t('admin.auditLogs.decryptModal.close')}
          </button>
        `;

        const closeSuccessBtn = modalBody.querySelector('.modal-close-success');
        closeSuccessBtn?.addEventListener('click', () => {
          closeModal();
          // Reload logs to show decrypted user
          const mainEl = /** @type {HTMLElement|null} */ (document.querySelector('#app'));
          if (mainEl) {
            loadLogs(mainEl);
          }
        });
      }

    } catch (err) {
      const error = /** @type {Error} */ (err);
      if (resultDiv) {
        resultDiv.innerHTML = `<div class="alert alert-danger"><strong>${t('admin.auditLogs.decryptModal.failed')}</strong> ${escapeHtml(error.message)}</div>`;
      }

      // Re-enable form
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `${icon(Icons.UNLOCK, 'icon')} ${t('admin.auditLogs.decryptModal.decryptButton')}`;
      }
    }
  });
}

/**
 * Searches logs by pseudonym
 * @param {string} pseudonym - Pseudonym to search for
 * @param {HTMLElement} el - Container element
 * @returns {Promise<void>}
 */
async function searchByPseudonym(pseudonym, el) {
  try {
    // Show loading state
    const container = el.querySelector('#logs-container');
    if (container) {
      container.innerHTML = `<div class="log-loading"><div class="spinner"></div><p>${t('admin.auditLogs.loadingLogs')}</p></div>`;
    }

    // Fetch logs by pseudonym
    /** @type {{logs: AuditLogEntry[], count: number, pseudonym: string}} */
    const response = await api(`/admin/audit/by-pseudonym/${encodeURIComponent(pseudonym)}`);

    // Sort logs
    let logs = sortLogs(response.logs, state.sortBy, state.sortOrder);

    // Apply pagination
    const total = logs.length;
    const totalPages = Math.ceil(total / state.pageSize);
    const startIndex = (state.currentPage - 1) * state.pageSize;
    const endIndex = startIndex + state.pageSize;
    const paginatedLogs = logs.slice(startIndex, endIndex);

    // Update container
    if (container) {
      container.innerHTML = `
        <div class="alert alert-info mb-25">
          Found ${total} log(s) for pseudonym: <code>${escapeHtml(pseudonym)}</code>
          <button id="clear-pseudonym-search" class="btn btn-sm btn-secondary ml-10">
            Show All Logs
          </button>
        </div>
        ${renderLogsTable({
          logs: paginatedLogs,
          pagination: {
            page: state.currentPage,
            size: state.pageSize,
            total: total,
            totalPages: totalPages
          }
        })}
      `;
    }

  } catch (err) {
    const error = /** @type {Error} */ (err);
    const container = el.querySelector('#logs-container');
    if (container) {
      container.innerHTML = `<div class="log-error"><div class="alert alert-danger">${escapeHtml(error.message)}</div></div>`;
    }
  }
}

/**
 * Sets up event handlers (called only once)
 * @param {HTMLElement} el - Container element
 * @returns {void}
 */
function setupEventHandlers(el) {
  if (auditClickHandler) {
    el.removeEventListener('click', auditClickHandler);
  }

  auditClickHandler = function handleClick(e) {
    if (!location.hash.startsWith('#/logs/audit')) {
      return;
    }

    const target = /** @type {HTMLElement} */ (e.target);

    // Search button
    if (target.closest('#search-btn')) {
      const searchInput = /** @type {HTMLInputElement|null} */ (el.querySelector('#log-search'));
      if (searchInput) {
        state.searchQuery = searchInput.value.trim();
        state.currentPage = 1;
        loadLogs(el);
      }
      return;
    }

    // Apply filters button
    if (target.closest('#apply-filters-btn')) {
      const fromDateInput = /** @type {HTMLInputElement|null} */ (el.querySelector('#from-date'));
      const toDateInput = /** @type {HTMLInputElement|null} */ (el.querySelector('#to-date'));
      if (fromDateInput) state.fromDate = fromDateInput.value;
      if (toDateInput) state.toDate = toDateInput.value;
      state.currentPage = 1;
      loadLogs(el);
      return;
    }

    // Clear filters button
    if (target.closest('#clear-search-btn')) {
      state.searchQuery = '';
      state.categoryFilter = '';
      state.fromDate = '';
      state.toDate = '';
      state.currentPage = 1;
      loadLogs(el);
      return;
    }

    const decryptBtn = target.closest('.decrypt-btn');
    if (decryptBtn) {
      const logId = parseInt(decryptBtn.getAttribute('data-log-id') || '0');
      const action = decryptBtn.getAttribute('data-log-action') || '';
      const timestamp = decryptBtn.getAttribute('data-log-timestamp') || '';
      const user = decryptBtn.getAttribute('data-log-user') || '';
      if (logId) {
        openDecryptModal(logId, action, timestamp, user);
      }
      return;
    }

    const paginationBtn = target.closest('.pagination-btn[data-page]');
    if (paginationBtn && !paginationBtn.hasAttribute('disabled')) {
      const page = parseInt(paginationBtn.getAttribute('data-page') || '1');
      state.currentPage = page;
      loadLogs(el);
      return;
    }

    const sortableHeader = target.closest('.sortable[data-sort]');
    if (sortableHeader) {
      const sortBy = sortableHeader.getAttribute('data-sort') || 'timestamp';
      if (state.sortBy === sortBy) {
        state.sortOrder = state.sortOrder === 'asc' ? 'desc' : 'asc';
      } else {
        state.sortBy = sortBy;
        state.sortOrder = 'desc';
      }
      loadLogs(el);
      return;
    }
  };

  // Use event delegation on the main container
  el.addEventListener('click', auditClickHandler);

  // Setup page size change listener
  const pageSizeSelect = /** @type {HTMLSelectElement|null} */ (el.querySelector('#page-size'));
  if (pageSizeSelect) {
    pageSizeSelect.addEventListener('change', () => {
      state.pageSize = parseInt(pageSizeSelect.value);
      state.currentPage = 1;
      loadLogs(el);
    });
  }
}

/**
 * Formats timestamp for display
 * @param {string} timestamp - ISO timestamp
 * @returns {string} Formatted timestamp
 */
function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
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