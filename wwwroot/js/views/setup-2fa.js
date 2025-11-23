// /wwwroot/js/views/setup-2fa.js

import { api, setCsrfToken } from "../api.js";
import { hideHeader, updateHeader } from "../header.js";
import { icon, Icons } from "../icons.js";
import { t } from "../i18n.js";

/**
 * @typedef {Object} Setup2faState
 * @property {'selection'|'authenticator'|'email'|'recovery'|'success'} currentStep
 * @property {'enforced'|'optional'} mode
 * @property {string|null} selectedMethod
 * @property {string|null} qrCodeUrl
 * @property {string|null} manualKey
 * @property {boolean} codeSent
 * @property {string[]|null} recoveryCodes
 */

/**
 * Registers the setup 2FA route
 * @param {RouteRegisterFn} route - Route registration function
 * @returns {void}
 */
export function registerSetup2fa(route) {
  route("/setup-2fa", async (el) => {
    try {
      // Fetch current user
      /** @type {User} */
      const user = await api("/auth/me");

      // Determine mode based on enforcement
      const isEnforced = user.twoFactorEnforced === 1;

      // Hide header if enforced (user can't navigate away)
      if (isEnforced) {
        hideHeader();
      } else {
        updateHeader(user);
      }

      /** @type {Setup2faState} */
      const state = {
        currentStep: "selection",
        mode: isEnforced ? "enforced" : "optional",
        selectedMethod: null,
        qrCodeUrl: null,
        manualKey: null,
        codeSent: false,
        recoveryCodes: null,
      };

      await renderStep(el, state);
    } catch (err) {
      const error = /** @type {Error} */ (err);

      if (error.message.includes("Unauthorized") || error.message.includes("401")) {
        location.hash = "/login";
        return;
      }

      el.innerHTML = renderError(error.message);
    }
  });
}

/**
 * Renders the current step
 * @param {HTMLElement} el - Container element
 * @param {Setup2faState} state - Current state
 * @returns {Promise<void>}
 */
async function renderStep(el, state) {
  switch (state.currentStep) {
    case "selection":
      renderMethodSelection(el, state);
      break;
    case "authenticator":
      renderAuthenticatorSetup(el, state);
      break;
    case "email":
      await renderEmailSetup(el, state);
      break;
    case "recovery":
      renderRecoveryCodes(el, state);
      break;
    case "success":
      renderSuccess(el, state);
      break;
  }
}

/**
 * Renders method selection screen
 * @param {HTMLElement} el - Container element
 * @param {Setup2faState} state - Current state
 * @returns {void}
 */
