// /wwwroot/js/router.js

/** @type {Record<string, RouteRenderFn>} */
const routes = {};

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
 * Starts the router and listens for hash changes
 * @returns {void}
 */
export function start() {
  const go = () => {
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
    
    const view = routes[path] || routes['/404'];
    const appElement = document.getElementById('app');
    if (view && appElement) {
      view(appElement, params);
    }
  };
  window.addEventListener('hashchange', go);
  go();
}
