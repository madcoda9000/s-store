// /wwwroot/js/views/reset-password.js

import { api, setCsrfToken } from "../api.js";
import { hideHeader } from "../header.js";
import { icon, Icons } from "../icons.js";
import { t } from "../i18n.js";

/**
 * Registers the reset password route
 * @param {RouteRegisterFn} route - Route registration function
 * @returns {void}
 */
export function registerResetPassword(route) {
  route("/reset-password", (el) => {
    // Hide header on auth page
    hideHeader();

    // Get URL parameters
    const params = new URLSearchParams(location.hash.split('?')[1] || '');
    const tokenFromUrl = params.get('token') || '';
    const emailFromUrl = params.get('email') || '';

    el.innerHTML = `
      <div class="auth-container">
        <div class="auth-wrapper">
          <div class="card auth-card">
            
            <div class="auth-header">
              <h1 class="auth-logo">${t('common.appName')}</h1>
              <p class="text-muted">${t('auth.resetPassword.title')}</p>
            </div>
            
            <form id="reset-password-form" class="form">
              <div class="form-group">
                <label class="label" for="email">${t('auth.resetPassword.email')}</label>
                <input 
                  type="email" 
                  id="email" 
                  name="email" 
                  class="input" 
                  placeholder="${t('auth.forgotPassword.emailPlaceholder')}"
                  autocomplete="email"
                  value="${emailFromUrl}"
                  required>
              </div>
              
              ${!tokenFromUrl ? `
              <div class="form-group">
                <label class="label" for="code">${t('auth.resetPassword.code')}</label>
                <input 
                  type="text" 
                  id="code" 
                  name="code" 
                  class="input" 
                  placeholder="123456"
                  maxlength="6"
                  pattern="[0-9]{6}"
                  autocomplete="off"
                  required>
                <span class="form-hint">${t('auth.resetPassword.codeHint')}</span>
              </div>
              ` : ''}
              
              <div class="form-group">
                <label class="label" for="password">${t('auth.resetPassword.newPassword')}</label>
                <div class="input-with-actions" style="--action-btn-count: 2;">
                  <input 
                    type="password" 
                    id="password" 
                    name="password" 
                    class="input" 
                    placeholder="${t('auth.login.passwordPlaceholder')}"
                    autocomplete="new-password"
                    minlength="8"
                    required>
                  <button type="button" class="input-action-btn" id="generate-password" title="${t('auth.resetPassword.generatePassword')}">
                    ${icon(Icons.KEY, 'icon')}
                  </button>
                  <button type="button" class="input-action-btn" id="toggle-password" title="${t('auth.resetPassword.toggleVisibility')}">
                    ${icon(Icons.EYE, 'icon')}
                  </button>
                </div>
                <span class="form-hint">${t('auth.resetPassword.minLength')}</span>
              </div>
              
              <div class="form-group">
                <label class="label" for="confirm-password">${t('auth.resetPassword.confirmPassword')}</label>
                <input 
                  type="password" 
                  id="confirm-password" 
                  name="confirm-password" 
                  class="input" 
                  placeholder="${t('auth.login.passwordPlaceholder')}"
                  autocomplete="new-password"
                  minlength="8"
                  required>
              </div>
              
              <input type="hidden" name="token" value="${tokenFromUrl}">
              
              <div id="reset-password-error" class="error hidden"></div>
              <div id="reset-password-success" class="alert alert-success hidden"></div>
              
              <button type="submit" class="btn btn-primary btn-block">${t('auth.resetPassword.resetPassword')}</button>
            </form>
            
            <div class="auth-footer">
              <p class="text-muted">
                <a href="#/login" class="link">${t('auth.resetPassword.backToLogin')}</a> • 
                <a href="#/forgot-password" class="link">${t('auth.resetPassword.resendLink')}</a>
              </p>
            </div>
          </div>

          <div class="auth-theme-toggle">
            <button class="btn btn-icon" id="auth-theme-toggle" aria-label="${t('common.toggleTheme')}">${getThemeIcon()}</button>
          </div>
        
        </div>
      </div>`;

    const form = /** @type {HTMLFormElement} */ (el.querySelector("#reset-password-form"));
    const errorEl = /** @type {HTMLElement} */ (el.querySelector("#reset-password-error"));
    const successEl = /** @type {HTMLElement} */ (el.querySelector("#reset-password-success"));
    const authThemeToggle = el.querySelector("#auth-theme-toggle");
    const submitBtn = /** @type {HTMLButtonElement} */ (form.querySelector('button[type="submit"]'));
    const passwordInput = /** @type {HTMLInputElement} */ (el.querySelector("#password"));
    const confirmPasswordInput = /** @type {HTMLInputElement} */ (el.querySelector("#confirm-password"));
    const togglePasswordBtn = el.querySelector("#toggle-password");
    const generatePasswordBtn = el.querySelector("#generate-password");

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

    // Password visibility toggle
    if (togglePasswordBtn) {
      togglePasswordBtn.addEventListener("click", () => {
        const isPassword = passwordInput.type === "password";
        passwordInput.type = isPassword ? "text" : "password";
        confirmPasswordInput.type = isPassword ? "text" : "password";
        togglePasswordBtn.innerHTML = isPassword 
          ? icon(Icons.EYE_OFF, 'icon')
          : icon(Icons.EYE, 'icon');
      });
    }

    // Password generator
    if (generatePasswordBtn) {
      generatePasswordBtn.addEventListener("click", () => {
        const newPassword = generateSecurePassword();
        passwordInput.value = newPassword;
        confirmPasswordInput.value = newPassword;
        passwordInput.type = "text";
        confirmPasswordInput.type = "text";
        if (togglePasswordBtn) {
          togglePasswordBtn.innerHTML = icon(Icons.EYE_OFF, 'icon');
        }
      });
    }

    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      errorEl.classList.add("hidden");
      errorEl.textContent = "";
      successEl.classList.add("hidden");
      successEl.textContent = "";

      const formData = new FormData(form);
      const password = formData.get("password")?.toString() || "";
      const confirmPassword = formData.get("confirm-password")?.toString() || "";

      // Validate passwords match
      if (password !== confirmPassword) {
        errorEl.textContent = t('auth.resetPassword.passwordsNoMatch');
        errorEl.classList.remove("hidden");
        return;
      }

      /** @type {ResetPasswordDto} */
      const data = {
        email: formData.get("email")?.toString() || "",
        token: formData.get("token")?.toString() || "",
        code: formData.get("code")?.toString() || "",
        newPassword: password,
      };

      // Disable submit button during request
      submitBtn.disabled = true;
      submitBtn.textContent = t('auth.resetPassword.resetting');

      try {
        /** @type {ApiResponse} */
        const res = await api("/auth/reset-password", {
          method: "POST",
          body: data,
        });

        // Update CSRF token if returned from backend
        if (res?.csrfToken) {
          setCsrfToken(res.csrfToken);
        }

        // Show success message
        successEl.textContent = res?.message || t('auth.resetPassword.successMessage');
        successEl.classList.remove("hidden");

        // Clear form
        form.reset();

        // Redirect to login after 2 seconds
        setTimeout(() => {
          location.hash = "/login";
        }, 2000);
      } catch (err) {
        const error = /** @type {Error} */ (err);
        errorEl.textContent = error.message || t('errors.generic');
        errorEl.classList.remove("hidden");

        // Re-enable submit button
        submitBtn.disabled = false;
        submitBtn.textContent = t('auth.resetPassword.resetPassword');
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

/**
 * Generates a secure random password
 * @returns {string} Generated password
 */
function generateSecurePassword() {
  const length = 16;
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  const allChars = uppercase + lowercase + numbers + symbols;
  
  let password = '';
  
  // Ensure at least one of each type
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];
  
  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}