function renderMethodSelection(el, state) {
  const isEnforced = state.mode === "enforced";

  if (isEnforced) {
    // Enforced mode: Use auth-style centered layout
    el.innerHTML = `
      <div class="auth-container">
        <div class="auth-wrapper">
          <div class="card auth-card shadow-lg">
            <div class="auth-header">
              <h2>${t("auth.setup2fa.title")}</h2>
              <p">
              <div class="alert alert-info">  
                ${t("auth.setup2fa.enforcedNotice")}
              </div>
              </p>
            </div>
            
            <div class="mb-25">
              <p class="text-muted">${t("auth.setup2fa.description")}</p>
            </div>
            
            <h4 class="mb-25">${t("auth.setup2fa.chooseMethod")}</h4>
            
            <!-- Authenticator Method -->
            <div class="card mb-25">
              <h4 class="mb-10">
                ${icon(Icons.SHIELD_CHECK, "icon icon-lg mr-5")}
                ${t("auth.setup2fa.authenticatorMethod.title")}
                <span class="badge badge-success ml-10">${t("auth.setup2fa.authenticatorMethod.recommended")}</span>
              </h4>              
              <p class="text-muted mb-10">${t("auth.setup2fa.authenticatorMethod.description")}</p>
              <button type="button" class="btn btn-success btn-block" data-select-method="authenticator">
                ${t("auth.setup2fa.authenticatorMethod.selectButton")}
              </button>
            </div>
            
            <!-- Email Method -->
            <div class="card">
              <h4 class="mb-10">
                ${icon(Icons.MAIL, "icon icon-lg mr-5")}
                ${t("auth.setup2fa.emailMethod.title")}
                <span class="badge badge-warning ml-10">${t("auth.setup2fa.authenticatorMethod.notRecommended")}</span>
              </h4>
              <p class="text-muted mb-10">${t("auth.setup2fa.emailMethod.description")}</p>
              <button type="button" class="btn btn-warning btn-block" data-select-method="email">
                ${t("auth.setup2fa.emailMethod.selectButton")}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  } else {
    // Optional mode: Use normal section layout with header
    el.innerHTML = `
      <div class="section">
        <div class="section-header">
          <h2 class="section-title mb-0">${t("auth.setup2fa.title")}</h2>
        </div>
        
        <p class="text-muted mb-25">${t("auth.setup2fa.description")}</p>
        
        <h4 class="mt-25 mb-25">${t("auth.setup2fa.chooseMethod")}</h4>
        
        <div class="grid">
          <!-- Authenticator Method -->
          <div class="card">
            <h4>
              ${icon(Icons.SHIELD_CHECK, "icon icon-lg mr-5")}
              ${t("auth.setup2fa.authenticatorMethod.title")}
              <span class="badge badge-success ml-10">${t("auth.setup2fa.authenticatorMethod.recommended")}</span>
            </h4>            
            <p class="text-muted mb-25">${t("auth.setup2fa.authenticatorMethod.description")}</p>
            <button type="button" class="btn btn-success btn-block" data-select-method="authenticator">
              ${t("auth.setup2fa.authenticatorMethod.selectButton")}
            </button>
          </div>
          
          <!-- Email Method -->
          <div class="card">
            <h4>
              ${icon(Icons.MAIL, "icon icon-lg mr-5")}
              ${t("auth.setup2fa.emailMethod.title")}
              <span class="badge badge-warning ml-10">${t("auth.setup2fa.authenticatorMethod.notRecommended")}</span>
            </h4>
            <p class="text-muted mb-25">${t("auth.setup2fa.emailMethod.description")}</p>
            <button type="button" class="btn btn-warning btn-block" data-select-method="email">
              ${t("auth.setup2fa.emailMethod.selectButton")}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // Event handlers
  el.querySelectorAll("[data-select-method]").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const method = /** @type {HTMLElement} */ (e.target).closest("button")?.getAttribute("data-select-method");
      if (method === "authenticator") {
        state.selectedMethod = "Authenticator";
        state.currentStep = "authenticator";
        await initAuthenticatorSetup(el, state);
      } else if (method === "email") {
        state.selectedMethod = "Email";
        state.currentStep = "email";
        await renderStep(el, state);
      }
    });
  });
}

/**
 * Initializes authenticator setup by fetching QR code
 * @param {HTMLElement} el - Container element
 * @param {Setup2faState} state - Current state
 * @returns {Promise<void>}
 */
async function initAuthenticatorSetup(el, state) {
  try {
    const response = await api("/auth/2fa/setup-authenticator", {
      method: "POST",
    });

    if (response.csrfToken) {
      setCsrfToken(response.csrfToken);
    }

    state.qrCodeUrl = response.otpauth;
    state.manualKey = response.key;
    await renderStep(el, state);
  } catch (err) {
    const error = /** @type {Error} */ (err);
    alert(error.message || t("auth.setup2fa.errors.setupFailed"));
    state.currentStep = "selection";
    await renderStep(el, state);
  }
}

/**
 * Renders authenticator setup screen
 * @param {HTMLElement} el - Container element
 * @param {Setup2faState} state - Current state
 * @returns {void}
 */
