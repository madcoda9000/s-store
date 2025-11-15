// /wwwroot/js/toast.js

/**
 * Toast notification type
 * @typedef {'success'|'error'|'warning'|'info'} ToastType
 */

/**
 * Toast options
 * @typedef {Object} ToastOptions
 * @property {string} message - Toast message
 * @property {ToastType} [type='info'] - Toast type
 * @property {number} [duration=4000] - Duration in milliseconds (0 = no auto-dismiss)
 * @property {string} [title] - Optional toast title
 */

/**
 * Shows a toast notification
 * @param {ToastOptions} options - Toast options
 * @returns {void}
 */
export function showToast(options) {
  const {
    message,
    type = 'info',
    duration = 4000,
    title
  } = options;

  // Ensure toast container exists
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  // Create toast element
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  // Icon based on type
  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ'
  };

  toast.innerHTML = `
    <div class="toast-icon">${icons[type]}</div>
    <div class="toast-content">
      ${title ? `<div class="toast-title">${escapeHtml(title)}</div>` : ''}
      <div class="toast-message">${escapeHtml(message)}</div>
    </div>
    <button class="toast-close" aria-label="Close">✕</button>
  `;

  // Add to container
  container.appendChild(toast);

  // Close button handler
  const closeBtn = toast.querySelector('.toast-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => dismissToast(toast));
  }

  // Auto-dismiss if duration is set
  if (duration > 0) {
    setTimeout(() => dismissToast(toast), duration);
  }
}

/**
 * Dismisses a toast notification
 * @param {HTMLElement} toast - Toast element to dismiss
 * @returns {void}
 */
function dismissToast(toast) {
  toast.classList.add('toast-hiding');
  setTimeout(() => {
    toast.remove();
    
    // Remove container if empty
    const container = document.querySelector('.toast-container');
    if (container && container.children.length === 0) {
      container.remove();
    }
  }, 300);
}

/**
 * Escapes HTML special characters to prevent XSS
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
