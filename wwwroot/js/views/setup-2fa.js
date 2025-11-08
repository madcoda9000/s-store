// /wwwroot/js/views/setup-2fa.js

import { api, setCsrfToken } from "../api.js";
import { hideHeader, updateHeader } from "../header.js";
import { icon, Icons } from "../icons.js";
import { t } from "../i18n.js";
import { getUserFromState } from "../auth-utils.js";

/**
 * @typedef {Object} Setup2faState
 * @property {'selection'|'authenticator'|'email'|'recovery'|'success'} currentStep
 * @property {string|null} selectedMethod
 * @property {string|null} qrCodeUrl
 * @property {string|null} manualKey
 * @property {boolean} codeSent
 * @property {string[]|null} recoveryCodes
 * @property {boolean} isEnforced
 */

/**
 * Registers the setup 2FA route
 * @param {RouteRegisterFn} route - Route registration function
 * @returns {void}
 */
export function registerSetup2fa(route) {
  route("/setup-2fa", async (el) => {
    // Check if user is logged in
    const user = getUserFromState();
    if (!user) {
      location.hash = "/login";
      return;
    }

    // Update header
    updateHeader(user);

    /** @type {Setup2faState} */
    const state = {
      currentStep: 'selection',
      selectedMethod: null,
      qrCodeUrl: null,
      manualKey: null,
      codeSent: false,
      recoveryCodes: null,
      isEnforced: user.twoFactorEnforced === 1
    };

    renderStep(el, state);
  });
}

/**
 * Renders the current step of the 2FA setup process
 * @param {HTMLElement} el - Container element
 * @param {Setup2faState} state - Current state
 * @returns {void}
 */
function renderStep(el, state) {
  switch (state.currentStep) {
    case 'selection':
      renderMethodSelection(el, state);
      break;
    case 'authenticator':
      renderAuthenticatorSetup(el, state);
      break;
    case 'email':
      renderEmailSetup(el, state);
      break;
    case 'recovery':
      renderRecoveryCodes(el, state);
      break;
    case 'success':
      renderSuccess(el, state);
      break;
  }
}

/**
 * Renders the method selection screen
 * @param {HTMLElement} el - Container element
 * @param {Setup2faState} state - Current state
 * @returns {void}
 */
