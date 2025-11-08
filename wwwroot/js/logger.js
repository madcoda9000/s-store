import { api } from '/js/api.js';

/**
 * Logger utility for frontend logging to backend
 * Uses the existing api() function for consistent CSRF token handling
 */
class Logger {
  constructor() {
    this.baseUrl = '/log';
  }

  /**
   * Sends a log request to the backend
   * @param {string} endpoint - The API endpoint
   * @param {SimpleLogDto|CreateLogDto} data - The log data
   * @returns {Promise<LogResponse|null>} The API response or null on error
   */
  async sendLog(endpoint, data) {
    try {
      const fullUrl = `${this.baseUrl}${endpoint}`;
      const response = await api(fullUrl, {
        method: 'POST',
        body: data
      });
      return response;
    } catch (error) {
      console.error('Error sending log:', error);
      return null;
    }
  }

  /**
   * Logs an error to the backend
   * @param {string} action - The action that caused the error
   * @param {string} context - The context (component, page, etc.)
   * @param {string} message - Error message
   * @returns {Promise<LogResponse|null>} The API response or null on error
   */
  async logError(action, context, message) {
    return await this.sendLog('/error', { action, context, message });
  }

  /**
   * Logs a system event to the backend
   * @param {string} action - The system action
   * @param {string} context - The context
   * @param {string} message - Event message
   * @returns {Promise<LogResponse|null>} The API response or null on error
   */
  async logSystem(action, context, message) {
    return await this.sendLog('/system', { action, context, message });
  }

  /**
   * Logs a custom event with specific category
   * @param {0|1|2|3|4} category - Log category (0=ERROR, 1=AUDIT, 2=REQUEST, 3=MAIL, 4=SYSTEM)
   * @param {string} action - The action
   * @param {string} context - The context
   * @param {string} message - Log message
   * @returns {Promise<LogResponse|null>} The API response or null on error
   */
  async log(category, action, context, message) {
    return await this.sendLog('', { category, action, context, message });
  }

  /**
   * Global error handler - automatically logs unhandled errors
   * Call this in your app initialization
   */
  setupGlobalErrorHandler() {
    window.addEventListener('error', (event) => {
      this.logError(
        'UnhandledError',
        event.filename || 'Unknown',
        `${event.message} at line ${event.lineno}:${event.colno}`
      );
    });

    window.addEventListener('unhandledrejection', (event) => {
      this.logError(
        'UnhandledPromiseRejection',
        'Promise',
        event.reason?.message || event.reason || 'Unknown error'
      );
    });
  }
}

// Create singleton instance
const logger = new Logger();

// Export for use in modules
export { logger };