function renderAuthenticatorSetup(el, state) {
  const showBackButton = state.mode === "optional";
  const containerClass = state.mode === "enforced" ? "auth-container" : "container";

  el.innerHTML = `
    <div class="${containerClass}">
      <div class="auth-wrapper">
        <div class="card auth-card shadow-lg">
          <div class="auth-header">
            <h2>${t("auth.setup2fa.authenticatorSetup.title")}</h2>
          </div>
          
          <!-- Step 1: QR Code -->
          <div class="mb-25">
            <h4 class="mb-10">${t("auth.setup2fa.authenticatorSetup.step1")}</h4>
            <p class="text-muted mb-25">${t("auth.setup2fa.authenticatorSetup.step1Description")}</p>
            
            <div class="text-center mb-25">
              <div id="qr-code" class="card d-inline-block p-25"></div>
            </div>
            
            <p class="text-muted mb-10">${t("auth.setup2fa.authenticatorSetup.step1Alt")}</p>
            <div class="form-group">
              <div class="input-with-actions">
                <input 
                  type="text" 
                  id="manual-key" 
                  class="input" 
                  value="${escapeHtml(state.manualKey || "")}" 
                  readonly
                />
                <button type="button" class="input-action-btn" id="copy-key-btn" aria-label="${t(
                  "auth.setup2fa.authenticatorSetup.copyKey"
                )}">
                  ${icon(Icons.COPY)}
                </button>
              </div>
            </div>
          </div>
          
          <!-- Step 2: Verify -->
          <div>
            <h4 class="mb-10">${t("auth.setup2fa.authenticatorSetup.step2")}</h4>
            <p class="text-muted mb-25">${t("auth.setup2fa.authenticatorSetup.step2Description")}</p>
            
            <form id="verify-authenticator-form" class="form">
              <div class="form-group">
                <label class="label" for="code">${t("auth.setup2fa.authenticatorSetup.code")}</label>
                <input 
                  type="text" 
                  id="code" 
                  name="code"
                  class="input" 
                  placeholder="${t("auth.setup2fa.authenticatorSetup.codePlaceholder")}"
                  maxlength="6"
                  pattern="[0-9]{6}"
                  inputmode="numeric"
                  autocomplete="one-time-code"
                  required
                />
              </div>
              
              <div id="verify-error" class="error hidden"></div>
              
              <div class="button-group">
                ${
                  showBackButton
                    ? `
                  <button type="button" class="btn btn-secondary" id="back-btn">
                    ${icon(Icons.ARROW_LEFT, "icon")} ${t("auth.setup2fa.authenticatorSetup.backButton")}
                  </button>
                `
                    : ""
                }
                <button type="submit" class="btn btn-primary flex-1">
                  ${t("auth.setup2fa.authenticatorSetup.verifyButton")}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  `;

  // Generate QR code
  const qrContainer = el.querySelector("#qr-code");
  if (qrContainer && state.qrCodeUrl) {
    const qr = document.createElement("img");
    qr.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(state.qrCodeUrl)}`;
    qr.alt = "QR Code";
    qr.style.maxWidth = "200px";
    qrContainer.appendChild(qr);
  }

  // Copy key handler
  const copyBtn = el.querySelector("#copy-key-btn");
  if (copyBtn) {
    copyBtn.addEventListener("click", async () => {
      const keyInput = /** @type {HTMLInputElement} */ (el.querySelector("#manual-key"));
      if (keyInput) {
        try {
          await navigator.clipboard.writeText(keyInput.value);
          copyBtn.innerHTML = icon(Icons.CHECK);
          setTimeout(() => {
            copyBtn.innerHTML = icon(Icons.COPY);
          }, 2000);
        } catch {
          keyInput.select();
          document.execCommand("copy");
        }
      }
    });
  }

  // Back button (only in optional mode)
  if (showBackButton) {
    const backBtn = el.querySelector("#back-btn");
    if (backBtn) {
      backBtn.addEventListener("click", async () => {
        state.currentStep = "selection";
        state.selectedMethod = null;
        state.qrCodeUrl = null;
        state.manualKey = null;
        await renderStep(el, state);
      });
    }
  }

  // Form submission
  const form = /** @type {HTMLFormElement} */ (el.querySelector("#verify-authenticator-form"));
  const errorEl = /** @type {HTMLElement} */ (el.querySelector("#verify-error"));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.classList.add("hidden");

    const formData = new FormData(form);
    const code = formData.get("code")?.toString() || "";

    const submitBtn = /** @type {HTMLButtonElement} */ (form.querySelector('button[type="submit"]'));
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = t("auth.setup2fa.authenticatorSetup.verifying");

    try {
      const response = await api("/auth/2fa/verify-authenticator-setup", {
        method: "POST",
        body: { Code: code },
      });

      if (response.csrfToken) {
        setCsrfToken(response.csrfToken);
      }

      state.recoveryCodes = response.recoveryCodes;
      state.currentStep = "recovery";
      await renderStep(el, state);
    } catch (err) {
      const error = /** @type {Error} */ (err);
      errorEl.textContent = error.message || t("auth.setup2fa.errors.invalidCode");
      errorEl.classList.remove("hidden");
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  });
}

/**
 * Renders email setup screen
 * @param {HTMLElement} el - Container element
 * @param {Setup2faState} state - Current state
 * @returns {Promise<void>}
 */
async function renderEmailSetup(el, state) {
  const showBackButton = state.mode === "optional";
  const containerClass = state.mode === "enforced" ? "auth-container" : "container";

  // Fetch user email for display
  let userEmail = "";
  try {
    const user = await api("/auth/me");
    userEmail = user.email || "";
  } catch {
    userEmail = "";
  }

  el.innerHTML = `
    <div class="${containerClass}">
      <div class="auth-wrapper">
        <div class="card auth-card shadow-lg">
          <div class="auth-header">
            <h2>${t("auth.setup2fa.emailSetup.title")}</h2>
          </div>
          
          ${
            !state.codeSent
              ? `
            <!-- Step 1: Request Code -->
            <div>
              <h4 class="mb-10">${t("auth.setup2fa.emailSetup.step1")}</h4>
              <p class="text-muted mb-25">${t("auth.setup2fa.emailSetup.step1Description")}</p>
              
              <div class="form-group">
                <input 
                  type="email" 
                  class="input" 
                  value="${escapeHtml(userEmail)}" 
                  disabled
                />
              </div>
              
              <div id="send-error" class="error hidden"></div>
              
              <div class="button-group">
                ${
                  showBackButton
                    ? `
                  <button type="button" class="btn btn-secondary" id="back-btn">
                    ${icon(Icons.ARROW_LEFT, "icon")} ${t("auth.setup2fa.emailSetup.backButton")}
                  </button>
                `
                    : ""
                }
                <button type="button" class="btn btn-primary flex-1 mt-25" id="send-code-btn">
                  ${t("auth.setup2fa.emailSetup.sendCodeButton")}
                </button>
              </div>
            </div>
          `
              : `
            <!-- Step 2: Verify Code -->
            <div>
              <div class="alert alert-success mb-25">
                ${icon(Icons.MAIL, "icon")} ${t("auth.setup2fa.emailSetup.codeSent")}
              </div>
              
              <h4 class="mb-10">${t("auth.setup2fa.emailSetup.step2")}</h4>
              <p class="text-muted mb-25">${t("auth.setup2fa.emailSetup.step2Description")}</p>
              
              <form id="verify-email-form" class="form">
                <div class="form-group">
                  <label class="label" for="code">${t("auth.setup2fa.emailSetup.code")}</label>
                  <input 
                    type="text" 
                    id="code" 
                    name="code"
                    class="input" 
                    placeholder="${t("auth.setup2fa.emailSetup.codePlaceholder")}"
                    maxlength="6"
                    pattern="[0-9]{6}"
                    inputmode="numeric"
                    autocomplete="one-time-code"
                    required
                  />
                </div>
                
                <div id="verify-error" class="error hidden"></div>
                
                <div class="button-group">
                  <button type="button" class="btn btn-secondary" id="resend-btn">
                    ${icon(Icons.REFRESH_CW, "icon")} ${t("auth.setup2fa.emailSetup.resendButton")}
                  </button>
                  <button type="submit" class="btn btn-primary flex-1">
                    ${t("auth.setup2fa.emailSetup.verifyButton")}
                  </button>
                </div>
              </form>
            </div>
          `
          }
        </div>
      </div>
    </div>
  `;

  // Back button (step 1, only in optional mode)
  if (!state.codeSent && showBackButton) {
    const backBtn = el.querySelector("#back-btn");
    if (backBtn) {
      backBtn.addEventListener("click", async () => {
        state.currentStep = "selection";
        state.selectedMethod = null;
        state.codeSent = false;
        await renderStep(el, state);
      });
    }
  }

  // Send code button (step 1)
  const sendBtn = el.querySelector("#send-code-btn");
  if (sendBtn) {
    sendBtn.addEventListener("click", async () => {
      const errorEl = /** @type {HTMLElement} */ (el.querySelector("#send-error"));
      errorEl.classList.add("hidden");

      const btn = /** @type {HTMLButtonElement} */ (sendBtn);
      const originalText = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = t("auth.setup2fa.emailSetup.sending");

      try {
        const response = await api("/auth/2fa/setup-email", {
          method: "POST",
        });

        if (response.csrfToken) {
          setCsrfToken(response.csrfToken);
        }

        state.codeSent = true;
        await renderStep(el, state);
      } catch (err) {
        const error = /** @type {Error} */ (err);
        errorEl.textContent = error.message || t("auth.setup2fa.errors.emailSendFailed");
        errorEl.classList.remove("hidden");
        btn.disabled = false;
        btn.innerHTML = originalText;
      }
    });
  }

  // Resend button (step 2)
  const resendBtn = el.querySelector("#resend-btn");
  if (resendBtn) {
    resendBtn.addEventListener("click", async () => {
      const btn = /** @type {HTMLButtonElement} */ (resendBtn);
      const originalText = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = t("auth.setup2fa.emailSetup.sending");

      try {
        const response = await api("/auth/2fa/setup-email", {
          method: "POST",
        });

        if (response.csrfToken) {
          setCsrfToken(response.csrfToken);
        }

        btn.innerHTML = `${icon(Icons.CHECK, "icon")} ${t("auth.setup2fa.emailSetup.codeSent")}`;
        setTimeout(() => {
          btn.disabled = false;
          btn.innerHTML = originalText;
        }, 3000);
      } catch {
        btn.disabled = false;
        btn.innerHTML = originalText;
      }
    });
  }

  // Verify form (step 2)
  const form = /** @type {HTMLFormElement|null} */ (el.querySelector("#verify-email-form"));
  if (form) {
    const errorEl = /** @type {HTMLElement} */ (el.querySelector("#verify-error"));

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      errorEl.classList.add("hidden");

      const formData = new FormData(form);
      const code = formData.get("code")?.toString() || "";

      const submitBtn = /** @type {HTMLButtonElement} */ (form.querySelector('button[type="submit"]'));
      const originalText = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = t("auth.setup2fa.emailSetup.verifying");

      try {
        const response = await api("/auth/2fa/verify-email-setup", {
          method: "POST",
          body: { Code: code },
        });

        if (response.csrfToken) {
          setCsrfToken(response.csrfToken);
        }

        state.recoveryCodes = response.recoveryCodes;
        state.currentStep = "recovery";
        await renderStep(el, state);
      } catch (err) {
        const error = /** @type {Error} */ (err);
        errorEl.textContent = error.message || t("auth.setup2fa.errors.invalidCode");
        errorEl.classList.remove("hidden");
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
    });
  }
}

/**
 * Renders recovery codes screen
 * @param {HTMLElement} el - Container element
 * @param {Setup2faState} state - Current state
 * @returns {void}
 */
function renderRecoveryCodes(el, state) {
  const codesText = (state.recoveryCodes || []).join("\n");
  const containerClass = state.mode === "enforced" ? "auth-container" : "container";

  el.innerHTML = `
    <div class="${containerClass}">
      <div class="auth-wrapper">
        <div class="card auth-card shadow-lg">
          <div class="auth-header">
            <h2>${t("auth.setup2fa.recoveryCodes.title")}</h2>
          </div>
          
          <div class="alert alert-warning mb-25">
            ${icon(Icons.ALERT_TRIANGLE, "icon")} <strong>${t("auth.setup2fa.recoveryCodes.warning")}</strong>
          </div>
          
          <p class="text-muted mb-25">${t("auth.setup2fa.recoveryCodes.description")}</p>
          
          <div class="card mb-25">
            <pre class="code-block">${escapeHtml(codesText)}</pre>
          </div>
          
          <div class="button-group mb-25">
            <button type="button" class="btn btn-secondary" id="copy-codes-btn">
              ${icon(Icons.COPY, "icon")} ${t("auth.setup2fa.recoveryCodes.copyButton")}
            </button>
            <button type="button" class="btn btn-secondary" id="download-codes-btn">
              ${icon(Icons.DOWNLOAD, "icon")} ${t("auth.setup2fa.recoveryCodes.downloadButton")}
            </button>
            <button type="button" class="btn btn-secondary" id="print-codes-btn">
              ${icon(Icons.PRINTER, "icon")} ${t("auth.setup2fa.recoveryCodes.printButton")}
            </button>
          </div>
          
          <button type="button" class="btn btn-primary btn-block" id="confirm-btn">
            ${t("auth.setup2fa.recoveryCodes.confirmButton")}
          </button>
        </div>
      </div>
    </div>
  `;

  // Copy codes
  const copyBtn = el.querySelector("#copy-codes-btn");
  if (copyBtn) {
    copyBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(codesText);
        copyBtn.innerHTML = `${icon(Icons.CHECK, "icon")} ${t("auth.setup2fa.recoveryCodes.copied")}`;
        setTimeout(() => {
          copyBtn.innerHTML = `${icon(Icons.COPY, "icon")} ${t("auth.setup2fa.recoveryCodes.copyButton")}`;
        }, 2000);
      } catch (err) {
        console.error("Failed to copy:", err);
      }
    });
  }

  // Download codes
  const downloadBtn = el.querySelector("#download-codes-btn");
  if (downloadBtn) {
    downloadBtn.addEventListener("click", () => {
      const blob = new Blob([codesText], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `s-store-recovery-codes-${new Date().toISOString().split("T")[0]}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  // Print codes
  const printBtn = el.querySelector("#print-codes-btn");
  if (printBtn) {
    printBtn.addEventListener("click", () => {
      const printWindow = window.open("", "", "width=600,height=400");
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>S-Store Recovery Codes</title>
              <style>
                body { font-family: monospace; padding: 2rem; }
                h1 { font-size: 1.5rem; margin-bottom: 1rem; }
                pre { white-space: pre-wrap; word-break: break-all; }
              </style>
            </head>
            <body>
              <h1>S-Store Recovery Codes</h1>
              <p>Keep these codes in a safe place!</p>
              <pre>${escapeHtml(codesText)}</pre>
            </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.print();
      }
    });
  }

  // Confirm button
  const confirmBtn = el.querySelector("#confirm-btn");
  if (confirmBtn) {
    confirmBtn.addEventListener("click", async () => {
      state.currentStep = "success";
      await renderStep(el, state);
    });
  }
}

