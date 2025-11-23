// /wwwroot/js/views/profile.js

import { api, setCsrfToken } from "../api.js";
import { updateHeader } from "../header.js";
import { icon, Icons } from "../icons.js";
import { t } from "../i18n.js";

/**
 * Registers the profile route
 * @param {RouteRegisterFn} route - Route registration function
 * @returns {void}
 */
export function registerProfile(route) {
  route("/profile", async (el) => {
    try {
      // Fetch current user data first to update header
      /** @type {User} */
      const currentUser = await api("/auth/me");

      // Update header with navigation and profile dropdown
      updateHeader(currentUser);

      // Fetch profile data
      /** @type {ProfileData} */
      const profile = await api("/profile/me");

      // define twoFactorMessage
      let twoFactorMessage = "";
      if (profile.twoFactorEnabled && profile.twoFactorEnforced === 1) {
        twoFactorMessage =
          '<span class="text-muted pr-10">' +
          t("profile.security.twoFactorEnforced") +
          ':</span><span class="badge badge-success">2fa ' +
          t("common.enabled") +
          "</span>";
      } else if (profile.twoFactorEnabled && profile.twoFactorEnforced === 0) {
        twoFactorMessage = twoFactorMessage =
          '<span class="text-muted pr-10">' +
          t("profile.security.twoFactorEnabledAlready") +
          '</span><br><button class="btn btn-danger mt-25" data-action="disable-2fa" id="disable-2fa">' +
          t("profile.security.disable2FA") +
          "</button>";
      } else if (profile.twoFactorEnabled === false) {
        twoFactorMessage =
          '<span class="text-muted pr-10">' +
          t("profile.security.twoFactorRecommended") +
          '</span><br><a href="/#/setup-2fa" class="btn btn-success btn-block mt-25" id="enable-2fa">' +
          t("profile.security.enable2FA") +
          "</a>";
      }

      el.innerHTML = `
        <div class="section">
          <h2 class="section-title">${t("profile.title")}</h2>
          <div class="grid">

          <!-- Account Information -->
          <div class="card mb-10 shadow-md">
            <h3>${t("profile.accountInfo.title")}</h3>
            <div class="form-group form-row">
              <div>
                <span class="text-muted">${t("profile.accountInfo.createdAt")}:</span>
                <strong>${formatDate(profile.createdAt)}</strong>
              </div>
            </div>
            ${
              profile.updatedAt
                ? `
              <div class="form-group form-row">
                <div>
                  <span class="text-muted">${t("common.lastUpdate")}:</span>
                  <strong>${formatDate(profile.updatedAt)}</strong>
                </div>
              </div>
            `
                : ""
            }
            <div class="form-group form-row pb-10">
              <div>
                <span class="text-muted">${t("profile.security.twoFactor")}:</span>
                <strong>${
                  profile.twoFactorEnabled
                    ? '<span class="badge badge-success">' + t("common.enabled") + "</span>"
                    : '<span class="badge">' + t("common.disabled") + "</span>"
                }</strong>
              </div>
            </div>
            <hr class="mt-10 mb-10">
            <h3 class="pt-10">${t("profile.personalInfo.2fainfo")}</h3>
            <div class="form-group form-row">              
              <div>   
                ${twoFactorMessage ? twoFactorMessage : ""}
              </div>
            </div>
          </div>
          
          <!-- Profile Information Card -->
          <div class="card mb-10 shadow-md">
            <h3>${t("profile.personalInfo.title")}</h3>
            <p class="text-muted">${t("home.account.description")}</p>
            
            <form id="profile-form" class="form">
              <div class="form-group">
                <label for="firstName" class="label">${t("profile.personalInfo.firstName")}</label>
                <input 
                  type="text" 
                  id="firstName" 
                  name="firstName" 
                  class="input" 
                  value="${escapeHtml(profile.firstName || "")}"
                  placeholder="${t("profile.personalInfo.firstName")}"
                />
              </div>
              
              <div class="form-group">
                <label for="lastName" class="label">${t("profile.personalInfo.lastName")}</label>
                <input 
                  type="text" 
                  id="lastName" 
                  name="lastName" 
                  class="input" 
                  value="${escapeHtml(profile.lastName || "")}"
                  placeholder="${t("profile.personalInfo.lastName")}"
                />
              </div>
              
              <div class="form-group">
                <label for="email" class="label">${t("profile.personalInfo.email")}</label>
                <input 
                  type="email" 
                  id="email" 
                  name="email" 
                  class="input" 
                  value="${escapeHtml(profile.email || "")}"
                  placeholder="${t("auth.forgotPassword.emailPlaceholder")}"
                  required
                />
                <small class="form-hint">${t("auth.register.optional")}</small>
              </div>
              
              <div id="profile-message"></div>
              
              <button type="submit" class="btn btn-primary">${t("profile.personalInfo.save")}</button>
            </form>
          </div>
          
          <!-- Change Password Card -->
          <div class="card mb-10 shadow-md">
            <h3>${t("profile.security.title")}</h3>
            <p class="text-muted">${t("profile.security.changePassword")}</p>
            
            <form id="password-form" class="form">
              <div class="form-group">
                <label for="currentPassword" class="label">${t("profile.security.currentPassword")}</label>
                <div class="input-with-actions">
                  <input 
                    type="password" 
                    id="currentPassword" 
                    name="currentPassword" 
                    class="input" 
                    placeholder="${t("profile.security.currentPassword")}"
                    required
                    autocomplete="current-password"
                  />
                  <button type="button" class="input-action-btn" data-toggle-password="currentPassword" aria-label="Toggle password visibility">
                    ${icon(Icons.EYE)}
                  </button>
                </div>
              </div>
              
              <div class="form-group">
                <label for="newPassword" class="label">${t("profile.security.newPassword")}</label>
                <div class="input-with-actions">
                  <input 
                    type="password" 
                    id="newPassword" 
                    name="newPassword" 
                    class="input" 
                    placeholder="${t("profile.security.newPassword")}"
                    required
                    autocomplete="new-password"
                    minlength="6"
                  />
                  <button type="button" class="input-action-btn" data-generate-password="newPassword" aria-label="Generate secure password">
                    ${icon(Icons.KEY)}
                  </button>
                  <button type="button" class="input-action-btn" data-toggle-password="newPassword" aria-label="Toggle password visibility">
                    ${icon(Icons.EYE)}
                  </button>
                </div>
                <small class="form-hint">${t("profile.security.newPasswordToShort")}</small>
              </div>
              
              <div class="form-group">
                <label for="confirmPassword" class="label">${t("profile.security.confirmPassword")}</label>
                <div class="input-with-actions">
                  <input 
                    type="password" 
                    id="confirmPassword" 
                    name="confirmPassword" 
                    class="input" 
                    placeholder="${t("profile.security.confirmPassword")}"
                    required
                    autocomplete="new-password"
                    minlength="6"
                  />
                  <button type="button" class="input-action-btn" data-toggle-password="confirmPassword" aria-label="Toggle password visibility">
                    ${icon(Icons.EYE)}
                  </button>                  
                </div>
                <small class="form-hint">${t("common.required")}</small>
              </div>
              
              <div id="password-message"></div>
              
              <button type="submit" class="btn btn-primary">${t("profile.security.changePassword")}</button>
            </form>
          </div>
          
          
          </div>
        </div>`;

      // Handle profile form submission
      const profileForm = /** @type {HTMLFormElement} */ (el.querySelector("#profile-form"));
      if (profileForm) {
        profileForm.addEventListener("submit", async (e) => {
          e.preventDefault();
          await handleProfileUpdate(el, profile);
        });
      }

      // Handle password form submission
      const passwordForm = /** @type {HTMLFormElement} */ (el.querySelector("#password-form"));
      if (passwordForm) {
        passwordForm.addEventListener("submit", async (e) => {
          e.preventDefault();
          await handlePasswordChange(el);
        });
      }

      // handle 2fa deaktivate button klick
      const deactivate2faButton = el.querySelector("#disable-2fa");
      if (deactivate2faButton) {
        deactivate2faButton.addEventListener("click", async (e) => {
          e.preventDefault();
          await handle2faDeactivate(el, profile);
        });
      }

      // Setup password visibility toggles
      setupPasswordToggles(el);

      // Setup password generator
      setupPasswordGenerator(el);
    } catch (err) {
      const error = /** @type {Error} */ (err);

      // If unauthorized, redirect to login
      if (error.message.includes("Unauthorized") || error.message.includes("401") || error.message.includes("403")) {
        location.hash = "/login";
        return;
      }

      el.innerHTML = `
        <div class="section">
          <div class="alert alert-danger">
            <strong>Error:</strong> ${escapeHtml(error.message || t("profile.errors.failedToLoadProfile"))}
          </div>
        </div>`;
    }
  });
}