function renderMethodSelection(el, state) {
  el.innerHTML = `
    <div class="container" style="max-width: 800px; margin: 2rem auto; padding: 0 1rem;">
      <div class="card">
        <div class="card-header">
          <h1 class="card-title">${t('auth.setup2fa.title')}</h1>
        </div>
        
        <div class="card-body">
          ${state.isEnforced ? `
            <div class="alert alert-info" style="margin-bottom: 1.5rem;">
              ${icon(Icons.ALERT_CIRCLE, 'icon')} ${t('auth.setup2fa.enforcedNotice')}
            </div>
          ` : ''}
          
          <p class="text-muted" style="margin-bottom: 2rem;">
            ${t('auth.setup2fa.description')}
          </p>
          
          <h3 style="margin-bottom: 1rem;">${t('auth.setup2fa.chooseMethod')}</h3>
          
          <div style="display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));">
            <!-- Authenticator Method -->
            <div class="method-card" data-method="authenticator">
              <div class="method-card-icon">
                ${icon(Icons.SMARTPHONE, 'icon icon-xl')}
              </div>
              <div class="method-card-content">
                <h4>
                  ${t('auth.setup2fa.authenticatorMethod.title')}
                  <span class="badge badge-success">${t('auth.setup2fa.authenticatorMethod.recommended')}</span>
                </h4>
                <p class="text-muted">${t('auth.setup2fa.authenticatorMethod.description')}</p>
                <button type="button" class="btn btn-primary" data-select-method="authenticator">
                  ${t('auth.setup2fa.authenticatorMethod.selectButton')}
                </button>
              </div>
            </div>
            
            <!-- Email Method -->
            <div class="method-card" data-method="email">
              <div class="method-card-icon">
                ${icon(Icons.MAIL, 'icon icon-xl')}
              </div>
              <div class="method-card-content">
                <h4>${t('auth.setup2fa.emailMethod.title')}</h4>
                <p class="text-muted">${t('auth.setup2fa.emailMethod.description')}</p>
                <button type="button" class="btn btn-outline" data-select-method="email">
                  ${t('auth.setup2fa.emailMethod.selectButton')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Add styles for method cards
  const style = document.createElement('style');
  style.textContent = `
    .method-card {
      border: 2px solid var(--border-color);
      border-radius: 8px;
      padding: 1.5rem;
      transition: all 0.2s ease;
      cursor: pointer;
    }
    
    .method-card:hover {
      border-color: var(--primary);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      transform: translateY(-2px);
    }
    
    .method-card-icon {
      margin-bottom: 1rem;
      color: var(--primary);
    }
    
    .method-card-content h4 {
      margin-bottom: 0.5rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    
    .method-card-content p {
      margin-bottom: 1rem;
      font-size: 0.875rem;
    }
    
    .method-card button {
      width: 100%;
    }
    
    .badge {
      display: inline-block;
      padding: 0.25rem 0.5rem;
      font-size: 0.75rem;
      font-weight: 600;
      border-radius: 4px;
    }
    
    .badge-success {
      background-color: #10b981;
      color: white;
    }
  `;
  document.head.appendChild(style);

  // Event handlers
  el.querySelectorAll('[data-select-method]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const method = /** @type {HTMLElement} */ (e.target).getAttribute('data-select-method');
      if (method === 'authenticator') {
        state.selectedMethod = 'Authenticator';
        state.currentStep = 'authenticator';
        initAuthenticatorSetup(el, state);
      } else if (method === 'email') {
        state.selectedMethod = 'Email';
        state.currentStep = 'email';
        renderStep(el, state);
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
    const response = await api('/auth/2fa/setup-authenticator', {
      method: 'POST'
    });

    if (response.csrfToken) {
      setCsrfToken(response.csrfToken);
    }

    state.qrCodeUrl = response.otpauth;
    state.manualKey = response.key;
    renderStep(el, state);
  } catch (err) {
    const error = /** @type {Error} */ (err);
    alert(error.message || t('auth.setup2fa.errors.setupFailed'));
    state.currentStep = 'selection';
    renderStep(el, state);
  }
}

/**
 * Renders the authenticator setup screen
 * @param {HTMLElement} el - Container element
 * @param {Setup2faState} state - Current state
 * @returns {void}
 */
function renderAuthenticatorSetup(el, state) {
  el.innerHTML = `
    <div class="container" style="max-width: 600px; margin: 2rem auto; padding: 0 1rem;">
      <div class="card">
        <div class="card-header">
          <h1 class="card-title">${t('auth.setup2fa.authenticatorSetup.title')}</h1>
        </div>
        
        <div class="card-body">
          <!-- Step 1: QR Code -->
          <div style="margin-bottom: 2rem;">
            <h3 style="margin-bottom: 0.5rem;">${t('auth.setup2fa.authenticatorSetup.step1')}</h3>
            <p class="text-muted" style="margin-bottom: 1rem;">
              ${t('auth.setup2fa.authenticatorSetup.step1Description')}
            </p>
            
            <div style="display: flex; justify-content: center; margin-bottom: 1rem;">
              <div id="qr-code" style="padding: 1rem; background: white; border-radius: 8px; border: 2px solid var(--border-color);"></div>
            </div>
            
            <p class="text-muted" style="margin-bottom: 0.5rem;">
              ${t('auth.setup2fa.authenticatorSetup.step1Alt')}
            </p>
            <div class="form-group">
              <div class="input-group">
                <input 
                  type="text" 
                  id="manual-key" 
                  class="input" 
                  value="${state.manualKey || ''}" 
                  readonly
                  style="font-family: monospace; font-size: 0.875rem;">
                <button type="button" class="btn btn-outline" id="copy-key-btn">
                  ${icon(Icons.COPY, 'icon')} ${t('auth.setup2fa.authenticatorSetup.copyKey')}
                </button>
              </div>
            </div>
          </div>
          
          <div class="divider"></div>
          
          <!-- Step 2: Verify -->
          <div>
            <h3 style="margin-bottom: 0.5rem;">${t('auth.setup2fa.authenticatorSetup.step2')}</h3>
            <p class="text-muted" style="margin-bottom: 1rem;">
              ${t('auth.setup2fa.authenticatorSetup.step2Description')}
            </p>
            
            <form id="verify-authenticator-form">
              <div class="form-group">
                <label class="label" for="code">${t('auth.setup2fa.authenticatorSetup.code')}</label>
                <input 
                  type="text" 
                  id="code" 
                  name="code"
                  class="input" 
                  placeholder="${t('auth.setup2fa.authenticatorSetup.codePlaceholder')}"
                  maxlength="6"
                  pattern="[0-9]{6}"
                  inputmode="numeric"
                  autocomplete="one-time-code"
                  required>
              </div>
              
              <div id="verify-error" class="error hidden"></div>
              
              <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
                <button type="button" class="btn btn-outline" id="back-btn">
                  ${icon(Icons.ARROW_LEFT, 'icon')} ${t('auth.setup2fa.authenticatorSetup.backButton')}
                </button>
                <button type="submit" class="btn btn-primary" style="flex: 1;">
                  ${t('auth.setup2fa.authenticatorSetup.verifyButton')}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  `;

  // Generate QR code
  const qrContainer = el.querySelector('#qr-code');
  if (qrContainer && state.qrCodeUrl) {
    // Use a simple QR code library via CDN or generate manually
    // For simplicity, I'll show the URL that can be converted to QR
    // In production, use qrcode.js or similar
    const qr = document.createElement('img');
    qr.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(state.qrCodeUrl)}`;
    qr.alt = 'QR Code';
    qr.style.maxWidth = '200px';
    qrContainer.appendChild(qr);
  }

  // Copy key handler
  const copyBtn = el.querySelector('#copy-key-btn');
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      const keyInput = /** @type {HTMLInputElement} */ (el.querySelector('#manual-key'));
      if (keyInput) {
        try {
          await navigator.clipboard.writeText(keyInput.value);
          copyBtn.innerHTML = `${icon(Icons.CHECK, 'icon')} ${t('auth.setup2fa.authenticatorSetup.keyCopied')}`;
          setTimeout(() => {
            copyBtn.innerHTML = `${icon(Icons.COPY, 'icon')} ${t('auth.setup2fa.authenticatorSetup.copyKey')}`;
          }, 2000);
        } catch (err) {
          // Fallback for older browsers
          keyInput.select();
          document.execCommand('copy');
          copyBtn.innerHTML = `${icon(Icons.CHECK, 'icon')} ${t('auth.setup2fa.authenticatorSetup.keyCopied')}`;
          setTimeout(() => {
            copyBtn.innerHTML = `${icon(Icons.COPY, 'icon')} ${t('auth.setup2fa.authenticatorSetup.copyKey')}`;
          }, 2000);
        }
      }
    });
  }

  // Back button
  const backBtn = el.querySelector('#back-btn');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      state.currentStep = 'selection';
      state.selectedMethod = null;
      state.qrCodeUrl = null;
      state.manualKey = null;
      renderStep(el, state);
    });
  }

  // Form submission
  const form = /** @type {HTMLFormElement} */ (el.querySelector('#verify-authenticator-form'));
  const errorEl = /** @type {HTMLElement} */ (el.querySelector('#verify-error'));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.classList.add('hidden');

    const formData = new FormData(form);
    const code = formData.get('code')?.toString() || '';

    const submitBtn = /** @type {HTMLButtonElement} */ (form.querySelector('button[type="submit"]'));
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = t('auth.setup2fa.authenticatorSetup.verifying');

    try {
      const response = await api('/auth/2fa/verify-authenticator-setup', {
        method: 'POST',
        body: { Code: code }  // Backend expects uppercase 'Code'
      });

      if (response.csrfToken) {
        setCsrfToken(response.csrfToken);
      }

      state.recoveryCodes = response.recoveryCodes;
      state.currentStep = 'recovery';
      renderStep(el, state);
    } catch (err) {
      const error = /** @type {Error} */ (err);
      errorEl.textContent = error.message || t('auth.setup2fa.errors.invalidCode');
      errorEl.classList.remove('hidden');
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  });
}