/**
 * Renders success screen
 * @param {HTMLElement} el - Container element
 * @param {Setup2faState} state - Current state
 * @returns {void}
 */
function renderSuccess(el, state) {
  const containerClass = state.mode === "enforced" ? "auth-container" : "container";

  el.innerHTML = `
    <div class="${containerClass}">
      <div class="auth-wrapper">
        <div class="card auth-card shadow-lg text-center">
          <div class="mb-25 text-success">
            ${icon(Icons.CHECK_CIRCLE, "icon icon-xl")}
          </div>
          
          <h2 class="mb-10">${t("auth.setup2fa.success.title")}</h2>
          <p class="text-muted mb-25">${t("auth.setup2fa.success.description")}</p>
          
          <div class="card mb-25">
            <strong>${t("auth.setup2fa.success.methodEnabled").replace(
              "{{method}}",
              state.selectedMethod || ""
            )}</strong>
          </div>
          
          <button type="button" class="btn btn-primary btn-block" id="continue-btn">
            ${t("auth.setup2fa.success.continueButton")}
          </button>
        </div>
      </div>
    </div>
  `;

  // Continue button
  const continueBtn = el.querySelector("#continue-btn");
  if (continueBtn) {
    continueBtn.addEventListener("click", () => {
      location.hash = "/home";
    });
  }
}

/**
 * Renders error message
 * @param {string} message - Error message
 * @returns {string} HTML string
 */
function renderError(message) {
  return `
    <div class="section">
      <div class="alert alert-danger">
        <strong>${t("errors.generic")}</strong> ${escapeHtml(message)}
      </div>
    </div>
  `;
}

/**
 * Escapes HTML to prevent XSS
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
