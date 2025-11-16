// /wwwroot/js/views/rate-limit.js

import { hideHeader } from "../header.js";
import { icon, Icons } from "../icons.js";
import { t } from "../i18n.js";

/**
 * Registers the rate limit route
 * @param {RouteRegisterFn} route - Route registration function
 * @returns {void}
 */
export function registerRateLimit(route) {
  route("/rate-limit", (el, params) => {
    // Hide header on rate limit page
    hideHeader();

    // Get retry-after from query params (in seconds)
    const retryAfter = params?.get('retryAfter') || '60';
    const retryAfterSeconds = parseInt(retryAfter, 10);
    const retryAfterMinutes = Math.ceil(retryAfterSeconds / 60);

    el.innerHTML = `
      <div class="auth-container">
        <div class="auth-wrapper">
          <div class="card auth-card">
            
            <div class="auth-header">
              <div class="rate-limit-icon">
                ${icon(Icons.ALERT_TRIANGLE, 'icon icon-xl')}
              </div>
              <h1 class="auth-logo">${t('rateLimit.title')}</h1>
              <p class="text-muted">${t('rateLimit.subtitle')}</p>
            </div>
            
            <div class="alert alert-warning">
              <strong>${t('rateLimit.message')}</strong><br>
              ${t('rateLimit.description', { minutes: retryAfterMinutes })}
            </div>

            <div class="rate-limit-info">
              <p class="text-muted">
                ${icon(Icons.CLOCK, 'icon')} ${t('rateLimit.waitTime', { seconds: retryAfterSeconds })}
              </p>
            </div>

            <div class="rate-limit-tips">
              <h3>${t('rateLimit.tipsTitle')}</h3>
              <ul class="text-muted">
                <li>${t('rateLimit.tip1')}</li>
                <li>${t('rateLimit.tip2')}</li>
                <li>${t('rateLimit.tip3')}</li>
              </ul>
            </div>

            <div class="auth-footer">
              <button id="retry-btn" class="btn btn-primary btn-block" disabled>
                ${t('rateLimit.retryIn', { seconds: retryAfterSeconds })}
              </button>
              <p class="text-muted mt-10">
                <a href="#/login" class="link">${t('rateLimit.backToLogin')}</a>
              </p>
            </div>
          </div>

          <div class="auth-theme-toggle">
            <button class="btn btn-icon" id="auth-theme-toggle" aria-label="${t('common.toggleTheme')}">${getThemeIcon()}</button>
          </div>
        
        </div>
      </div>`;

    const retryBtn = /** @type {HTMLButtonElement} */ (el.querySelector("#retry-btn"));
    let remainingSeconds = retryAfterSeconds;

    // Countdown timer
    const countdown = setInterval(() => {
      remainingSeconds--;
      
      if (remainingSeconds <= 0) {
        clearInterval(countdown);
        retryBtn.disabled = false;
        retryBtn.textContent = t('rateLimit.tryAgain');
      } else {
        retryBtn.textContent = t('rateLimit.retryIn', { seconds: remainingSeconds });
      }
    }, 1000);

    // Retry button click handler
    retryBtn.addEventListener("click", () => {
      // Go back to the previous page or login
      window.history.back();
    });

    // Setup theme toggle
    const authThemeToggle = el.querySelector("#auth-theme-toggle");
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
  });
}

/**
 * Gets the appropriate theme icon based on current theme
 * @returns {string} SVG icon HTML
 */
function getThemeIcon() {
  const currentTheme = document.documentElement.getAttribute("data-theme");
  const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  const activeTheme = currentTheme || systemTheme;
  
  return activeTheme === "dark" 
    ? icon(Icons.SUN, "icon icon-lg") 
    : icon(Icons.MOON, "icon icon-lg");
}