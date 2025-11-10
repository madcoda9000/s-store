// /wwwroot/js/header.js

import { icon, Icons } from './icons.js';
import { updateThemeToggleIcon } from './app.js';
import { setLanguage, getCurrentLanguage, getSupportedLanguages, onLanguageChange } from './i18n.js';

// Store reference to prevent multiple event registrations
let globalEventsInitialized = false;

/**
 * Updates the header with navigation and profile dropdown based on user data
 * @param {User} user - Current user object
 * @returns {void}
 */
export function updateHeader(user) {
  // Check if user is admin
  const isAdmin = user.roles && user.roles.includes('Admin');
  
  // Show header
  const header = document.getElementById('main-header');
  if (header) {
    header.classList.remove('hidden');
  }
  
  // Initialize global events only once
  if (!globalEventsInitialized) {
    initializeGlobalEvents();
    globalEventsInitialized = true;
  }
  
  // Setup mobile menu toggle
  setupMobileMenu();
  
  // Update navigation menu
  updateNavigation(isAdmin);
  
  // Update profile dropdown
  updateProfileDropdown(user);
  
  // Update language selector
  updateLanguageSelector();
  
  // Update theme toggle icon
  updateThemeToggleIcon();
}

/**
 * Hides the header (e.g., on login/logout pages)
 * @returns {void}
 */
export function hideHeader() {
  const header = document.getElementById('main-header');
  if (header) {
    header.classList.add('hidden');
  }
}

/**
 * Initializes all global event handlers (only once)
 * @returns {void}
 */
function initializeGlobalEvents() {
  // All dropdown and menu event delegation in one place
  document.addEventListener('click', (e) => {
    const target = /** @type {HTMLElement} */ (e.target);
    
    // Handle mobile menu toggle
    const mobileToggle = document.getElementById('mobile-menu-toggle');
    const overlay = document.getElementById('mobile-menu-overlay');
    const nav = document.getElementById('main-nav');
    
    if (mobileToggle && overlay && nav) {
      // Handle hamburger button click
      if (target.closest('#mobile-menu-toggle')) {
        e.stopPropagation();
        const isOpen = nav.classList.contains('show');
        
        if (isOpen) {
          nav.classList.remove('show');
          overlay.classList.remove('show');
          mobileToggle.innerHTML = icon(Icons.MENU, 'icon icon-lg');
          document.body.style.overflow = '';
        } else {
          nav.classList.add('show');
          overlay.classList.add('show');
          mobileToggle.innerHTML = icon(Icons.X, 'icon icon-lg');
          document.body.style.overflow = 'hidden';
        }
        return;
      }
      
      // Handle overlay click
      if (target.closest('#mobile-menu-overlay')) {
        nav.classList.remove('show');
        overlay.classList.remove('show');
        mobileToggle.innerHTML = icon(Icons.MENU, 'icon icon-lg');
        document.body.style.overflow = '';
        return;
      }
      
      // Handle nav link click
      if (target.closest('.nav-link') && nav.classList.contains('show')) {
        nav.classList.remove('show');
        overlay.classList.remove('show');
        mobileToggle.innerHTML = icon(Icons.MENU, 'icon icon-lg');
        document.body.style.overflow = '';
        return;
      }
    }
    
    // Handle profile dropdown toggle
    const profileMenu = document.getElementById('profile-menu');
    
    if (target.closest('#profile-toggle')) {
      e.stopPropagation();
      if (profileMenu) {
        profileMenu.classList.toggle('show');
        
        // Close language menu if open
        const languageMenu = document.getElementById('language-menu');
        if (languageMenu) {
          languageMenu.classList.remove('show');
        }
      }
      return;
    }
    
    // Close profile dropdown when clicking outside
    if (profileMenu && !target.closest('.profile-dropdown')) {
      profileMenu.classList.remove('show');
    }
    
    // Handle language selector toggle
    const languageMenu = document.getElementById('language-menu');
    
    if (target.closest('#language-toggle')) {
      e.stopPropagation();
      if (languageMenu) {
        languageMenu.classList.toggle('show');
        
        // Close profile menu if open
        if (profileMenu) {
          profileMenu.classList.remove('show');
        }
      }
      return;
    }
    
    // Handle language selection
    const languageOption = target.closest('.language-menu-item');
    if (languageOption) {
      e.stopPropagation();
      const lang = languageOption.getAttribute('data-lang');
      if (lang) {
        // Hide app content during language switch to prevent flashing
        const appElement = document.getElementById('app');
        if (appElement) {
          appElement.style.opacity = '0';
        }
        
        setLanguage(lang).then(() => {
          // Update button text immediately
          const languageText = document.getElementById('language-text');
          if (languageText) {
            languageText.textContent = lang.toUpperCase();
          }
          
          // Close menu
          if (languageMenu) {
            languageMenu.classList.remove('show');
          }
          
          // Reload current page to apply translations
          const currentHash = location.hash;
          
          // Force reload the current view
          if (currentHash) {
            location.hash = currentHash + '?lang=' + Date.now();
            
            // Clean up URL after reload
            setTimeout(() => {
              if (location.hash.includes('?lang=')) {
                history.replaceState(null, '', currentHash);
              }
              // Restore visibility
              if (appElement) {
                appElement.style.opacity = '1';
              }
            }, 50);
          } else {
            // Fallback to home if no hash
            location.hash = '#/home';
            if (appElement) {
              appElement.style.opacity = '1';
            }
          }
        });
      }
      return;
    }
    
    // Close language menu when clicking outside
    if (languageMenu && !target.closest('.language-selector')) {
      languageMenu.classList.remove('show');
    }
  });
  
  // Handle escape key for all menus
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      // Close mobile menu
      const nav = document.getElementById('main-nav');
      const overlay = document.getElementById('mobile-menu-overlay');
      const mobileToggle = document.getElementById('mobile-menu-toggle');
      
      if (nav && nav.classList.contains('show')) {
        nav.classList.remove('show');
        if (overlay) overlay.classList.remove('show');
        if (mobileToggle) mobileToggle.innerHTML = icon(Icons.MENU, 'icon icon-lg');
        document.body.style.overflow = '';
      }
      
      // Close profile dropdown
      const profileMenu = document.getElementById('profile-menu');
      if (profileMenu) {
        profileMenu.classList.remove('show');
      }
      
      // Close language menu
      const languageMenu = document.getElementById('language-menu');
      if (languageMenu) {
        languageMenu.classList.remove('show');
      }
    }
  });
  
  // Handle window resize
  window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
      const nav = document.getElementById('main-nav');
      const overlay = document.getElementById('mobile-menu-overlay');
      const mobileToggle = document.getElementById('mobile-menu-toggle');
      
      if (nav && nav.classList.contains('show')) {
        nav.classList.remove('show');
        if (overlay) overlay.classList.remove('show');
        if (mobileToggle) mobileToggle.innerHTML = icon(Icons.MENU, 'icon icon-lg');
        document.body.style.overflow = '';
      }
    }
  });
  
  // Listen for language changes from other sources (e.g., API sync)
  onLanguageChange((newLang) => {
    const languageText = document.getElementById('language-text');
    if (languageText) {
      languageText.textContent = newLang.toUpperCase();
    }
  });
}

