// /wwwroot/js/views/verify-email.js

import { api, setCsrfToken } from "../api.js";
import { hideHeader } from "../header.js";
import { icon, Icons } from "../icons.js";
import { t } from "../i18n.js";

/**
 * Registers the email verification route
 * @param {RouteRegisterFn} route - Route registration function
 * @returns {void}
 */
export function registerVerifyEmail(route) {
  route("/verify-email", (el) => {
    // Hide header on verification page
    hideHeader();

    // Check if we have token and userId in URL params
    const urlParams = new URLSearchParams(location.hash.split('?')[1]);
    const token = urlParams.get('token');
    const userId = urlParams.get('userId');

    // If we have both token and userId, auto-verify
    if (token && userId) {
      renderAutoVerification(el, token, userId);
    } else {
      // Otherwise show manual verification form
      renderManualVerification(el);
    }
  });
}

/**
 * Renders automatic verification view
 * @param {HTMLElement} el - Container element
 * @param {string} token - Verification token
 * @param {string} userId - User ID
 * @returns {void}
 */
function renderAutoVerification(el, token, userId) {
  el.innerHTML = `
    <div class="auth-container">
      <div class="auth-wrapper">
        <div class="card auth-card">
          
          <div class="auth-header">
            <h1 class="auth-logo">${t('common.appName')}</h1>
            <p class="text-muted">${t('auth.verifyEmail.verifying')}</p>
          </div>
          
          <div class="loading-container">
            <div class="spinner"></div>
            <p class="text-muted mt-10">${t('common.loading')}</p>
          </div>

          <div id="verification-result" class="hidden"></div>
          
          <div class="auth-footer">
            <p class="text-muted"><a href="#/login" class="link">${t('auth.verifyEmail.backToLogin')}</a></p>
          </div>
        </div>

        <div class="auth-theme-toggle">
          <button class="btn btn-icon" id="auth-theme-toggle" aria-label="${t('common.toggleTheme')}">${getThemeIcon()}</button>
        </div>
      
      </div>
    </div>`;

  const resultEl = /** @type {HTMLElement} */ (el.querySelector("#verification-result"));
  const loadingEl = /** @type {HTMLElement} */ (el.querySelector(".loading-container"));
  const authThemeToggle = el.querySelector("#auth-theme-toggle");

  // Setup theme toggle
  if (authThemeToggle) {
    authThemeToggle.addEventListener("click", () => {
      const html = document.documentElement;
      const currentTheme = html.getAttribute("data-theme");
      const newTheme = currentTheme === "light" ? "dark" : "light";
      html.setAttribute("data-theme", newTheme);
      localStorage.setItem("theme", newTheme);
      authThemeToggle.innerHTML = getThemeIcon();
    });
  }

  // Auto-verify
  (async () => {
    try {
      /** @type {VerifyEmailDto} */
      const data = {
        userId: userId,
        token: token
      };

      /** @type {ApiResponse} */
      const res = await api("/auth/verify-email", {
        method: "POST",
        body: data,
      });

      // Update CSRF token if returned
      if (res?.csrfToken) {
        setCsrfToken(res.csrfToken);
      }

      // Hide loading, show success
      loadingEl.classList.add("hidden");
      resultEl.innerHTML = `
        <div class="alert alert-success">
          <strong>${t('common.success')}!</strong> ${res.message || t('auth.verifyEmail.successMessage')}
        </div>
        <a href="#/login" class="btn btn-primary btn-block mt-10">${t('auth.verifyEmail.backToLogin')}</a>
      `;
      resultEl.classList.remove("hidden");
    } catch (err) {
      const error = /** @type {Error} */ (err);
      
      // Hide loading, show error
      loadingEl.classList.add("hidden");
      resultEl.innerHTML = `
        <div class="alert alert-danger">
          <strong>${t('errors.generic')}</strong><br>
          ${error.message || t('errors.generic')}
        </div>
        <a href="#/verify-email" class="btn btn-secondary btn-block mt-10">${t('auth.verifyEmail.verify')}</a>
        <a href="#/login" class="btn btn-ghost btn-block">${t('auth.verifyEmail.backToLogin')}</a>
      `;
      resultEl.classList.remove("hidden");
    }
  })();
}

/**
 * Renders manual verification form
 * @param {HTMLElement} el - Container element
 * @returns {void}
 */