/**
 * Renders the email setup screen
 * @param {HTMLElement} el - Container element
 * @param {Setup2faState} state - Current state
 * @returns {void}
 */
function renderEmailSetup(el, state) {
  el.innerHTML = `
    <div class="container" style="max-width: 600px; margin: 2rem auto; padding: 0 1rem;">
      <div class="card">
        <div class="card-header">
          <h1 class="card-title">${t('auth.setup2fa.emailSetup.title')}</h1>
        </div>
        
        <div class="card-body">
          ${!state.codeSent ? `
            <!-- Step 1: Request Code -->
            <div>
              <h3 style="margin-bottom: 0.5rem;">${t('auth.setup2fa.emailSetup.step1')}</h3>
              <p class="text-muted" style="margin-bottom: 1rem;">
                ${t('auth.setup2fa.emailSetup.step1Description')}
              </p>
              
              <div class="form-group">
                <input 
                  type="email" 
                  class="input" 
                  value="${getUserFromState()?.email || ''}" 
                  disabled>
              </div>
              
              <div id="send-error" class="error hidden"></div>
              
              <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
                <button type="button" class="btn btn-outline" id="back-btn">
                  ${icon(Icons.ARROW_LEFT, 'icon')} ${t('auth.setup2fa.emailSetup.backButton')}
                </button>
                <button type="button" class="btn btn-primary" id="send-code-btn" style="flex: 1;">
                  ${t('auth.setup2fa.emailSetup.sendCodeButton')}
                </button>
              </div>
            </div>
          ` : `
            <!-- Step 2: Verify Code -->
            <div>
              <div class="alert alert-success" style="margin-bottom: 1.5rem;">
                ${icon(Icons.MAIL, 'icon')} ${t('auth.setup2fa.emailSetup.codeSent')}
              </div>
              
              <h3 style="margin-bottom: 0.5rem;">${t('auth.setup2fa.emailSetup.step2')}</h3>
              <p class="text-muted" style="margin-bottom: 1rem;">
                ${t('auth.setup2fa.emailSetup.step2Description')}
              </p>
              
              <form id="verify-email-form">
                <div class="form-group">
                  <label class="label" for="code">${t('auth.setup2fa.emailSetup.code')}</label>
                  <input 
                    type="text" 
                    id="code" 
                    name="code"
                    class="input" 
                    placeholder="${t('auth.setup2fa.emailSetup.codePlaceholder')}"
                    maxlength="6"
                    pattern="[0-9]{6}"
                    inputmode="numeric"
                    autocomplete="one-time-code"
                    required>
                </div>
                
                <div id="verify-error" class="error hidden"></div>
                
                <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
                  <button type="button" class="btn btn-outline" id="resend-btn">
                    ${icon(Icons.REFRESH_CW, 'icon')} ${t('auth.setup2fa.emailSetup.resendButton')}
                  </button>
                  <button type="submit" class="btn btn-primary" style="flex: 1;">
                    ${t('auth.setup2fa.emailSetup.verifyButton')}
                  </button>
                </div>
              </form>
            </div>
          `}
        </div>
      </div>
    </div>
  `;

  // Back button (step 1)
  const backBtn = el.querySelector('#back-btn');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      state.currentStep = 'selection';
      state.selectedMethod = null;
      state.codeSent = false;
      renderStep(el, state);
    });
  }

  // Send code button (step 1)
  const sendBtn = el.querySelector('#send-code-btn');
  if (sendBtn) {
    sendBtn.addEventListener('click', async () => {
      const errorEl = /** @type {HTMLElement} */ (el.querySelector('#send-error'));
      errorEl.classList.add('hidden');

      const btn = /** @type {HTMLButtonElement} */ (sendBtn);
      const originalText = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = t('auth.setup2fa.emailSetup.sending');

      try {
        const response = await api('/auth/2fa/setup-email', {
          method: 'POST'
        });

        if (response.csrfToken) {
          setCsrfToken(response.csrfToken);
        }

        state.codeSent = true;
        renderStep(el, state);
      } catch (err) {
        const error = /** @type {Error} */ (err);
        errorEl.textContent = error.message || t('auth.setup2fa.errors.emailSendFailed');
        errorEl.classList.remove('hidden');
        btn.disabled = false;
        btn.innerHTML = originalText;
      }
    });
  }

  // Resend button (step 2)
  const resendBtn = el.querySelector('#resend-btn');
  if (resendBtn) {
    resendBtn.addEventListener('click', async () => {
      const btn = /** @type {HTMLButtonElement} */ (resendBtn);
      const originalText = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = t('auth.setup2fa.emailSetup.sending');

      try {
        const response = await api('/auth/2fa/setup-email', {
          method: 'POST'
        });

        if (response.csrfToken) {
          setCsrfToken(response.csrfToken);
        }

        btn.innerHTML = `${icon(Icons.CHECK, 'icon')} ${t('auth.setup2fa.emailSetup.codeSent')}`;
        setTimeout(() => {
          btn.disabled = false;
          btn.innerHTML = originalText;
        }, 3000);
      } catch (err) {
        btn.disabled = false;
        btn.innerHTML = originalText;
      }
    });
  }

  // Verify form (step 2)
  const form = /** @type {HTMLFormElement|null} */ (el.querySelector('#verify-email-form'));
  if (form) {
    const errorEl = /** @type {HTMLElement} */ (el.querySelector('#verify-error'));

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorEl.classList.add('hidden');

      const formData = new FormData(form);
      const code = formData.get('code')?.toString() || '';

      const submitBtn = /** @type {HTMLButtonElement} */ (form.querySelector('button[type="submit"]'));
      const originalText = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = t('auth.setup2fa.emailSetup.verifying');

      try {
        const response = await api('/auth/2fa/verify-email-setup', {
          method: 'POST',
          body: { Code: code }  // Backend expects uppercase 'Code'
        });

        if (response.csrfToken) {
          setCsrfToken(response.csrfToken);
        }

        state.recoveryCodes = response.recoveryCodes;
        state.currentStep = 'recovery';
        renderStep(el, state);
      } catch (err) {
        const error = /** @type {Error} */ (err);
        errorEl.textContent = error.message || t('auth.setup2fa.errors.invalidCode');
        errorEl.classList.remove('hidden');
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
    });
  }
}

