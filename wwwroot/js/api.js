// /wwwroot/js/api.js

// Store CSRF token in memory
let csrfToken = null;
/** @type {Promise<void>|null} */
let csrfTokenPromise = null;
/** @type {AppConfig|null} */
let appConfigCache = null;
/** @type {Promise<AppConfig|null>|null} */
let appConfigPromise = null;

/**
 * Sets the CSRF token directly (e.g., after login)
 * @param {string} token - The new CSRF token
 * @returns {void}
 */
export function setCsrfToken(token) {
  csrfToken = token;
}

/**
 * Clears the cached CSRF token, forcing a refresh on next request
 * @returns {void}
 */
export function clearCsrfToken() {
  csrfToken = null;
  csrfTokenPromise = null;
}

/**
 * Retrieves application configuration from backend with in-memory caching
 * @returns {Promise<AppConfig|null>} Application configuration object or null when unavailable
 */
export async function getAppConfig() {
  if (appConfigCache) {
    return appConfigCache;
  }

  if (appConfigPromise) {
    return appConfigPromise;
  }

  appConfigPromise = (async () => {
    try {
      const response = await fetch('/api/config', { credentials: 'include' });
      if (!response.ok) {
        return null;
      }

      /** @type {AppConfig} */
      const config = await response.json();
      appConfigCache = config;
      return config;
    } catch (error) {
      console.error('Error fetching app config', error);
      return null;
    } finally {
      appConfigPromise = null;
    }
  })();

  return appConfigPromise;
}

/**
 * Fetches the CSRF token from the backend and stores it in memory.
 * This should be called once when the app starts.
 * Subsequent calls while a fetch is in progress will reuse the same promise.
 * @returns {Promise<void>}
 */
export async function initCsrfToken() {
  // If already fetching, return the existing promise
  if (csrfTokenPromise) {
    return csrfTokenPromise;
  }
  
  // If token already exists, return immediately
  if (csrfToken) {
    return Promise.resolve();
  }
  
  // Create new fetch promise
  csrfTokenPromise = (async () => {
    try {
      const response = await fetch('/api/csrf-token', {
        method: 'GET',
        credentials: 'include'
      });
      if (response.ok) {
        /** @type {CsrfTokenResponse} */
        const data = await response.json();
        csrfToken = data.token;
      }
    } catch (error) {
      console.error('Error fetching CSRF token:', error);
    } finally {
      csrfTokenPromise = null;
    }
  })();
  
  return csrfTokenPromise;
}

/**
 * Makes an API request with automatic CSRF token handling
 * @template T
 * @param {string} url - The URL to fetch
 * @param {ApiOptions} [options] - Fetch options
 * @returns {Promise<T>} The parsed JSON response
 */
export async function api(url, { method = 'GET', body } = {}) {
  const headers = { 'Accept': 'application/json' };
  
  // Add CSRF token header for state-changing requests
  if (method !== 'GET' && method !== 'HEAD') {
    if (!csrfToken) {
      console.warn('CSRF token not initialized. Call initCsrfToken() first.');
      // Try to fetch it now as fallback
      await initCsrfToken();
    }
    
    if (csrfToken) {
      headers['X-XSRF-TOKEN'] = csrfToken;
    } else {
      console.error('No CSRF token available!');
    }
  }
  
  if (body) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }
  
  const res = await fetch(url, { method, headers, body, credentials: 'include' });
  
  if (!res.ok) {
    const msg = await safeJson(res);
    const errorMessage = msg?.error || res.statusText;

    // Handle rate limiting (429 Too Many Requests)
    if (res.status === 429) {
      const retryAfter = res.headers.get('Retry-After') || '60';
      location.hash = `/rate-limit?retryAfter=${retryAfter}`;
      throw new Error(errorMessage);
    }
    
    // If CSRF token is invalid/expired, try to refresh it once and retry
    if (res.status === 400 && errorMessage.includes('antiforgery')) {
      console.warn('CSRF token expired or invalid. Refreshing...');
      
      // Clear the old token to force a fresh fetch
      clearCsrfToken();
      
      // Fetch new token
      await initCsrfToken();
      
      // Retry the request with new token
      if (csrfToken) {
        headers['X-XSRF-TOKEN'] = csrfToken;
        const retryRes = await fetch(url, { method, headers, body, credentials: 'include' });
        if (retryRes.ok) {
          return safeJson(retryRes);
        }
        // If retry still fails, throw the original error
        const retryMsg = await safeJson(retryRes);
        throw new Error(retryMsg?.error || retryRes.statusText);
      }
    }
    
    throw new Error(errorMessage);
  }
  
  return safeJson(res);
}

/**
 * Safely parses JSON response, returns null if parsing fails
 * @template T
 * @param {Response} res - Fetch response object
 * @returns {Promise<T|null>} Parsed JSON or null
 */
async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}