/**
 * Handles 2FA deactivation
 * @param {HTMLElement} el - Container element
 * @param {ProfileData} currentProfile - Current profile data
 * @returns {Promise<void>}
 */
async function handle2faDeactivate(el, currentProfile) {
  const messageEl = /** @type {HTMLElement} */ (el.querySelector("#profile-message"));
  if (!messageEl) return;

  // Clear previous messages
  messageEl.innerHTML = "";
  messageEl.className = "";

  try {
    const res = await api("/auth/2fa/disable", {
      method: "POST",
      body: {
        id: currentProfile.id,
      },
    });

    // Update CSRF token if returned
    if (res?.csrfToken) {
      setCsrfToken(res.csrfToken);
    }

    messageEl.textContent = t("profile.security.twoFactorDisabledSuccess");
    messageEl.className = "alert alert-success";

    // Reload page after a short delay to show updated data
    setTimeout(() => {
      location.reload();
    }, 1500)
  } catch (err) {
    const error = /** @type {Error} */ (err);
    messageEl.textContent = error.message;
    messageEl.className = "alert alert-danger";
  }
}

/**
 * Handles profile update form submission
 * @param {HTMLElement} el - Container element
 * @param {ProfileData} currentProfile - Current profile data
 * @returns {Promise<void>}
 */