/**
 * Sets up the mobile menu hamburger toggle
 * @returns {void}
 */
function setupMobileMenu() {
  const headerContent = document.querySelector('.header-content');
  const logo = document.querySelector('.logo');
  
  if (!headerContent || !logo) return;
  
  // Remove existing mobile menu elements if any
  const existingToggle = headerContent.querySelector('.mobile-menu-toggle');
  const existingOverlay = document.querySelector('.mobile-menu-overlay');
  
  if (existingToggle) {
    existingToggle.remove();
  }
  if (existingOverlay) {
    existingOverlay.remove();
  }
  
  // Create hamburger toggle button
  const mobileToggle = document.createElement('button');
  mobileToggle.className = 'mobile-menu-toggle';
  mobileToggle.setAttribute('aria-label', 'Toggle menu');
  mobileToggle.setAttribute('type', 'button');
  mobileToggle.setAttribute('id', 'mobile-menu-toggle');
  mobileToggle.innerHTML = icon(Icons.MENU, 'icon icon-lg');
  
  // Create overlay for closing menu
  const overlay = document.createElement('div');
  overlay.className = 'mobile-menu-overlay';
  overlay.setAttribute('id', 'mobile-menu-overlay');
  
  // Insert toggle button as first child
  headerContent.insertBefore(mobileToggle, logo);
  
  // Insert overlay in body
  document.body.appendChild(overlay);
}

/**
 * Updates the navigation menu based on user roles
 * @param {boolean} isAdmin - Whether the user is an admin
 * @returns {void}
 */
