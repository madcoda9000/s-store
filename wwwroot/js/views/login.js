// /wwwroot/js/views/login.js

import { api, getAppConfig, setCsrfToken } from "../api.js";
import { hideHeader } from "../header.js";
import { icon, Icons } from "../icons.js";
import { t } from "../i18n.js";

/**
 * Registers the login route
 * @param {RouteRegisterFn} route - Route registration function
 * @returns {void}
 */
export function registerLogin(route) {
  route("/login", async (el) => {
    // Hide header on login page
    hideHeader();

    el.innerHTML = `
      <div class="auth-container auth-login">
        <div class="auth-wrapper auth-login-wrapper">
          <div class="card auth-card auth-panel">
            <div class="auth-hero">
              <div class="auth-hero-text">
                <h1 class="auth-logo">${t('common.appName')}</h1>
                <p class="text-muted">${t('auth.login.title')}</p>
              </div>
            </div>

            <form id="login-form" class="form auth-form">
              <div class="form-group">
                <label class="label" for="username">${t('auth.login.emailOrUsername')}</label>
                <input 
                  type="text" 
                  id="username" 
                  name="username" 
                  class="input" 
                  placeholder="${t('auth.login.emailPlaceholder')}"
                  autocomplete="username"
                  required>
              </div>
              
              <div class="form-group">
                <label class="label" for="password">${t('auth.login.password')}</label>
                <input 
                  type="password" 
                  id="password" 
                  name="password" 
                  class="input" 
                  placeholder="${t('auth.login.passwordPlaceholder')}"
                  autocomplete="current-password"
                  required>
              </div>
              
              <div class="form-group form-row auth-link-row">
                <label class="checkbox">
                  <input type="checkbox" name="remember">
                  <span>${t('auth.login.rememberMe')}</span>
                </label>
                <a href="#/forgot-password" class="link" data-role="login-forgot-link">${t('auth.login.forgotPassword')}</a>
              </div>
              
              <div id="login-error" class="error hidden"></div>
              
              <button type="submit" class="btn btn-primary btn-block">${t('auth.login.signIn')}</button>
              <p class="auth-register-inline text-muted" data-role="login-register-link-description">
                ${t('auth.login.noAccount')} <a href="#/register" class="link" data-role="login-register-link">${t('auth.login.signUp')}</a>
              </p>
            </form>
          </div>

          <div class="auth-theme-toggle">
            <button class="btn btn-icon" id="auth-theme-toggle" aria-label="${t('common.toggleTheme')}">${getThemeIcon()}</button>
          </div>
        </div>
      </div>`;

    await applyLoginLinkVisibility(el);

    const form = /** @type {HTMLFormElement} */ (el.querySelector("#login-form"));
    const errorEl = /** @type {HTMLElement} */ (el.querySelector("#login-error"));
    const authThemeToggle = el.querySelector("#auth-theme-toggle");

    // Setup theme toggle for auth page
    if (authThemeToggle) {
      authThemeToggle.addEventListener("click", () => {
        const html = document.documentElement;
        const currentTheme = html.getAttribute("data-theme");
        const newTheme = currentTheme === "light" ? "dark" : "light";
        html.setAttribute("data-theme", newTheme);
        localStorage.setItem("theme", newTheme);
        
        // Update icon
        authThemeToggle.innerHTML = getThemeIcon();
      });
    }

    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      errorEl.classList.add("hidden");
      errorEl.textContent = "";

      const formData = new FormData(form);
      
      /** @type {LoginDto} */
      const data = {
        username: formData.get("username")?.toString() || "",
        password: formData.get("password")?.toString() || "",
        rememberMe: formData.get("remember") === "on",
      };

      try {
        /** @type {ApiResponse} */
        const res = await api("/auth/login", {
          method: "POST",
          body: data,
        });

        // Update CSRF token if returned from backend
        if (res?.csrfToken) {
          setCsrfToken(res.csrfToken);
        }

        // Check if user needs to set up 2FA (enforced by admin)
        if (res?.needsSetup2fa) {
          location.hash = "/setup-2fa";
          return;
        }

        // Check if 2FA verification is required
        if (res?.requires2fa) {
          const method = res.twoFactorMethod || 'Authenticator';
          
          // For email 2FA, store email from response in sessionStorage
          if (method === 'Email' && res.email) {
            sessionStorage.setItem('2fa_email', res.email);
          }
          
          location.hash = `/verify-2fa?method=${method}`;
          return;
        }

        // Normal login success
        location.hash = "/home";
      } catch (err) {
        const error = /** @type {Error} */ (err);
        errorEl.textContent = error.message || t('auth.login.invalidCredentials');
        errorEl.classList.remove("hidden");
      }
    });
  });
}

/**
 * Applies login link visibility rules based on application configuration
 * @param {HTMLElement} root - Root element of the login view
 * @returns {Promise<void>}
 */
async function applyLoginLinkVisibility(root) {
  const config = await getAppConfig();
  if (!config?.application) {
    return;
  }

  const registerLink = root.querySelector('[data-role="login-register-link"]');
  const registerLinkDescription = root.querySelector('[data-role="login-register-link-description"]');
  const forgotLink = root.querySelector('[data-role="login-forgot-link"]');

  if (config.application.showRegisterLinkOnLoginPage === false) {
    registerLink?.classList.add("hidden");
    registerLinkDescription?.classList.add("hidden");
  } else {
    registerLink?.classList.remove("hidden");
    registerLinkDescription?.classList.remove("hidden");
  }

  if (config.application.showForgotPasswordLinkOnLoginPage === false) {
    forgotLink?.classList.add("hidden");
  } else {
    forgotLink?.classList.remove("hidden");
  }
}

/**
 * Gets the appropriate theme icon based on current theme
 * @returns {string} SVG icon HTML for current theme
 */
function getThemeIcon() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  const activeTheme = currentTheme || systemTheme;
  
  return activeTheme === 'dark' 
    ? icon(Icons.SUN, 'icon icon-lg') 
    : icon(Icons.MOON, 'icon icon-lg');
}