async function handleProfileUpdate(el, currentProfile) {
  const messageEl = /** @type {HTMLElement} */ (el.querySelector("#profile-message"));
  if (!messageEl) return;

  // Clear previous messages
  messageEl.innerHTML = "";
  messageEl.className = "";

  const form = /** @type {HTMLFormElement} */ (el.querySelector("#profile-form"));
  if (!form) return;

  const firstNameInput = /** @type {HTMLInputElement} */ (form.querySelector("#firstName"));
  const lastNameInput = /** @type {HTMLInputElement} */ (form.querySelector("#lastName"));
  const emailInput = /** @type {HTMLInputElement} */ (form.querySelector("#email"));

  if (!emailInput) return;

  const firstName = firstNameInput?.value.trim() || "";
  const lastName = lastNameInput?.value.trim() || "";
  const email = emailInput.value.trim();

  // Validate email
  if (!email) {
    messageEl.textContent = t("profile.security.emailRequired");
    messageEl.className = "alert alert-danger";
    return;
  }

  try {
    /** @type {UpdateProfileDto} */
    const dto = {
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      email: email !== currentProfile.email ? email : undefined,
    };

    // Only send if there are changes
    if (!dto.firstName && !dto.lastName && !dto.email) {
      messageEl.textContent = t("profile.security.noChangesDetected");
      messageEl.className = "alert alert-info";
      return;
    }

    /** @type {ProfileUpdateResponse} */
    const res = await api("/profile/update", {
      method: "PUT",
      body: dto,
    });

    // Update CSRF token if returned
    if (res?.csrfToken) {
      setCsrfToken(res.csrfToken);
    }

    // If email was changed, redirect to login
    if (res.emailChanged) {
      messageEl.textContent = res.message || t("profile.security.successUpdateProfileLogin");
      messageEl.className = "alert alert-success";

      setTimeout(() => {
        location.hash = "/login";
      }, 2000);
      return;
    }

    messageEl.textContent = res.message || t("profile.security.successUpdateProfile");
    messageEl.className = "alert alert-success";

    // Reload page after a short delay to show updated data
    setTimeout(() => {
      location.reload();
    }, 1500);
  } catch (err) {
    const error = /** @type {Error} */ (err);
    messageEl.textContent = error.message || t("profile.security.failedUpdateProfile");
    messageEl.className = "alert alert-danger";
  }
}

/**
 * Handles password change form submission
 * @param {HTMLElement} el - Container element
 * @returns {Promise<void>}
 */