function updateNavigation(isAdmin) {
  const nav = document.getElementById('main-nav');
  if (!nav) return;
  
  const navItems = [];
  
  // Always show Home link
  navItems.push('<a href="#/home" class="nav-link">Home</a>');
  
  // Admin-only links
  if (isAdmin) {
    navItems.push('<a href="#/admin/users" class="nav-link">Users</a>');
    navItems.push('<a href="#/admin/roles" class="nav-link">Roles</a>');
  }
  
  // Common links for all authenticated users
  navItems.push('<a href="#/settings" class="nav-link">Settings</a>');
  
  nav.innerHTML = navItems.join('');
}

/**
 * Updates the profile dropdown in the header
 * @param {User} user - Current user object
 * @returns {void}
 */
function updateProfileDropdown(user) {
  const headerActions = document.querySelector('.header-actions');
  if (!headerActions) return;
  
  // Remove existing profile dropdown if any
  const existingDropdown = headerActions.querySelector('.profile-dropdown');
  if (existingDropdown) {
    existingDropdown.remove();
  }
  
  // Create profile dropdown
  const profileDropdown = document.createElement('div');
  profileDropdown.className = 'profile-dropdown';
  
  // Get user initials for avatar
  const initials = getUserInitials(user.userName || user.email);
  
  const twoFactorLink = !user.twoFactorEnabled 
    ? `<a href="#/setup-2fa" class="profile-menu-item">${icon(Icons.SHIELD, 'icon')} Setup 2FA</a>` 
    : '';
  
  profileDropdown.innerHTML = `
    <button class="profile-btn" id="profile-toggle" type="button" aria-label="Profile menu">
      <div class="profile-avatar">${initials}</div>
      ${icon(Icons.CHEVRON_DOWN, 'icon icon-sm')}
    </button>
    <div class="profile-menu" id="profile-menu">
      <div class="profile-menu-header">
        <div class="profile-menu-name">${escapeHtml(user.userName)}</div>
        <div class="profile-menu-email">${escapeHtml(user.email)}</div>
      </div>
      <a href="#/profile" class="profile-menu-item">${icon(Icons.USER, 'icon')} Profile</a>
      ${twoFactorLink}
      <div class="profile-menu-divider"></div>
      <a href="#/logout" class="profile-menu-item">${icon(Icons.LOG_OUT, 'icon')} Logout</a>
    </div>
  `;
  
  // Insert as LAST child in header-actions (after everything)
  headerActions.appendChild(profileDropdown);
}

/**
 * Gets user initials from username or email
 * @param {string} name - Username or email
 * @returns {string} User initials (max 2 characters)
 */
function getUserInitials(name) {
  if (!name) return '?';
  
  // Remove email domain if present
  const cleanName = name.split('@')[0];
  
  // Get first two characters of first two words
  const parts = cleanName.split(/[\s._-]+/).filter(p => p.length > 0);
  
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  } else if (parts.length === 1 && parts[0].length >= 2) {
    return parts[0].substring(0, 2).toUpperCase();
  } else {
    return parts[0][0].toUpperCase();
  }
}

/**
 * Escapes HTML special characters to prevent XSS
 * @param {string|null|undefined} str - String to escape
 * @returns {string} Escaped string
 */
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, (char) => {
    /** @type {Record<string, string>} */
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };
    return map[char];
  });
}

/**
 * Updates or creates the language selector in the header
 * @returns {void}
 */
function updateLanguageSelector() {
  const headerActions = document.querySelector('.header-actions');
  if (!headerActions) return;

  // Remove existing language selector if any
  const existingSelector = headerActions.querySelector('.language-selector');
  if (existingSelector) {
    existingSelector.remove();
  }

  const currentLang = getCurrentLanguage();
  const languages = getSupportedLanguages();

  // Create language selector dropdown
  const languageSelector = document.createElement('div');
  languageSelector.className = 'language-selector';

  const languageOptions = languages
    .map(
      (lang) => `
      <button 
        class="profile-menu-item language-menu-item" 
        data-lang="${lang}"
        type="button">
        ${lang.toUpperCase()}
      </button>
    `
    )
    .join('');

  languageSelector.innerHTML = `
    <button class="profile-btn language-btn" id="language-toggle" type="button" aria-label="Change language">
      <span id="language-text">${currentLang.toUpperCase()}</span>
      ${icon(Icons.CHEVRON_DOWN, 'icon icon-sm')}
    </button>
    <div class="profile-menu" id="language-menu">
      ${languageOptions}
    </div>
  `;

  // Insert before theme toggle (last child)
  const themeToggle = headerActions.querySelector('#theme-toggle');
  if (themeToggle) {
    headerActions.insertBefore(languageSelector, themeToggle);
  } else {
    headerActions.appendChild(languageSelector);
  }
}
