// /wwwroot/js/views/forgot-password.js

import { api, getAppConfig, setCsrfToken } from "../api.js";
import { hideHeader } from "../header.js";
import { icon, Icons } from "../icons.js";
import { t } from "../i18n.js";

/**
 * Registers the forgot password route
 * @param {RouteRegisterFn} route - Route registration function
 * @returns {void}
 */
export function registerForgotPassword(route) {
  route("/forgot-password", async (el) => {
    const config = await getAppConfig();
    if (config?.application?.showForgotPasswordLinkOnLoginPage === false) {
      location.hash = "/login";
      return;
    }

    // Hide header on auth page
    hideHeader();

    el.innerHTML = `
      <div class="auth-container auth-forgot">
        <div class="auth-wrapper auth-forgot-wrapper">
          <div class="card auth-card auth-panel">
            <div class="auth-hero">
              <div class="auth-hero-text">
                <h1 class="auth-logo">${t('common.appName')}</h1>
                <p class="text-muted">${t('auth.forgotPassword.title')}</p>
              </div>
            </div>
            
            <form id="forgot-password-form" class="form auth-form">
              <p class="text-muted mb-5">
                ${t('auth.forgotPassword.description')}
              </p>
              
              <div class="form-group">
                <label class="label" for="email">${t('auth.forgotPassword.email')}</label>
                <input 
                  type="email" 
                  id="email" 
                  name="email" 
                  class="input" 
                  placeholder="${t('auth.forgotPassword.emailPlaceholder')}"
                  autocomplete="email"
                  required>
              </div>
              
              <div id="forgot-password-error" class="error hidden"></div>
              <div id="forgot-password-success" class="alert alert-success hidden"></div>
              
              <button type="submit" class="btn btn-primary btn-block">${t('auth.forgotPassword.sendResetLink')}</button>
            </form>
            
            <p class="auth-register-inline text-muted">
              <a href="#/login" class="link">${t('auth.forgotPassword.backToLogin')}</a>
            </p>
          </div>

          <div class="auth-theme-toggle hidden">
            <button class="btn btn-icon" id="auth-theme-toggle" aria-label="${t('common.toggleTheme')}">${getThemeIcon()}</button>
          </div>
        
        </div>
      </div>`;

    const form = /** @type {HTMLFormElement} */ (el.querySelector("#forgot-password-form"));
    const errorEl = /** @type {HTMLElement} */ (el.querySelector("#forgot-password-error"));
    const successEl = /** @type {HTMLElement} */ (el.querySelector("#forgot-password-success"));
    const submitBtn = /** @type {HTMLButtonElement} */ (form.querySelector('button[type="submit"]'));


    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      errorEl.classList.add("hidden");
      errorEl.textContent = "";
      successEl.classList.add("hidden");
      successEl.textContent = "";

      const formData = new FormData(form);
      
      /** @type {ForgotPasswordDto} */
      const data = {
        email: formData.get("email")?.toString() || "",
      };

      // Disable submit button during request
      submitBtn.disabled = true;
      submitBtn.textContent = t('auth.forgotPassword.sending');

      try {
        /** @type {ApiResponse} */
        const res = await api("/auth/forgot-password", {
          method: "POST",
          body: data,
        });

        // Update CSRF token if returned from backend
        if (res?.csrfToken) {
          setCsrfToken(res.csrfToken);
        }

        // Show success message
        successEl.textContent = res?.message || t('auth.forgotPassword.successMessage');
        successEl.classList.remove("hidden");

        // Clear form
        form.reset();
      } catch (err) {
        const error = /** @type {Error} */ (err);
        errorEl.textContent = error.message || t('errors.generic');
        errorEl.classList.remove("hidden");
      } finally {
        // Re-enable submit button
        submitBtn.disabled = false;
        submitBtn.textContent = t('auth.forgotPassword.sendResetLink');
      }
    });
  });
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