async function handlePasswordChange(el) {
  const messageEl = /** @type {HTMLElement} */ (el.querySelector("#password-message"));
  if (!messageEl) return;

  // Clear previous messages
  messageEl.innerHTML = "";
  messageEl.className = "";

  const form = /** @type {HTMLFormElement} */ (el.querySelector("#password-form"));
  if (!form) return;

  const currentPasswordInput = /** @type {HTMLInputElement} */ (form.querySelector("#currentPassword"));
  const newPasswordInput = /** @type {HTMLInputElement} */ (form.querySelector("#newPassword"));
  const confirmPasswordInput = /** @type {HTMLInputElement} */ (form.querySelector("#confirmPassword"));

  if (!currentPasswordInput || !newPasswordInput || !confirmPasswordInput) return;

  const currentPassword = currentPasswordInput.value;
  const newPassword = newPasswordInput.value;
  const confirmPassword = confirmPasswordInput.value;

  // Validate passwords
  if (!currentPassword || !newPassword || !confirmPassword) {
    messageEl.textContent = t("profile.security.allPwFieldsRequired");
    messageEl.className = "alert alert-danger";
    return;
  }

  if (newPassword !== confirmPassword) {
    messageEl.textContent = t("profile.security.newPasswordNotMatch");
    messageEl.className = "alert alert-danger";
    return;
  }

  if (newPassword.length < 6) {
    messageEl.textContent = t("profile.security.newPasswordToShort");
    messageEl.className = "alert alert-danger";
    return;
  }

  if (currentPassword === newPassword) {
    messageEl.textContent = t("profile.security.newPasswordNotDifferent");
    messageEl.className = "alert alert-danger";
    return;
  }

  try {
    /** @type {ChangePasswordDto} */
    const dto = {
      currentPassword: currentPassword,
      newPassword: newPassword,
    };

    /** @type {ApiResponse} */
    const res = await api("/profile/change-password", {
      method: "PUT",
      body: dto,
    });

    // Update CSRF token if returned
    if (res?.csrfToken) {
      setCsrfToken(res.csrfToken);
    }

    if (res.ok) {
      // Clear form
      form.reset();

      messageEl.textContent = res.message || t("profile.security.successChangePwLogin");
      messageEl.className = "alert alert-success";

      setTimeout(() => {
        location.hash = "/login";
      }, 2000);
      return;
    }
    
  } catch (err) {
    const error = /** @type {Error} */ (err);
    messageEl.textContent = error.message || t("errors.pwChangeError");
    messageEl.className = "alert alert-danger";
  }
}

/**
 * Sets up password visibility toggle buttons
 * @param {HTMLElement} el - Container element
 * @returns {void}
 */
function setupPasswordToggles(el) {
  const toggleButtons = el.querySelectorAll("[data-toggle-password]");

  toggleButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const targetId = button.getAttribute("data-toggle-password");
      if (!targetId) return;

      const input = /** @type {HTMLInputElement|null} */ (el.querySelector(`#${targetId}`));
      if (!input) return;

      const isPassword = input.type === "password";
      input.type = isPassword ? "text" : "password";
      button.innerHTML = isPassword ? icon(Icons.EYE_OFF) : icon(Icons.EYE);
      button.setAttribute("aria-label", isPassword ? t("common.hidePwd") : t("common.showPwd"));
    });
  });
}

/**
 * Sets up password generator button
 * @param {HTMLElement} el - Container element
 * @returns {void}
 */
function setupPasswordGenerator(el) {
  const generateButtons = el.querySelectorAll("[data-generate-password]");

  generateButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const targetId = button.getAttribute("data-generate-password");
      if (!targetId) return;

      const input = /** @type {HTMLInputElement|null} */ (el.querySelector(`#${targetId}`));
      if (!input) return;

      // Generate secure password
      const password = generateSecurePassword();
      input.value = password;

      // Show password temporarily
      input.type = "text";
      const toggleBtn = /** @type {HTMLButtonElement|null} */ (
        el.querySelector(`[data-toggle-password="${targetId}"]`)
      );
      if (toggleBtn) {
        toggleBtn.innerHTML = icon(Icons.EYE_OFF);
        toggleBtn.setAttribute("aria-label", "Hide password");
      }

      // Copy to clipboard
      navigator.clipboard
        .writeText(password)
        .then(() => {
          // Show visual feedback
          const originalHtml = button.innerHTML;
          button.innerHTML = icon(Icons.CHECK);
          setTimeout(() => {
            button.innerHTML = originalHtml;
          }, 2000);
        })
        .catch(() => {
          // Silently fail if clipboard access denied
        });
    });
  });
}

/**
 * Generates a secure random password
 * @returns {string} Generated password (16 characters)
 */
function generateSecurePassword() {
  const length = 16;
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  const values = new Uint32Array(length);
  window.crypto.getRandomValues(values);

  let password = "";
  for (let i = 0; i < length; i++) {
    password += charset[values[i] % charset.length];
  }

  // Ensure at least one of each type
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*]/.test(password);

  // If missing any character type, regenerate
  if (!hasLower || !hasUpper || !hasDigit || !hasSpecial) {
    return generateSecurePassword();
  }

  return password;
}

/**
 * Formats an ISO date string to a readable format
 * @param {string} dateString - ISO date string
 * @returns {string} Formatted date
 */
function formatDate(dateString) {
  if (!dateString) return "N/A";

  const date = new Date(dateString);
  const options = /** @type {Intl.DateTimeFormatOptions} */ ({
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return date.toLocaleDateString("en-US", options);
}

/**
 * Escapes HTML special characters to prevent XSS
 * @param {string|null|undefined} str - String to escape
 * @returns {string} Escaped string
 */
function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/[&<>"']/g, (char) => {
    /** @type {Record<string, string>} */
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return map[char];
  });
}
