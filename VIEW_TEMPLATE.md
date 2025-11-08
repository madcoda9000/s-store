# S-Store View Template

This template provides a comprehensive starting point for creating new views in the S-Store application. Follow the patterns and best practices outlined below.

## Understanding the Router and `el` Parameter

The S-Store application uses a hash-based router (`/wwwroot/js/router.js`) that handles navigation:

1. **Route Registration**: Views register themselves with the router using the `route()` function
2. **Callback Function**: When a route is accessed, the router calls your callback function
3. **`el` Parameter**: The router passes the main container element (`document.getElementById('app')`) as the `el` parameter
4. **Your Responsibility**: Your view function receives `el` and must render HTML into it using `el.innerHTML`

**Flow:**
```javascript
// 1. User navigates to #/example
location.hash = '/example';

// 2. Router finds the registered callback for '/example'
const view = routes['/example'];

// 3. Router calls the callback with the app container element
const appElement = document.getElementById('app');
view(appElement);  // <- This is your callback function, appElement is 'el'

// 4. Your function receives el and renders into it
export function registerExampleView(route) {
  route('/example', async el => {  // <- 'el' is the #app container element
    el.innerHTML = '<div>Your content</div>';  // Render your view
  });
}
```

**Key Points:**
- `el` is always `document.getElementById('app')` - the main container (defined in `/wwwroot/index.html`)
- You don't need to query for it - the router provides it
- Setting `el.innerHTML` replaces the entire view content
- The router handles navigation, you handle rendering
- All event listeners must be attached AFTER `el.innerHTML` is set (elements must exist in DOM)

## Basic View Structure

