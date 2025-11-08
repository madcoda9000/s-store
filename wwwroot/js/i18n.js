// /wwwroot/js/i18n.js

/**
 * Simple i18n system for S-Store
 * Supports client-side translations with fallback mechanism
 */

/** @type {Record<string, any>} */
let translations = {};

/** @type {string} */
let currentLanguage = 'en';

/** @type {string[]} */
const supportedLanguages = ['de', 'en'];

/** @type {string} */
const fallbackLanguage = 'en';

/** @type {Function[]} */
const languageChangeListeners = [];

/**
 * Detects the user's preferred language
 * Priority: LocalStorage > User Preference (API) > Browser Language > Fallback (EN)
 * @returns {string} Language code (de/en)
 */
function detectLanguage() {
  // 1. Check LocalStorage
  const stored = localStorage.getItem('language');
  if (stored && supportedLanguages.includes(stored)) {
    return stored;
  }

  // 2. Check browser language
  const browserLang = navigator.language.toLowerCase();
  
  // If browser is German, use DE
  if (browserLang.startsWith('de')) {
    return 'de';
  }

  // 3. Fallback to English
  return fallbackLanguage;
}

/**
 * Loads translation file for given language
 * @param {string} lang - Language code
 * @returns {Promise<Record<string, any>>} Translation object
 */
async function loadTranslations(lang) {
  try {
    const response = await fetch(`/locales/${lang}.json`);
    if (!response.ok) {
      throw new Error(`Failed to load translations for ${lang}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Error loading ${lang} translations:`, error);
    
    // If loading fails and it's not the fallback, try fallback
    if (lang !== fallbackLanguage) {
      console.warn(`Falling back to ${fallbackLanguage} translations`);
      return await loadTranslations(fallbackLanguage);
    }
    
    return {};
  }
}

/**
 * Initializes the i18n system
 * @returns {Promise<void>}
 */
export async function initI18n() {
  currentLanguage = detectLanguage();
  translations = await loadTranslations(currentLanguage);
  
  // Save detected language to localStorage
  localStorage.setItem('language', currentLanguage);
}

/**
 * Gets a translated string by key with optional interpolation
 * @param {string} key - Translation key (e.g., 'auth.login.title')
 * @param {Record<string, string|number>} [params] - Optional parameters for interpolation
 * @returns {string} Translated string
 * 
 * @example
 * t('auth.login.title') // "Sign in to your account"
 * t('common.welcome', { name: 'John' }) // "Welcome, John!"
 */
export function t(key, params) {
  const keys = key.split('.');
  let value = translations;

  // Navigate through nested object
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      console.warn(`Translation key not found: ${key}`);
      return key; // Return key as fallback
    }
  }

  let result = String(value);

  // Interpolate parameters
  if (params) {
    Object.keys(params).forEach(param => {
      result = result.replace(new RegExp(`{{\\s*${param}\\s*}}`, 'g'), String(params[param]));
    });
  }

  return result;
}

/**
 * Changes the current language and reloads translations
 * @param {string} lang - Language code
 * @returns {Promise<void>}
 */
export async function setLanguage(lang) {
  if (!supportedLanguages.includes(lang)) {
    console.warn(`Language ${lang} not supported. Using fallback.`);
    lang = fallbackLanguage;
  }

  currentLanguage = lang;
  translations = await loadTranslations(lang);
  localStorage.setItem('language', lang);

  // Notify all listeners
  languageChangeListeners.forEach(listener => listener(lang));
}

/**
 * Gets the current language
 * @returns {string} Current language code
 */
export function getCurrentLanguage() {
  return currentLanguage;
}

/**
 * Gets all supported languages
 * @returns {string[]} Array of language codes
 */
export function getSupportedLanguages() {
  return [...supportedLanguages];
}

/**
 * Registers a callback to be called when language changes
 * @param {Function} callback - Callback function that receives new language code
 * @returns {void}
 */
export function onLanguageChange(callback) {
  languageChangeListeners.push(callback);
}

/**
 * Translates an HTML element and its children
 * Looks for data-i18n attribute and translates content
 * @param {HTMLElement} element - Root element to translate
 * @returns {void}
 * 
 * @example
 * <button data-i18n="common.save">Save</button>
 * translateElement(button) // Updates button text to translated value
 */
export function translateElement(element) {
  // Translate element itself
  const key = element.getAttribute('data-i18n');
  if (key) {
    element.textContent = t(key);
  }

  // Translate placeholder
  const placeholderKey = element.getAttribute('data-i18n-placeholder');
  if (placeholderKey && element instanceof HTMLInputElement) {
    element.placeholder = t(placeholderKey);
  }

  // Translate title
  const titleKey = element.getAttribute('data-i18n-title');
  if (titleKey) {
    element.title = t(titleKey);
  }

  // Recursively translate children
  const children = element.querySelectorAll('[data-i18n], [data-i18n-placeholder], [data-i18n-title]');
  children.forEach(child => {
    const childKey = child.getAttribute('data-i18n');
    if (childKey) {
      child.textContent = t(childKey);
    }

    const childPlaceholderKey = child.getAttribute('data-i18n-placeholder');
    if (childPlaceholderKey && child instanceof HTMLInputElement) {
      child.placeholder = t(childPlaceholderKey);
    }

    const childTitleKey = child.getAttribute('data-i18n-title');
    if (childTitleKey) {
      child.title = t(childTitleKey);
    }
  });
}
