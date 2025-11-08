// /wwwroot/js/views/verify-2fa.js

import { api, setCsrfToken } from "../api.js";
import { hideHeader } from "../header.js";
import { icon, Icons } from "../icons.js";
import { t } from "../i18n.js";

/**
 * @typedef {'Authenticator'|'Email'} TwoFactorMethod
 */

/**
 * Registers the 2FA verification route
 * @param {RouteRegisterFn} route - Route registration function
 * @returns {void}
 */
export function registerVerify2fa(route) {
  route("/verify-2fa", (el, params) => {
    // Hide header on 2FA page
    hideHeader();

    // Get method from URL params (passed from login)
    const method = /** @type {TwoFactorMethod} */ (params.get('method') || 'Authenticator');
    
    // For email 2FA, get email from sessionStorage
    const email = method === 'Email' ? sessionStorage.getItem('2fa_email') || '' : '';
    
    // Security check: if email 2FA but no email in session, redirect to login
    if (method === 'Email' && !email) {
      location.hash = '/login';
      return;
    }

    el.innerHTML = `
      <div class="auth-container">
        <div class="auth-wrapper">
          <div class="card auth-card">
            
            <div class="auth-header">
              <h1 class="auth-logo">${t('common.appName')}</h1>
              <p class="text-muted">${t('auth.twoFactor.required')}</p>
            </div>
            
            ${method === 'Email' ? `
              <div class="alert alert-info" style="margin-bottom: 1.5rem;">
                ${icon(Icons.MAIL, 'icon')} ${t('auth.twoFactor.emailCodeSent')}
              </div>
            ` : ''}
            
            <form id="verify-2fa-form" class="form">
              <div class="form-group">
                <label class="label" for="code">
                  ${method === 'Authenticator' 
                    ? t('auth.twoFactor.enterCode')
                    : t('auth.twoFactor.enterEmailCode')
                  }
                </label>
                <input 
                  type="text" 
                  id="code" 
                  name="code"
                  class="input" 
                  placeholder="000000"
                  maxlength="6"
                  pattern="[0-9]{6}"
                  inputmode="numeric"
                  autocomplete="one-time-code"
                  autofocus
                  required>
              </div>
              
              <div class="form-group">
                <label class="checkbox">
                  <input type="checkbox" name="rememberDevice">
                  <span>${t('auth.twoFactor.rememberDevice')}</span>
                </label>
              </div>
              
              <div id="verify-error" class="error hidden"></div>
              
              <button type="submit" class="btn btn-primary btn-block">
                ${t('auth.twoFactor.verify')}
              </button>
            </form>
            
            <div class="auth-footer">
              <a href="#/login" class="link" id="back-to-login">${icon(Icons.ARROW_LEFT, 'icon icon-sm')} ${t('auth.forgotPassword.backToLogin')}</a>
            </div>
          </div>

          <div class="auth-theme-toggle">
            <button class="btn btn-icon" id="auth-theme-toggle" aria-label="${t('common.toggleTheme')}">${getThemeIcon()}</button>
          </div>
        
        </div>
      </div>`;

    const form = /** @type {HTMLFormElement} */ (el.querySelector("#verify-2fa-form"));
    const errorEl = /** @type {HTMLElement} */ (el.querySelector("#verify-error"));
    const authThemeToggle = el.querySelector("#auth-theme-toggle");

    // Cleanup sessionStorage when going back to login
    const backToLoginLink = el.querySelector('#back-to-login');
    if (backToLoginLink) {
      backToLoginLink.addEventListener('click', () => {
        if (method === 'Email') {
          sessionStorage.removeItem('2fa_email');
        }
      });
    }

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
      const code = formData.get("code")?.toString() || "";
      const rememberDevice = formData.get("rememberDevice") === "on";

      const submitBtn = /** @type {HTMLButtonElement} */ (form.querySelector('button[type="submit"]'));
      const originalText = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = t('auth.twoFactor.verifying');

      try {
        const endpoint = method === 'Email' 
          ? '/auth/2fa/verify-email'
          : '/auth/2fa/verify-authenticator';

        // Build request body based on method
        const requestBody = method === 'Email'
          ? { Email: email, Code: code, RememberThisDevice: rememberDevice }
          : { Code: code, RememberThisDevice: rememberDevice };

        /** @type {ApiResponse} */
        const res = await api(endpoint, {
          method: "POST",
          body: requestBody,
        });

        // Update CSRF token if returned from backend
        if (res?.csrfToken) {
          setCsrfToken(res.csrfToken);
        }

        // Successful 2FA verification - redirect to home
        // Clean up sessionStorage if email 2FA was used
        if (method === 'Email') {
          sessionStorage.removeItem('2fa_email');
        }
        
        location.hash = "/home";
      } catch (err) {
        const error = /** @type {Error} */ (err);
        errorEl.textContent = error.message || t('auth.twoFactor.invalidCode');
        errorEl.classList.remove("hidden");
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
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