```javascript
// /wwwroot/js/views/example-view.js

import { api, setCsrfToken } from '../api.js';
import { updateHeader } from '../header.js';
import { icon, Icons } from '../icons.js';
import { t } from '../i18n.js';
import { hasRole, renderAccessDenied } from '../auth-utils.js';

/**
 * Registers the example route
 * @param {RouteRegisterFn} route - Route registration function
 * @returns {void}
 */
export function registerExampleView(route) {
  route('/example', async el => {
    try {
      // 1. Fetch current user data (refreshes CSRF token and updates header)
      /** @type {User} */
      const user = await api('/auth/me');
      
      // 2. Update header with navigation and profile dropdown
      updateHeader(user);
      
      // 3. Check authorization if needed (for protected routes like Admin views)
      // Uncomment and modify for views requiring specific roles:
      /*
      if (!hasRole(user, 'Admin')) {
        el.innerHTML = renderAccessDenied(
          user,
          '/example',  // Current route
          'Admin',     // Required role
          t('errors.adminAccessRequired') || 'You need administrator privileges to access this page.'
        );
        return;
      }
      */
      
      // 4. Fetch any additional data needed for the view
      /** @type {YourDataType} */
      const data = await api('/your-endpoint');
      
      // 4. Render the view
      el.innerHTML = renderView(user, data);
      
      // 5. Setup event handlers after rendering
      setupEventHandlers(el, data);
      
    } catch (err) {
      const error = /** @type {Error} */ (err);
      
      // Handle unauthorized access - redirect to login
      if (error.message.includes('Unauthorized') || 
          error.message.includes('401') || 
          error.message.includes('403')) {
        location.hash = '/login';
        return;
      }
      
      // Display error message
      el.innerHTML = renderError(error.message);
    }
  });
}

/**
 * Renders the main view content
 * @param {User} user - Current user data
 * @param {YourDataType} data - View-specific data
 * @returns {string} HTML string
 */
function renderView(user, data) {
  return `
    <div class="section">
      <div class="section-header">
        <h2 class="section-title mb-0">${t('yourSection.title')}</h2>
        <button class="btn btn-primary" id="add-btn">
          ${icon(Icons.PLUS)}
          ${t('yourSection.addNew')}
        </button>
      </div>
      
      <!-- Grid Layout for Cards -->
      <div class="grid">
        ${renderCards(data)}
      </div>
      
      <!-- Alternative: Table Layout -->
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>${t('common.name')}</th>
              <th>${t('common.email')}</th>
              <th>${t('common.status')}</th>
              <th>${t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            ${renderTableRows(data)}
          </tbody>
        </table>
      </div>
      
      <!-- Form Example -->
      <div class="card shadow-md">
        <h3>${t('yourSection.formTitle')}</h3>
        <form id="example-form" class="form">
          <div class="form-group">
            <label for="name" class="label">${t('common.name')}</label>
            <input 
              type="text" 
              id="name" 
              name="name" 
              class="input" 
              placeholder="${t('yourSection.namePlaceholder')}"
              required
            />
          </div>
          
          <!-- Input with Actions (Password Toggle, Generator, etc.) -->
          <div class="form-group">
            <label for="password" class="label">${t('common.password')}</label>
            <div class="input-with-actions">
              <input 
                type="password" 
                id="password" 
                name="password" 
                class="input" 
                placeholder="${t('common.password')}"
                required
                autocomplete="new-password"
              />
              <button 
                type="button" 
                class="input-action-btn" 
                data-toggle-password="password" 
                aria-label="${t('common.showPwd')}"
              >
                ${icon(Icons.EYE)}
              </button>
            </div>
            <small class="form-hint">${t('common.passwordHint')}</small>
          </div>
          
          <!-- Select Dropdown -->
          <div class="form-group">
            <label for="status" class="label">${t('common.status')}</label>
            <select id="status" name="status" class="select">
              <option value="active">${t('common.active')}</option>
              <option value="inactive">${t('common.inactive')}</option>
            </select>
          </div>
          
          <!-- Checkbox -->
          <label class="checkbox">
            <input type="checkbox" id="agree" name="agree" required />
            ${t('common.agreeTerms')}
          </label>
          
          <!-- Message Container for Feedback -->
          <div id="form-message"></div>
          
          <!-- Submit Button -->
          <button type="submit" class="btn btn-primary">
            ${icon(Icons.CHECK)}
            ${t('common.save')}
          </button>
        </form>
      </div>
    </div>
  `;
}

/**
 * Renders card grid items
 * @param {YourDataType} data - Data to render
 * @returns {string} HTML string
 */
function renderCards(data) {
  if (!data || !Array.isArray(data)) {
    return `<p class="text-muted">${t('common.noData')}</p>`;
  }
  
  return data.map(item => `
    <div class="card">
      <div class="card-title">${escapeHtml(item.title)}</div>
      <div class="stat">${item.count}</div>
      <p class="text-muted">${escapeHtml(item.description)}</p>
      <div class="button-group">
        <button 
          class="btn btn-primary btn-sm" 
          data-action="edit" 
          data-id="${item.id}"
        >
          ${icon(Icons.EDIT)}
          ${t('common.edit')}
        </button>
        <button 
          class="btn btn-danger btn-sm" 
          data-action="delete" 
          data-id="${item.id}"
        >
          ${icon(Icons.TRASH)}
          ${t('common.delete')}
        </button>
      </div>
    </div>
  `).join('');
}

/**
 * Renders table rows
 * @param {YourDataType} data - Data to render
 * @returns {string} HTML string
 */
function renderTableRows(data) {
  if (!data || !Array.isArray(data)) {
    return `
      <tr>
        <td colspan="4" class="text-center text-muted">
          ${t('common.noData')}
        </td>
      </tr>
    `;
  }
  
  return data.map(item => `
    <tr>
      <td>${escapeHtml(item.name)}</td>
      <td>${escapeHtml(item.email)}</td>
      <td>
        ${item.isActive 
          ? `<span class="badge badge-success">${t('common.active')}</span>` 
          : `<span class="badge">${t('common.inactive')}</span>`}
      </td>
      <td>
        <div class="button-group">
          <button 
            class="btn btn-sm btn-secondary" 
            data-action="view" 
            data-id="${item.id}"
          >
            ${icon(Icons.EYE)}
          </button>
          <button 
            class="btn btn-sm btn-primary" 
            data-action="edit" 
            data-id="${item.id}"
          >
            ${icon(Icons.EDIT)}
          </button>
          <button 
            class="btn btn-sm btn-danger" 
            data-action="delete" 
            data-id="${item.id}"
          >
            ${icon(Icons.TRASH)}
          </button>
        </div>
      </td>
    </tr>
  `).join('');
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
        <strong>${t('errors.generic')}</strong> ${escapeHtml(message)}
      </div>
    </div>
  `;
}

/**
 * Sets up all event handlers after view is rendered
 * @param {HTMLElement} el - Container element
 * @param {YourDataType} data - View data
 * @returns {void}
 */
