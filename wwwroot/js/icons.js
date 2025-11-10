// /wwwroot/js/icons.js

/**
 * Creates an SVG icon element
 * @param {string} name - Icon name (e.g., 'eye', 'key', 'user')
 * @param {string} [className='icon'] - CSS class for the icon
 * @returns {string} SVG icon HTML string
 */
export function icon(name, className = 'icon') {
  return `<svg class="${className}" aria-hidden="true"><use href="/icons.svg#icon-${name}"></use></svg>`;
}

/**
 * Icon name constants for better IDE support
 */
export const Icons = {
  // Visibility
  EYE: 'eye',
  EYE_OFF: 'eye-off',
  
  // Actions
  KEY: 'key',
  CHECK: 'check',
  COPY: 'copy',
  EDIT: 'edit',
  TRASH: 'trash',
  PLUS: 'plus',
  SEARCH: 'search',
  
  // User & Auth
  USER: 'user',
  USERS: 'users',
  SHIELD: 'shield',
  SHIELD_CHECK: 'shield-check',
  LOG_OUT: 'log-out',
  LOCK: 'lock',
  
  // Navigation
  HOME: 'home',
  SETTINGS: 'settings',
  MENU: 'menu',
  X: 'x',
  CHEVRON_DOWN: 'chevron-down',
  
  // Theme
  MOON: 'moon',
  SUN: 'sun',
  
  // Communication
  MAIL: 'mail',
  CALENDAR: 'calendar',
  
  // Alerts & Status
  ALERT_CIRCLE: 'alert-circle',
  ALERT_TRIANGLE: 'alert-triangle',
  INFO: 'info',
  CHECK_CIRCLE: 'check-circle',
  
  // File operations
  DOWNLOAD: 'download',
  PRINTER: 'printer',
  
  // Actions & Navigation
  ARROW_LEFT: 'arrow-left',
  REFRESH_CW: 'refresh-cw'
};