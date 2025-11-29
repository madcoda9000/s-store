// /wwwroot/js/views/mail-logs.js

import { api } from '../api.js';
import { updateHeader } from '../header.js';
import { icon, Icons } from '../icons.js';
import { t } from '../i18n.js';
import { hasRole, renderAccessDenied } from '../auth-utils.js';

/**
 * State management for mail logs view
 */
const state = {
  currentPage: 1,
  pageSize: 10,
  sortBy: 'timestamp',
  sortOrder: 'desc',
  searchQuery: '',
  fromDate: '',
  toDate: ''
};

/** @type {(e: Event) => void | null} */
let mailClickHandler = null;

/**
 * Registers the mail logs route
 * @param {Function} route - Route registration function
 * @returns {void}
 */
export function registerMailLogs(route) {
  route('/logs/mail', async (el) => {
    try {
      // Reset state on route entry
      state.currentPage = 1;
      state.pageSize = 10;
      state.sortBy = 'timestamp';
      state.sortOrder = 'desc';
      state.searchQuery = '';
      state.fromDate = '';
      state.toDate = '';

      // Fetch current user
      const user = await api('/auth/me');
      updateHeader(user);

      // Check admin authorization
      if (!hasRole(user, 'Admin')) {
        el.innerHTML = renderAccessDenied(
          user,
          '/logs/mail',
          'Admin',
          t('errors.adminAccessRequired')
        );
        return;
      }

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
      container.innerHTML = `<div class="log-loading"><div class="spinner"></div><p>${t('admin.mailLogs.loadingLogs')}</p></div>`;
    }

    // Update search input if it changed
    const searchInput = /** @type {HTMLInputElement|null} */ (el.querySelector('#log-search'));
    if (searchInput) {
      searchInput.value = state.searchQuery;
    }

    // Update page size selector
    const pageSizeSelect = /** @type {HTMLSelectElement|null} */ (el.querySelector('#page-size'));
    if (pageSizeSelect) {
      pageSizeSelect.value = state.pageSize.toString();
    }

    const fromDateInput = /** @type {HTMLInputElement|null} */ (el.querySelector('#from-date'));
    if (fromDateInput) {
      fromDateInput.value = state.fromDate;
    }

    const toDateInput = /** @type {HTMLInputElement|null} */ (el.querySelector('#to-date'));
    if (toDateInput) {
      toDateInput.value = state.toDate;
    }

    // Update clear button visibility
    updateClearButton(el);

    // Build query parameters
    const params = new URLSearchParams({
      page: state.currentPage.toString(),
      size: state.pageSize.toString()
    });

    if (state.fromDate) {
      params.append('fromDate', new Date(state.fromDate).toISOString());
    }

    if (state.toDate) {
      params.append('toDate', new Date(state.toDate).toISOString());
    }

    // Fetch logs
    /** @type {LogResponse} */
    const response = await api(`/log/mail?${params.toString()}`);

    // Filter and sort logs client-side if search is active
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

    // Update ONLY the logs container
    if (container) {
      container.innerHTML = renderLogsTable({ logs: filteredLogs, pagination: response.pagination });
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
 * Updates the visibility of the clear search button
 * @param {HTMLElement} el - Container element
 * @returns {void}
 */
function updateClearButton(el) {
  const searchBar = el.querySelector('.log-search-bar');
  if (!searchBar) return;

  let clearBtn = /** @type {HTMLButtonElement|null} */ (searchBar.querySelector('#clear-search-btn'));

  if (state.searchQuery) {
    if (!clearBtn) {
      clearBtn = document.createElement('button');
      clearBtn.id = 'clear-search-btn';
      clearBtn.className = 'btn btn-secondary';
      clearBtn.type = 'button';
      clearBtn.innerHTML = `${icon(Icons.X, 'icon')} ${t('admin.mailLogs.clear')}`;
      searchBar.appendChild(clearBtn);
    }
  } else if (clearBtn) {
    clearBtn.remove();
  }

  const filterActions = el.querySelector('.log-filter-actions');
  const hasFilters = Boolean(state.searchQuery || state.fromDate || state.toDate);

  if (filterActions) {
    let clearFiltersBtn = /** @type {HTMLButtonElement|null} */ (filterActions.querySelector('#clear-date-filters-btn'));

    if (hasFilters) {
      if (!clearFiltersBtn) {
        clearFiltersBtn = document.createElement('button');
        clearFiltersBtn.id = 'clear-date-filters-btn';
        clearFiltersBtn.className = 'btn btn-secondary';
        clearFiltersBtn.type = 'button';
        clearFiltersBtn.innerHTML = `${icon(Icons.X, 'icon')} ${t('admin.mailLogs.clearFilters')}`;
        filterActions.appendChild(clearFiltersBtn);
      }
    } else if (clearFiltersBtn) {
      clearFiltersBtn.remove();
    }
  }
}

/**
 * Sorts logs by specified column and order
 * @param {LogEntry[]} logs - Logs to sort
 * @param {string} sortBy - Column to sort by
 * @param {string} sortOrder - Sort order (asc or desc)
 * @returns {LogEntry[]} Sorted logs
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
 * @param {LogResponse|null} data - Log data
 * @param {boolean} loading - Whether data is loading
 * @returns {string} HTML string
 */
function renderView(data, loading) {
  return `
    <div class="section">
      <div class="section-header">
        <h2 class="section-title mb-0">${icon(Icons.MAIL, 'icon')} ${t('admin.mailLogs.title')}</h2>
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
        placeholder="${t('admin.mailLogs.searchPlaceholder')}"
        value="${escapeHtml(state.searchQuery)}"
      />
      <button id="search-btn" class="btn btn-primary" type="button">
        ${icon(Icons.SEARCH, 'icon')} ${t('common.search')}
      </button>
    </div>

    <div class="log-filters">
      <div class="form-group">
        <label for="from-date" class="label">${t('admin.mailLogs.fromDate')}</label>
        <input
          type="datetime-local"
          id="from-date"
          class="input"
          value="${state.fromDate}"
        />
      </div>

      <div class="form-group">
        <label for="to-date" class="label">${t('admin.mailLogs.toDate')}</label>
        <input
          type="datetime-local"
          id="to-date"
          class="input"
          value="${state.toDate}"
        />
      </div>

      <div class="form-group">
        <label class="label label-invisible">${t('admin.mailLogs.applyFilters')}</label>
        <div class="log-filter-actions">
          <button id="apply-filters-btn" class="btn btn-primary" type="button">
            ${t('admin.mailLogs.applyFilters')}
          </button>
        </div>
      </div>
    </div>

    <div class="log-filters">
      <div class="page-size-selector">
        <label for="page-size">${t('admin.logs.showPerPage')}</label>
        <select id="page-size">
          <option value="10" ${state.pageSize === 10 ? 'selected' : ''}>10</option>
          <option value="20" ${state.pageSize === 20 ? 'selected' : ''}>20</option>
          <option value="50" ${state.pageSize === 50 ? 'selected' : ''}>50</option>
          <option value="100" ${state.pageSize === 100 ? 'selected' : ''}>100</option>
        </select>
        <span>${t('admin.logs.perPage')}</span>
      </div>
    </div>
  `;
}

/**
 * Renders the logs table
 * @param {LogResponse} data - Log data
 * @returns {string} HTML string
 */
function renderLogsTable(data) {
  if (!data.logs || data.logs.length === 0) {
    return `
      <div class="log-empty-state">
        ${icon(Icons.MAIL, 'icon')}
        <p>${t('admin.mailLogs.noLogsFound')}</p>
      </div>
    `;
  }

  return `
    <div class="log-table-container">
      <table class="log-table log-table--responsive">
        <thead>
          <tr>
            <th class="sortable ${state.sortBy === 'timestamp' ? 'sort-' + state.sortOrder : ''}" data-sort="timestamp">
              ${t('admin.logs.timestamp')}
            </th>
            <th class="sortable ${state.sortBy === 'user' ? 'sort-' + state.sortOrder : ''}" data-sort="user">
              ${t('admin.logs.user')}
            </th>
            <th class="sortable ${state.sortBy === 'action' ? 'sort-' + state.sortOrder : ''}" data-sort="action">
              ${t('admin.logs.action')}
            </th>
            <th class="sortable hide-mobile ${state.sortBy === 'context' ? 'sort-' + state.sortOrder : ''}" data-sort="context">
              ${t('admin.mailLogs.recipientContext')}
            </th>
            <th>${t('admin.logs.message')}</th>
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
 * @param {LogEntry} log - Log entry
 * @returns {string} HTML string
 */
function renderLogRow(log) {
  // Color code mail actions
  let actionClass = 'log-cell-action';
  if (log.action.toLowerCase().includes('sent')) {
    actionClass += ' text-success';
  } else if (log.action.toLowerCase().includes('fail')) {
    actionClass += ' text-danger';
  } else if (log.action.toLowerCase().includes('queue')) {
    actionClass += ' text-warning';
  }

  return `
    <tr>
      <td data-label="${t('admin.logs.timestamp')}" class="log-cell-timestamp">${formatTimestamp(log.timestamp)}</td>
      <td data-label="${t('admin.logs.user')}" class="log-cell-user">${escapeHtml(log.user)}</td>
      <td data-label="${t('admin.logs.action')}" class="${actionClass}">${escapeHtml(log.action)}</td>
      <td data-label="${t('admin.mailLogs.recipientContext')}" class="log-cell-context hide-mobile">${escapeHtml(log.context)}</td>
      <td data-label="${t('admin.logs.message')}" class="log-cell-message">${escapeHtml(log.message)}</td>
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
        ${t('admin.logs.showing', { start: startItem, end: endItem, total: total })}
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
      <p>${t('admin.mailLogs.loadingLogs')}</p>
    </div>
  `;
}

/**
 * Renders error state
 * @param {string} message - Error message
 * @returns {string} HTML string
 */
function renderError(message) {
  /**
   * Renders error state
   */
  return `
    <div class="section">
      <div class="log-error">
        <div class="alert alert-danger">
          <strong>${t('admin.logs.error')}</strong> ${escapeHtml(message)}
        </div>
      </div>
    </div>
  `;
}

/**
 * Sets up event handlers (called only once)
 * @param {HTMLElement} el - Container element
 * @returns {void}
 */
function setupEventHandlers(el) {
  // Remove existing delegated click handler if present
  if (mailClickHandler) {
    el.removeEventListener('click', mailClickHandler);
  }

  mailClickHandler = function handleClick(e) {
    if (!location.hash.startsWith('#/logs/mail')) {
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

    // Clear search button
    if (target.closest('#clear-search-btn')) {
      state.searchQuery = '';
      state.currentPage = 1;
      loadLogs(el);
      return;
    }

    if (target.closest('#apply-filters-btn')) {
      const fromDateInput = /** @type {HTMLInputElement|null} */ (el.querySelector('#from-date'));
      const toDateInput = /** @type {HTMLInputElement|null} */ (el.querySelector('#to-date'));
      if (fromDateInput) state.fromDate = fromDateInput.value;
      if (toDateInput) state.toDate = toDateInput.value;
      state.currentPage = 1;
      loadLogs(el);
      return;
    }

    if (target.closest('#clear-date-filters-btn')) {
      state.searchQuery = '';
      state.fromDate = '';
      state.toDate = '';
      state.currentPage = 1;
      loadLogs(el);
      return;
    }

    // Pagination buttons
    const paginationBtn = target.closest('.pagination-btn[data-page]');
    if (paginationBtn && !paginationBtn.hasAttribute('disabled')) {
      const page = parseInt(paginationBtn.getAttribute('data-page') || '1');
      state.currentPage = page;
      loadLogs(el);
      return;
    }

    // Sortable column headers
    const sortableHeader = target.closest('.sortable[data-sort]');
    if (sortableHeader) {
      const sortBy = sortableHeader.getAttribute('data-sort') || 'timestamp';

      if (state.sortBy === sortBy) {
        // Toggle sort order
        state.sortOrder = state.sortOrder === 'asc' ? 'desc' : 'asc';
      } else {
        // New sort column
        state.sortBy = sortBy;
        state.sortOrder = 'desc';
      }

      loadLogs(el);
      return;
    }
  };

  // Use event delegation on the main container
  el.addEventListener('click', mailClickHandler);

  // Search input - Enter key
  const searchInput = /** @type {HTMLInputElement|null} */ (el.querySelector('#log-search'));
  if (searchInput) {
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        state.searchQuery = searchInput.value.trim();
        state.currentPage = 1;
        loadLogs(el);
      }
    });
  }

  // Page size selector
  const pageSizeSelect = /** @type {HTMLSelectElement|null} */ (el.querySelector('#page-size'));
  if (pageSizeSelect) {
    pageSizeSelect.addEventListener('change', () => {
      state.pageSize = parseInt(pageSizeSelect.value);
      state.currentPage = 1;
      loadLogs(el);
    });
  }

  const fromDateInput = /** @type {HTMLInputElement|null} */ (el.querySelector('#from-date'));
  if (fromDateInput) {
    fromDateInput.addEventListener('change', () => {
      state.fromDate = fromDateInput.value;
    });
  }

  const toDateInput = /** @type {HTMLInputElement|null} */ (el.querySelector('#to-date'));
  if (toDateInput) {
    toDateInput.addEventListener('change', () => {
      state.toDate = toDateInput.value;
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