function setupEventHandlers(el, data) {
  // Form submission
  const form = /** @type {HTMLFormElement|null} */ (el.querySelector('#example-form'));
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleFormSubmit(el, form);
    });
  }
  
  // Button clicks using event delegation
  el.addEventListener('click', async (e) => {
    const target = /** @type {HTMLElement} */ (e.target);
    const button = target.closest('button[data-action]');
    
    if (!button) return;
    
    const action = button.getAttribute('data-action');
    const id = button.getAttribute('data-id');
    
    switch (action) {
      case 'edit':
        await handleEdit(el, id);
        break;
      case 'delete':
        await handleDelete(el, id);
        break;
      case 'view':
        await handleView(el, id);
        break;
    }
  });
  
  // Password toggles
  setupPasswordToggles(el);
  
  // Add button
  const addBtn = el.querySelector('#add-btn');
  if (addBtn) {
    addBtn.addEventListener('click', () => handleAdd(el));
  }
}

/**
 * Handles form submission
 * @param {HTMLElement} el - Container element
 * @param {HTMLFormElement} form - Form element
 * @returns {Promise<void>}
 */
async function handleFormSubmit(el, form) {
  const messageEl = /** @type {HTMLElement|null} */ (el.querySelector('#form-message'));
  if (!messageEl) return;
  
  // Clear previous messages
  messageEl.innerHTML = '';
  messageEl.className = '';
  
  // Get form data
  const formData = new FormData(form);
  const name = formData.get('name');
  const password = formData.get('password');
  const status = formData.get('status');
  const agree = formData.get('agree');
  
  // Client-side validation
  if (!name || !password) {
    messageEl.textContent = t('errors.requiredFields');
    messageEl.className = 'alert alert-danger';
    return;
  }
  
  if (!agree) {
    messageEl.textContent = t('errors.mustAgreeTerms');
    messageEl.className = 'alert alert-danger';
    return;
  }
  
  try {
    // Prepare DTO
    /** @type {YourDtoType} */
    const dto = {
      name: name.toString(),
      password: password.toString(),
      status: status?.toString() || 'active'
    };
    
    // Make API call
    /** @type {ApiResponse} */
    const response = await api('/your-endpoint', {
      method: 'POST',
      body: dto
    });
    
    // Update CSRF token if returned
    if (response?.csrfToken) {
      setCsrfToken(response.csrfToken);
    }
    
    // Show success message
    messageEl.textContent = response.message || t('common.success');
    messageEl.className = 'alert alert-success';
    
    // Reset form
    form.reset();
    
    // Optional: Reload data or redirect
    setTimeout(() => {
      location.reload(); // or: location.hash = '/some-route';
    }, 1500);
    
  } catch (err) {
    const error = /** @type {Error} */ (err);
    messageEl.textContent = error.message || t('errors.generic');
    messageEl.className = 'alert alert-danger';
  }
}

/**
 * Handles edit action
 * @param {HTMLElement} el - Container element
 * @param {string|null} id - Item ID
 * @returns {Promise<void>}
 */
async function handleEdit(el, id) {
  if (!id) return;
  
  try {
    // Fetch item data
    /** @type {YourItemType} */
    const item = await api(`/your-endpoint/${id}`);
    
    // Populate form or navigate to edit view
    location.hash = `/edit/${id}`;
    
  } catch (err) {
    const error = /** @type {Error} */ (err);
    alert(error.message || t('errors.generic'));
  }
}

/**
 * Handles delete action
 * @param {HTMLElement} el - Container element
 * @param {string|null} id - Item ID
 * @returns {Promise<void>}
 */
async function handleDelete(el, id) {
  if (!id) return;
  
  // Confirm deletion
  if (!confirm(t('common.confirmDelete'))) {
    return;
  }
  
  try {
    /** @type {ApiResponse} */
    const response = await api(`/your-endpoint/${id}`, {
      method: 'DELETE'
    });
    
    // Update CSRF token if returned
    if (response?.csrfToken) {
      setCsrfToken(response.csrfToken);
    }
    
    // Reload view
    location.reload();
    
  } catch (err) {
    const error = /** @type {Error} */ (err);
    alert(error.message || t('errors.generic'));
  }
}

/**
 * Handles view action
 * @param {HTMLElement} el - Container element
 * @param {string|null} id - Item ID
 * @returns {Promise<void>}
 */
async function handleView(el, id) {
  if (!id) return;
  location.hash = `/view/${id}`;
}

/**
 * Handles add action
 * @param {HTMLElement} el - Container element
 * @returns {void}
 */
function handleAdd(el) {
  location.hash = '/add';
}

/**
 * Sets up password visibility toggle buttons
 * @param {HTMLElement} el - Container element
 * @returns {void}
 */