function renderManualVerification(el) {
  el.innerHTML = `
    <div class="auth-container">
      <div class="auth-wrapper">
        <div class="card auth-card">
          
          <div class="auth-header">
            <h1 class="auth-logo">${t('common.appName')}</h1>
            <p class="text-muted">${t('auth.verifyEmail.title')}</p>
          </div>
          
          <form id="verify-form" class="form">
            <div class="alert alert-info">
              <strong>${t('common.loading')}</strong><br>
              ${t('auth.verifyEmail.description')}
            </div>

            <div class="form-group">
              <label class="label" for="email">${t('auth.verifyEmail.email')}</label>
              <input 
                type="email" 
                id="email" 
                name="email" 
                class="input" 
                placeholder="${t('auth.forgotPassword.emailPlaceholder')}"
                autocomplete="email"
                required>
            </div>
            
            <div class="form-group">
              <label class="label" for="code">${t('auth.verifyEmail.code')}</label>
              <input 
                type="text" 
                id="code" 
                name="code" 
                class="input" 
                placeholder="123456"
                pattern="[0-9]{6}"
                maxlength="6"
                autocomplete="off"
                required>
              <p class="form-hint">${t('auth.verifyEmail.codeHint')}</p>
            </div>
            
            <div id="verify-error" class="error hidden"></div>
            <div id="verify-success" class="alert alert-success hidden"></div>
            
            <button type="submit" class="btn btn-primary btn-block">${t('auth.verifyEmail.verify')}</button>
          </form>

          <div class="divider" style="margin: var(--space-lg) 0;"></div>

          <div class="auth-footer">
            <p class="text-muted">${t('auth.verifyEmail.resend')}</p>
            <button id="resend-btn" class="btn btn-secondary btn-block">${t('auth.verifyEmail.resend')}</button>
            <div id="resend-success" class="alert alert-success hidden" style="margin-top: var(--space-md);"></div>
            <p class="text-muted mt-10"><a href="#/login" class="link">${t('auth.verifyEmail.backToLogin')}</a></p>
          </div>
        </div>

        <div class="auth-theme-toggle">
          <button class="btn btn-icon" id="auth-theme-toggle" aria-label="${t('common.toggleTheme')}">${getThemeIcon()}</button>
        </div>
      
      </div>
    </div>`;

  const form = /** @type {HTMLFormElement} */ (el.querySelector("#verify-form"));
  const errorEl = /** @type {HTMLElement} */ (el.querySelector("#verify-error"));
  const successEl = /** @type {HTMLElement} */ (el.querySelector("#verify-success"));
  const resendBtn = /** @type {HTMLButtonElement} */ (el.querySelector("#resend-btn"));
  const resendSuccessEl = /** @type {HTMLElement} */ (el.querySelector("#resend-success"));
  const authThemeToggle = el.querySelector("#auth-theme-toggle");

  // Setup theme toggle
  if (authThemeToggle) {
    authThemeToggle.addEventListener("click", () => {
      const html = document.documentElement;
      const currentTheme = html.getAttribute("data-theme");
      const newTheme = currentTheme === "light" ? "dark" : "light";
      html.setAttribute("data-theme", newTheme);
      localStorage.setItem("theme", newTheme);
      authThemeToggle.innerHTML = getThemeIcon();
    });
  }

  // Handle form submission
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    errorEl.classList.add("hidden");
    errorEl.textContent = "";
    successEl.classList.add("hidden");
    successEl.innerHTML = "";

    const formData = new FormData(form);
    
    /** @type {VerifyEmailCodeDto} */
    const data = {
      email: formData.get("email")?.toString() || "",
      code: formData.get("code")?.toString() || "",
    };

    try {
      /** @type {ApiResponse} */
      const res = await api("/auth/verify-email-code", {
        method: "POST",
        body: data,
      });

      // Update CSRF token if returned
      if (res?.csrfToken) {
        setCsrfToken(res.csrfToken);
      }

      // Show success in DOM
      successEl.innerHTML = `
        <strong>${t('common.success')}!</strong> ${res.message || t('auth.verifyEmail.successMessage')}
        <br><br>
        <a href="#/login" class="btn btn-primary btn-block">${t('auth.verifyEmail.backToLogin')}</a>
      `;
      successEl.classList.remove("hidden");
      
      // Hide form
      form.style.display = "none";
      
      // Optionally redirect after delay
      setTimeout(() => {
        location.hash = "/login";
      }, 3000);
    } catch (err) {
      const error = /** @type {Error} */ (err);
      errorEl.textContent = error.message || t('errors.generic');
      errorEl.classList.remove("hidden");
    }
  });

  // Handle resend button
  resendBtn.addEventListener("click", async () => {
    const emailInput = /** @type {HTMLInputElement} */ (el.querySelector("#email"));
    const email = emailInput.value.trim();

    if (!email) {
      errorEl.textContent = t('validation.required');
      errorEl.classList.remove("hidden");
      return;
    }

    errorEl.classList.add("hidden");
    resendSuccessEl.classList.add("hidden");
    resendBtn.disabled = true;
    resendBtn.textContent = t('common.loading');

    try {
      /** @type {ResendVerificationDto} */
      const data = { email };

      /** @type {ApiResponse} */
      const res = await api("/auth/resend-verification", {
        method: "POST",
        body: data,
      });

      // Update CSRF token if returned
      if (res?.csrfToken) {
        setCsrfToken(res.csrfToken);
      }

      // Show success message
      resendSuccessEl.innerHTML = `
        <strong>${t('common.success')}!</strong> ${res.message || t('auth.verifyEmail.resend')}
      `;
      resendSuccessEl.classList.remove("hidden");
    } catch (err) {
      const error = /** @type {Error} */ (err);
      errorEl.textContent = error.message || t('errors.generic');
      errorEl.classList.remove("hidden");
    } finally {
      resendBtn.disabled = false;
      resendBtn.textContent = t('auth.verifyEmail.resend');
    }
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
