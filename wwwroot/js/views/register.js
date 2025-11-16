// /wwwroot/js/views/register.js

import { api, getAppConfig, setCsrfToken } from "../api.js";
import { hideHeader } from "../header.js";
import { icon, Icons } from "../icons.js";
import { t } from "../i18n.js";

/**
 * Registers the registration route
 * @param {RouteRegisterFn} route - Route registration function
 * @returns {void}
 */
export function registerRegister(route) {
  route("/register", async (el) => {
    const config = await getAppConfig();
    if (config?.application?.showRegisterLinkOnLoginPage === false) {
      location.hash = "/login";
      return;
    }

    // Hide header on register page
    hideHeader();

    el.innerHTML = `
      <div class="auth-container">
        <div class="auth-wrapper">
          <div class="card auth-card">
            
            <div class="auth-header">
              <h1 class="auth-logo">${t('common.appName')}</h1>
              <p class="text-muted">${t('auth.register.title')}</p>
            </div>
            
            <div id="register-success" class="alert alert-success hidden"></div>
            
            <form id="register-form" class="form">
              <div class="form-group">
                <label class="label" for="email">${t('auth.register.email')}</label>
                <input 
                  type="email" 
                  id="email" 
                  name="email" 
                  class="input" 
                  placeholder="${t('auth.login.emailPlaceholder')}"
                  autocomplete="email"
                  required>
              </div>

              <div class="form-group">
                <label class="label" for="username">${t('auth.register.username')}</label>
                <input 
                  type="text" 
                  id="username" 
                  name="username" 
                  class="input" 
                  placeholder="${t('auth.register.username')}"
                  autocomplete="username"
                  required>
              </div>
              
              <div class="form-group">
                <label class="label" for="firstName">${t('auth.register.firstName')} (${t('auth.register.optional')})</label>
                <input 
                  type="text" 
                  id="firstName" 
                  name="firstName" 
                  class="input" 
                  placeholder="${t('auth.register.firstName')}"
                  autocomplete="given-name">
              </div>

              <div class="form-group">
                <label class="label" for="lastName">${t('auth.register.lastName')} (${t('auth.register.optional')})</label>
                <input 
                  type="text" 
                  id="lastName" 
                  name="lastName" 
                  class="input" 
                  placeholder="${t('auth.register.lastName')}"
                  autocomplete="family-name">
              </div>
              
              <div class="form-group">
                <label class="label" for="password">${t('auth.register.password')}</label>
                <div class="input-with-actions">
                  <input 
                    type="password" 
                    id="password" 
                    name="password" 
                    class="input" 
                    placeholder="${t('auth.login.passwordPlaceholder')}"
                    autocomplete="new-password"
                    minlength="12"
                    required>
                  <button type="button" class="input-action-btn" id="toggle-password" aria-label="${t('resetPassword.toggleVisibility')}">
                    ${icon(Icons.EYE, 'icon')}
                  </button>
                </div>
                <p class="form-hint">
                  ${t('auth.register.minLength', { length: 12 })}
                </p>
              </div>

              <div class="form-group">
                <label class="label" for="confirmPassword">${t('auth.register.confirmPassword')}</label>
                <input 
                  type="password" 
                  id="confirmPassword" 
                  name="confirmPassword" 
                  class="input" 
                  placeholder="${t('auth.login.passwordPlaceholder')}"
                  autocomplete="new-password"
                  minlength="12"
                  required>
              </div>
              
              <div id="register-error" class="error hidden"></div>
              
              <button type="submit" class="btn btn-primary btn-block" id="submit-btn">${t('auth.register.createAccount')}</button>
            </form>
            
            <div class="auth-footer">
              <p class="text-muted">${t('auth.register.haveAccount')} <a href="#/login" class="link">${t('auth.register.signIn')}</a></p>
            </div>
          </div>

          <div class="auth-theme-toggle">
            <button class="btn btn-icon" id="auth-theme-toggle" aria-label="${t('common.toggleTheme')}">${getThemeIcon()}</button>
          </div>
        
        </div>
      </div>`;

    const form = /** @type {HTMLFormElement} */ (el.querySelector("#register-form"));
    const errorEl = /** @type {HTMLElement} */ (el.querySelector("#register-error"));
    const successEl = /** @type {HTMLElement} */ (el.querySelector("#register-success"));
    const submitBtn = /** @type {HTMLButtonElement} */ (el.querySelector("#submit-btn"));
    const authThemeToggle = el.querySelector("#auth-theme-toggle");
    const passwordInput = /** @type {HTMLInputElement} */ (el.querySelector("#password"));
    const togglePasswordBtn = el.querySelector("#toggle-password");

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

    // Setup password visibility toggle
    if (togglePasswordBtn && passwordInput) {
      togglePasswordBtn.addEventListener("click", () => {
        const isPassword = passwordInput.type === "password";
        passwordInput.type = isPassword ? "text" : "password";
        togglePasswordBtn.innerHTML = icon(isPassword ? Icons.EYE_OFF : Icons.EYE, 'icon');
      });
    }

    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      errorEl.classList.add("hidden");
      errorEl.textContent = "";
      successEl.classList.add("hidden");
      successEl.innerHTML = "";

      const formData = new FormData(form);
      
      const password = formData.get("password")?.toString() || "";
      const confirmPassword = formData.get("confirmPassword")?.toString() || "";

      // Client-side validation
      if (password !== confirmPassword) {
        errorEl.textContent = t('auth.register.passwordsNoMatch');
        errorEl.classList.remove("hidden");
        return;
      }

      // Password strength validation
      if (password.length < 12) {
        errorEl.textContent = t('validation.minLength', { length: 12 });
        errorEl.classList.remove("hidden");
        return;
      }

      if (!/[A-Z]/.test(password)) {
        errorEl.textContent = t('validation.passwordRequireUppercase');
        errorEl.classList.remove("hidden");
        return;
      }

      if (!/[a-z]/.test(password)) {
        errorEl.textContent = t('validation.passwordRequireLowercase');
        errorEl.classList.remove("hidden");
        return;
      }

      if (!/[0-9]/.test(password)) {
        errorEl.textContent = t('validation.passwordRequireDigit');
        errorEl.classList.remove("hidden");
        return;
      }

      /** @type {RegisterDto} */
      const data = {
        email: formData.get("email")?.toString() || "",
        username: formData.get("username")?.toString() || "",
        password: password,
        firstName: formData.get("firstName")?.toString() || undefined,
        lastName: formData.get("lastName")?.toString() || undefined,
      };

      try {
        /** @type {ApiResponse} */
        const res = await api("/auth/register", {
          method: "POST",
          body: data,
        });

        // Update CSRF token if returned from backend
        if (res?.csrfToken) {
          setCsrfToken(res.csrfToken);
        }

        // Disable form inputs to prevent re-submission
        const inputs = form.querySelectorAll('input, button');
        inputs.forEach(input => {
          /** @type {HTMLInputElement | HTMLButtonElement} */ (input).disabled = true;
        });

        // Show success message in DOM (moved above the form)
        successEl.innerHTML = `
          <strong>${t('common.success')}!</strong> ${res.message}
        `;
        successEl.classList.remove("hidden");
        
        // Redirect after a short delay
        setTimeout(() => {
          location.hash = "/verify-email";
        }, 1500);
      } catch (err) {
        const error = /** @type {Error} */ (err);
        errorEl.textContent = error.message || t('errors.generic');
        errorEl.classList.remove("hidden");
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
