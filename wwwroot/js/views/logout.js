import { api, setCsrfToken } from "../api.js";
import { hideHeader } from "../header.js";

/**
 * Registers the logout route
 * Calls the logout API endpoint and redirects to login
 * @param {RouteRegisterFn} route - The route registration function
 * @returns {void}
 */
export function registerLogout(route) {
  route("/logout", async (el) => {
    // Hide header on logout page
    hideHeader();
    
    // Show a loading message
    el.innerHTML = `
      <div class="auth-container">
        <div class="auth-wrapper">
          <div class="card auth-card">
            <div class="auth-header">
              <h1 class="auth-logo">S-Store</h1>
              <p class="text-muted">Logging out...</p>
            </div>
            <div class="loading-container">
              <div class="spinner"></div>
            </div>
          </div>
        </div>
      </div>`;

    try {
      // Call logout API endpoint
      const res = await api("/auth/logout", {
        method: "POST",
      });

      // Update CSRF token if returned from backend
      if (res?.csrfToken) {
        setCsrfToken(res.csrfToken);
      }

    } catch (error) {
      // Even if API call fails, continue to login page
      console.error("Logout error:", error);
    } finally {
      // Always redirect to login after logout attempt
      location.hash = "/login";
    }
  });
}
