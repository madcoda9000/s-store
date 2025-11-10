// /wwwroot/js/router.js

/** @type {Record<string, RouteRenderFn>} */
const routes = {};

/** @type {(() => Promise<boolean>)|null} */
let twoFactorGuard = null;

/**
 * Routes that are exempt from 2FA enforcement check
 */
const UNPROTECTED_ROUTES = [
  '/login',
  '/logout', 
  '/register',
  '/verify-email',
  '/forgot-password',
  '/reset-password',
  '/verify-2fa',
  '/setup-2fa', // Important: setup-2fa itself must be accessible
  '/404'
];

/**
 * Registers a route with a render function
 * @param {string} path - Route path (e.g., '/login')
 * @param {RouteRenderFn} render - Function to render the route
 * @returns {void}
 */
export function route(path, render) { 
  routes[path] = render; 
}

/**
 * Sets the 2FA guard function that checks if setup is required
 * @param {() => Promise<boolean>} guardFn - Function that returns true if 2FA setup is required
 * @returns {void}
 */
export function set2FAGuard(guardFn) {
  twoFactorGuard = guardFn;
}

/**
 * Starts the router and listens for hash changes
 * @returns {void}
 */
export function start() {
  const go = async () => {
    let hash = location.hash.slice(1); // Remove leading #
    
    // If no hash, set default route
    if (!hash) {
      location.hash = '/login';
      return; // hashchange event will trigger go() again
    }
    
    // Split path from query parameters
    // Example: /verify-email?token=abc&userId=123 -> path: /verify-email, query: token=abc&userId=123
    const [path, queryString] = hash.split('?');
    
    // Parse query parameters into URLSearchParams
    const params = new URLSearchParams(queryString || '');
    
    // Check 2FA requirement BEFORE rendering protected routes
    if (twoFactorGuard && !UNPROTECTED_ROUTES.includes(path)) {
      const needsSetup = await twoFactorGuard();
      if (needsSetup && path !== '/setup-2fa') {
        location.hash = '/setup-2fa';
        return;
      }
    }
    
    const view = routes[path] || routes['/404'];
    const appElement = document.getElementById('app');
    if (view && appElement) {
      view(appElement, params);
    }
  };
  window.addEventListener('hashchange', go);
  go();
}