/**
 * Renders the recovery codes screen
 * @param {HTMLElement} el - Container element
 * @param {Setup2faState} state - Current state
 * @returns {void}
 */
function renderRecoveryCodes(el, state) {
  const codesText = (state.recoveryCodes || []).join('\n');
  
  el.innerHTML = `
    <div class="container" style="max-width: 600px; margin: 2rem auto; padding: 0 1rem;">
      <div class="card">
        <div class="card-header">
          <h1 class="card-title">${t('auth.setup2fa.recoveryCodes.title')}</h1>
        </div>
        
        <div class="card-body">
          <div class="alert alert-warning" style="margin-bottom: 1.5rem;">
            ${icon(Icons.ALERT_TRIANGLE, 'icon')} <strong>${t('auth.setup2fa.recoveryCodes.warning')}</strong>
          </div>
          
          <p class="text-muted" style="margin-bottom: 1.5rem;">
            ${t('auth.setup2fa.recoveryCodes.description')}
          </p>
          
          <div style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 4px; padding: 1rem; margin-bottom: 1.5rem;">
            <pre style="margin: 0; font-family: monospace; font-size: 0.875rem; white-space: pre-wrap; word-break: break-all;">${codesText}</pre>
          </div>
          
          <div style="display: grid; gap: 0.75rem; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); margin-bottom: 1.5rem;">
            <button type="button" class="btn btn-outline" id="copy-codes-btn">
              ${icon(Icons.COPY, 'icon')} ${t('auth.setup2fa.recoveryCodes.copyButton')}
            </button>
            <button type="button" class="btn btn-outline" id="download-codes-btn">
              ${icon(Icons.DOWNLOAD, 'icon')} ${t('auth.setup2fa.recoveryCodes.downloadButton')}
            </button>
            <button type="button" class="btn btn-outline" id="print-codes-btn">
              ${icon(Icons.PRINTER, 'icon')} ${t('auth.setup2fa.recoveryCodes.printButton')}
            </button>
          </div>
          
          <div class="divider"></div>
          
          <button type="button" class="btn btn-primary btn-block" id="confirm-btn">
            ${t('auth.setup2fa.recoveryCodes.confirmButton')}
          </button>
        </div>
      </div>
    </div>
  `;

  // Copy codes
  const copyBtn = el.querySelector('#copy-codes-btn');
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(codesText);
        copyBtn.innerHTML = `${icon(Icons.CHECK, 'icon')} ${t('auth.setup2fa.recoveryCodes.copied')}`;
        setTimeout(() => {
          copyBtn.innerHTML = `${icon(Icons.COPY, 'icon')} ${t('auth.setup2fa.recoveryCodes.copyButton')}`;
        }, 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    });
  }

  // Download codes
  const downloadBtn = el.querySelector('#download-codes-btn');
  if (downloadBtn) {
    downloadBtn.addEventListener('click', () => {
      const blob = new Blob([codesText], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `s-store-recovery-codes-${new Date().toISOString().split('T')[0]}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  // Print codes
  const printBtn = el.querySelector('#print-codes-btn');
  if (printBtn) {
    printBtn.addEventListener('click', () => {
      const printWindow = window.open('', '', 'width=600,height=400');
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
              <pre>${codesText}</pre>
            </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.print();
      }
    });
  }

  // Confirm button
  const confirmBtn = el.querySelector('#confirm-btn');
  if (confirmBtn) {
    confirmBtn.addEventListener('click', () => {
      state.currentStep = 'success';
      renderStep(el, state);
    });
  }
}

/**
 * Renders the success screen
 * @param {HTMLElement} el - Container element
 * @param {Setup2faState} state - Current state
 * @returns {void}
 */
function renderSuccess(el, state) {
  el.innerHTML = `
    <div class="container" style="max-width: 600px; margin: 2rem auto; padding: 0 1rem;">
      <div class="card">
        <div class="card-body" style="text-align: center; padding: 3rem 2rem;">
          <div style="color: var(--success); margin-bottom: 1.5rem;">
            ${icon(Icons.CHECK_CIRCLE, 'icon', '64')}
          </div>
          
          <h1 style="margin-bottom: 0.5rem;">${t('auth.setup2fa.success.title')}</h1>
          <p class="text-muted" style="margin-bottom: 1rem;">
            ${t('auth.setup2fa.success.description')}
          </p>
          
          <div style="display: inline-block; padding: 0.5rem 1rem; background: var(--bg-secondary); border-radius: 4px; margin-bottom: 2rem;">
            <strong>${t('auth.setup2fa.success.methodEnabled', { method: state.selectedMethod })}</strong>
          </div>
          
          <button type="button" class="btn btn-primary btn-block" id="continue-btn">
            ${t('auth.setup2fa.success.continueButton')}
          </button>
        </div>
      </div>
    </div>
  `;

  // Continue button
  const continueBtn = el.querySelector('#continue-btn');
  if (continueBtn) {
    continueBtn.addEventListener('click', () => {
      location.hash = '/home';
    });
  }
}