function setupPasswordToggles(el) {
  const toggleButtons = el.querySelectorAll('[data-toggle-password]');
  
  toggleButtons.forEach(button => {
    button.addEventListener('click', () => {
      const targetId = button.getAttribute('data-toggle-password');
      if (!targetId) return;
      
      const input = /** @type {HTMLInputElement|null} */ (el.querySelector(`#${targetId}`));
      if (!input) return;
      
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      button.innerHTML = isPassword ? icon(Icons.EYE_OFF) : icon(Icons.EYE);
      button.setAttribute('aria-label', isPassword ? t('common.hidePwd') : t('common.showPwd'));
    });
  });
}

/**
 * Formats an ISO date string to a readable format
 * @param {string} dateString - ISO date string
 * @returns {string} Formatted date
 */
function formatDate(dateString) {
  if (!dateString) return 'N/A';
  
  const date = new Date(dateString);
  const options = /** @type {Intl.DateTimeFormatOptions} */ ({
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  
  return date.toLocaleDateString('en-US', options);
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
```

## Authorization Pattern

For views that require specific user roles (e.g., Admin-only pages), use the authorization utilities:

### Role-Based Access Control

```javascript
import { hasRole, hasAnyRole, hasAllRoles, renderAccessDenied } from '../auth-utils.js';

// Check for a single role
if (!hasRole(user, 'Admin')) {
  el.innerHTML = renderAccessDenied(
    user,
    '/admin/users',  // Current route
    'Admin',         // Required role
    t('errors.adminAccessRequired')
  );
  return;
}

// Check for any of multiple roles
if (!hasAnyRole(user, ['Admin', 'Manager'])) {
  el.innerHTML = renderAccessDenied(
    user,
    '/protected-resource',
    'Admin or Manager',
    'You need to be an Admin or Manager to access this page.'
  );
  return;
}

// Check for all specified roles
if (!hasAllRoles(user, ['Admin', 'Moderator'])) {
  el.innerHTML = renderAccessDenied(
    user,
    '/super-admin',
    'Admin and Moderator',
    'You need both Admin and Moderator roles to access this page.'
  );
  return;
}
```

### Custom Access Denied Messages

```javascript
// With custom message and redirect route
el.innerHTML = renderAccessDenied(
  user,
  '/premium-feature',
  'Premium',
  'This feature is only available for premium users.',
  '/pricing'  // Redirect to pricing instead of home
);
```

### Function Signature

```javascript
renderAccessDenied(
  user,           // User object with userName and roles
  attemptedRoute, // Route that was accessed (e.g., '/admin/users')
  requiredRole,   // Required role(s) as string (e.g., 'Admin' or 'Admin or Manager')
  message,        // Optional custom message (uses translation key if not provided)
  redirectRoute   // Optional redirect route (default: '/home')
)
```

### Best Practices

- **Always check authorization** after fetching user data but before rendering sensitive content
- **Return early** after rendering access denied to prevent further execution
- **Use translation keys** for all error messages to support internationalization
- **Backend validation is mandatory** - Frontend checks are for UX only, backend must also validate
- **Logging is automatic** - `renderAccessDenied()` automatically logs unauthorized attempts to the backend as AUDIT logs
- **Provide context** - Always pass the current route and required role for proper logging
- **Silent failures** - If backend logging fails, the UI will not be blocked (error is logged to console only)

## Design Patterns & Components

### Cards
```html
<!-- Basic Card -->
<div class="card">
  <h3>${t('section.title')}</h3>
  <p>${t('section.description')}</p>
</div>

<!-- Card with Shadow -->
<div class="card shadow-md">
  <div class="card-title">${t('section.subtitle')}</div>
  <div class="stat">42</div>
  <p class="text-muted">${t('section.detail')}</p>
</div>
```

### Buttons
```html
<!-- Primary Button -->
<button class="btn btn-primary">${icon(Icons.PLUS)} ${t('common.add')}</button>

<!-- Secondary Button -->
<button class="btn btn-secondary">${t('common.cancel')}</button>

<!-- Success Button -->
<button class="btn btn-success">${icon(Icons.CHECK)} ${t('common.save')}</button>

<!-- Danger Button -->
<button class="btn btn-danger">${icon(Icons.TRASH)} ${t('common.delete')}</button>

<!-- Outline Button -->
<button class="btn btn-outline">${t('common.more')}</button>

<!-- Ghost Button -->
<button class="btn btn-ghost">${icon(Icons.X)} ${t('common.close')}</button>

<!-- Small Button -->
<button class="btn btn-primary btn-sm">${t('common.edit')}</button>

<!-- Block Button (Full Width) -->
<button class="btn btn-primary btn-block">${t('common.submit')}</button>

<!-- Icon-Only Button -->
<button class="btn btn-icon" aria-label="${t('common.settings')}">${icon(Icons.SETTINGS)}</button>

<!-- Button Group -->
<div class="button-group">
  <button class="btn btn-primary">${t('common.save')}</button>
  <button class="btn btn-secondary">${t('common.cancel')}</button>
</div>
```

### Alerts
```html
<!-- Success Alert -->
<div class="alert alert-success">
  <strong>${t('common.success')}!</strong> ${t('messages.saved')}
</div>

<!-- Error Alert -->
<div class="alert alert-danger">
  <strong>${t('errors.generic')}</strong> ${escapeHtml(error.message)}
</div>

<!-- Warning Alert -->
<div class="alert alert-warning">
  <strong>${t('common.warning')}!</strong> ${t('messages.warning')}
</div>

<!-- Info Alert -->
<div class="alert alert-info">
  <strong>${t('common.info')}</strong> ${t('messages.info')}
</div>
```

### Badges
```html
<!-- Default Badge -->
<span class="badge">${t('common.inactive')}</span>

<!-- Primary Badge -->
<span class="badge badge-primary">${t('common.new')}</span>

<!-- Success Badge -->
<span class="badge badge-success">${t('common.active')}</span>

<!-- Danger Badge -->
<span class="badge badge-danger">${t('common.blocked')}</span>

<!-- Warning Badge -->
<span class="badge badge-warning">${t('common.pending')}</span>
```

### Layout Components
```html
<!-- Section with Header -->
<div class="section">
  <div class="section-header">
    <h2 class="section-title mb-0">${t('section.title')}</h2>
    <button class="btn btn-primary">${t('common.add')}</button>
  </div>
</div>

<!-- Grid Layout (Responsive: 1 col mobile, 2 col tablet, 3 col desktop) -->
<div class="grid">
  <div class="card">...</div>
  <div class="card">...</div>
  <div class="card">...</div>
</div>
```

## Translation Keys Pattern

Add translations to `/wwwroot/locales/en.json` and `/wwwroot/locales/de.json`:

```json
{
  "yourSection": {
    "title": "Your Section Title",
    "description": "Description text",
    "addNew": "Add New",
    "formTitle": "Form Title",
    "namePlaceholder": "Enter name..."
  },
  "common": {
    "name": "Name",
    "email": "Email",
    "status": "Status",
    "actions": "Actions",
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "edit": "Edit",
    "view": "View",
    "add": "Add",
    "active": "Active",
    "inactive": "Inactive",
    "success": "Success",
    "warning": "Warning",
    "info": "Info",
    "noData": "No data available",
    "confirmDelete": "Are you sure you want to delete this item?",
    "showPwd": "Show password",
    "hidePwd": "Hide password",
    "passwordHint": "Minimum 6 characters",
    "agreeTerms": "I agree to the terms and conditions",
    "enabled": "Enabled",
    "disabled": "Disabled",
    "lastUpdate": "Last Updated"
  },
  "errors": {
    "generic": "An error occurred",
    "requiredFields": "Please fill in all required fields",
    "mustAgreeTerms": "You must agree to the terms and conditions"
  }
}
```

## Type Definitions

Add custom types to `/wwwroot/js/types.d.ts`:

```typescript
/**
 * Your custom data type
 */
interface YourDataType {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  createdAt: string;
}

/**
 * Your DTO type for API calls
 */
interface YourDtoType {
  name: string;
  password: string;
  status: string;
}

/**
 * Your item type
 */
interface YourItemType {
  id: string;
  name: string;
  description: string;
}
```

## Common Icons

Available icons from `Icons` enum:
- `PLUS` - Add/Create actions
- `EDIT` - Edit actions
- `TRASH` - Delete actions
- `CHECK` - Success/Confirm
- `X` - Close/Cancel
- `EYE` - View/Show
- `EYE_OFF` - Hide
- `KEY` - Password/Security
- `SETTINGS` - Settings/Config
- `USER` - User profile
- `USERS` - User management
- `MAIL` - Email
- `LOCK` - Security/Lock
- `UNLOCK` - Unlock
- `ARROW_LEFT` - Back/Previous
- `ARROW_RIGHT` - Next/Forward
- `CHEVRON_DOWN` - Dropdown
- `MENU` - Menu/Navigation
- `SEARCH` - Search
- `FILTER` - Filter
- `DOWNLOAD` - Download
- `UPLOAD` - Upload
- `REFRESH` - Reload/Refresh

## Best Practices Checklist

- [ ] All user inputs are escaped with `escapeHtml()`
- [ ] All strings use translation keys via `t()`
- [ ] CSRF token is updated after state-changing operations
- [ ] Unauthorized errors redirect to `/login`
- [ ] Authorization checks implemented for protected routes (Admin, etc.)
- [ ] Access denied view shown for insufficient permissions
- [ ] Forms show loading states during submission
- [ ] Error messages are user-friendly
- [ ] Success messages confirm actions
- [ ] Event delegation is used for dynamic content
- [ ] All functions have JSDoc type annotations
- [ ] No inline styles or scripts (CSP compliance)
- [ ] Mobile-responsive design (test at 375px width)
- [ ] Proper semantic HTML structure
- [ ] Accessible labels and ARIA attributes
- [ ] Form validation (client-side and server-side)
- [ ] Loading states for async operations

## Registration

Don't forget to register your view in `/wwwroot/js/app.js`:

```javascript
import { registerExampleView } from './views/example-view.js';

// In registerRoutes function:
registerExampleView(route);
```

## Testing Checklist

- [ ] Desktop layout works correctly
- [ ] Tablet layout (768px) works correctly
- [ ] Mobile layout (375px) works correctly
- [ ] Dark mode styling is correct
- [ ] All translations are present (EN and DE)
- [ ] Form submission works
- [ ] Error handling works
- [ ] Success messages appear
- [ ] CSRF token updates work
- [ ] Navigation works correctly
- [ ] Icons display properly
- [ ] Loading states show
- [ ] Unauthorized redirect works

## Common Pitfalls & Troubleshooting

### Event Listeners Not Working

**Problem:** Buttons or forms don't respond to clicks/submits

**Cause:** Event listeners attached before `el.innerHTML` is set

```javascript
// ❌ WRONG - Event listeners before innerHTML
export function registerExampleView(route) {
  route('/example', async el => {
    const button = el.querySelector('#my-button');  // null - element doesn't exist yet!
    button.addEventListener('click', handleClick);  // Error!
    
    el.innerHTML = `<button id="my-button">Click</button>`;
  });
}

// ✅ CORRECT - Event listeners after innerHTML
export function registerExampleView(route) {
  route('/example', async el => {
    el.innerHTML = `<button id="my-button">Click</button>`;
    
    const button = el.querySelector('#my-button');  // Now it exists!
    button.addEventListener('click', handleClick);
  });
}
```

### `el` is Undefined or Null

**Problem:** `el` is undefined in your route handler

**Cause:** Incorrect function signature or route registration

```javascript
// ❌ WRONG - Missing route parameter
export function registerExampleView() {  // Missing 'route' parameter!
  route('/example', async el => {  // 'route' is not defined
    // ...
  });
}

// ✅ CORRECT - Proper signature
export function registerExampleView(route) {
  route('/example', async el => {
    // el is properly passed by router
  });
}
```

### Changes Not Appearing After Navigation

**Problem:** Navigating back to a view shows old data

**Cause:** Data is cached or not re-fetched

```javascript
// ❌ WRONG - Data fetched outside route handler
const cachedData = await api('/data');  // Fetched once!

export function registerExampleView(route) {
  route('/example', async el => {
    el.innerHTML = renderView(cachedData);  // Always shows old data
  });
}

// ✅ CORRECT - Data fetched inside route handler
export function registerExampleView(route) {
  route('/example', async el => {
    const data = await api('/data');  // Fresh data every time!
    el.innerHTML = renderView(data);
  });
}
```

### View Not Showing After Route Registration

**Problem:** Route is registered but view doesn't appear

**Cause:** Forgot to register the view in `app.js`

```javascript
// In /wwwroot/js/app.js
import { registerExampleView } from './views/example-view.js';  // ← Must import

function registerRoutes() {
  // ... other routes
  registerExampleView(route);  // ← Must call
}
```

### TypeScript/JSDoc Errors in VSCode

**Problem:** Red squiggly lines for types that should exist

**Cause:** Type not defined in `types.d.ts`

**Solution:** Add your custom types to `/wwwroot/js/types.d.ts`

```typescript
// Add to types.d.ts
interface YourCustomType {
  id: string;
  name: string;
}
```
