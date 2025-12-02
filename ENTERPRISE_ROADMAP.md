# Enterprise Roadmap for S-Store

This document outlines a **phased roadmap** to evolve S-Store into a reusable boilerplate for **internal corporate applications**.

The focus is on:

- **Strong security** (auth, CSRF, CSP, logging, rate limiting – much of this already exists)
- **Enterprise identity & access control**
- **Operability & observability** (health, metrics, tracing)
- **Governance & configuration management**
- **User lifecycle management & admin UX**

Each phase lists **goals**, **concrete steps**, and **files/areas to touch**.

---

## Phase 1 – Enterprise Identity & Authorization

### Goals

- [ ] Integrate with corporate SSO (OpenID Connect / OAuth2).
- [ ] Move from pure role-based checks to **policy-based authorization**.
- [ ] Separate **global/system admins** from regular admins.

### 1.1 Add SSO via OpenID Connect

**Goal:** Allow corporate users to sign in with an enterprise IdP (e.g. Azure AD/Entra, Keycloak) while optionally keeping local accounts for service or break-glass admin.

**Steps (high level):**

1. **Configure OpenID Connect in `Program.cs`:**
   - Add authentication scheme (e.g. `AddOpenIdConnect("oidc", ...)`).
   - Bind settings (authority, client id, secret, callback URLs) from config/env.
2. **Map IdP claims to application identity:**
   - Map username/email from claims.
   - Map groups/roles from claims (e.g. `groups`, `roles`, or custom claim) into ASP.NET Identity roles.
3. **Decide login experience:**
   - Option A: Pure SSO – `/login` redirects directly to IdP.
   - Option B: Choice – show local login vs. corporate login button.
4. **Provision roles based on IdP groups:**
   - Add a service that, on login, ensures the user exists in Identity and synchronizes roles based on IdP claims.

**Touch points:**

- `Program.cs` – add OpenID Connect configuration.
- `Services/` – new service for external identity/role mapping (e.g. `IExternalIdentitySyncService`).
- `Controllers/AuthController.cs` – integrate SSO login/logout flows if needed.
- SPA: `wwwroot/js/views/login.js` – adapt UI if you want a separate "Sign in with corporate account" flow.

---

### 1.2 Introduce Policy-Based Authorization

**Goal:** Replace hard-coded role strings in controllers with named policies that can evolve without touching all controllers.

**Steps:**

1. **Define policies in `Program.cs`:**
   - Example:
     - `CanManageUsers` → requires role `Admin`.
     - `CanViewAuditLogs` → requires role `Admin` or `Security`.
     - `CanManageConfig` → requires role `GlobalAdmin`.
2. **Update controllers to use policies:**
   - Replace e.g. `[Authorize(Roles = "Admin")]` with `[Authorize(Policy = "CanManageUsers")]` on:
     - `AdminUsersController`
     - `AdminRolesController`
     - Any other admin/system controllers.
3. **Centralize role names:**
   - Define role-name constants and/or an enum equivalent in one place (e.g. `Roles.cs`).
   - Use those in policy definitions and any role assignment code.

**Touch points:**

- `Program.cs` – add authorization policies.
- `Controllers/*` – `Authorize` attributes updated to use policies.
- (Optional) `Models/Roles.cs` – centralized role names.

---

### 1.3 Admin Role Separation & Safeguards

**Goal:** Have clear separation of privileged users and prevent misconfiguration.

**Existing:**

- [x] `AdminUsersController.Delete` prevents deleting the **last Admin** and logs this.

**Next steps:**

- [ ] Introduce role hierarchy:
  - [ ] Add roles like `GlobalAdmin`, `SecurityAdmin`, `UserAdmin` as needed.
  - [ ] Map them from IdP groups if SSO is used.
- [ ] Restrict most sensitive operations to `GlobalAdmin` (config changes, rate limit adjustments, encryption key settings).
- [ ] Prevent removal of the last `GlobalAdmin` as well (mirror "last Admin" protection for `GlobalAdmin`).

**Touch points:**

- `AdminUsersController` – extend logic to handle `GlobalAdmin` if you add that role.
- `AdminRolesController` – ensure role deletes are safe with respect to role hierarchy.
- Policy definitions in `Program.cs`.

---

### 1.4 Optional Active Directory / LDAP Authentication

**Goal:** Allow selected users to authenticate against a corporate Active Directory/LDAP server instead of local passwords, controlled per user via `LdapLoginEnabled` and per environment via config.

**Behavior:**

- If a user has `LdapLoginEnabled == 1` and LDAP is enabled in the environment:
  - Login uses LDAP/AD to verify the password.
  - On success, the app signs in the user via ASP.NET Identity (cookie, 2FA, lockout, session regeneration all still apply).
- Otherwise, login behaves exactly as today (local Identity password).

**Steps (checklist):**

- [ ] Add LDAP/AD configuration (env or appsettings):
  - [ ] `LDAP_ENABLED=true|false`
  - [ ] `LDAP_SERVER_URL=ldaps://dc01.corp.local:636`
  - [ ] `LDAP_BIND_DN=CN=svc_ldap,OU=ServiceAccounts,DC=corp,DC=local`
  - [ ] `LDAP_BIND_PASSWORD=...`
  - [ ] `LDAP_BASE_DN=DC=corp,DC=local`
  - [ ] `LDAP_USER_FILTER=(sAMAccountName={username})` (or similar filter for your AD schema).
- [ ] Create `ILdapAuthService` + implementation in `Services/`:
  - [ ] Define `ILdapAuthService` interface.
  - [ ] Implement `LdapAuthService` (bind, search user DN, validate credentials, optional attribute sync) with LDAPS/TLS and safe logging.
- [ ] Wire `ILdapAuthService` into DI in `Program.cs` (only when `LDAP_ENABLED=true`, no-op otherwise).
- [ ] Integrate LDAP into the login flow in `AuthController` as described above.
- [ ] Adjust admin UX and safeguards:
  - [ ] Clarify LDAP toggle meaning in admin users view.
  - [ ] Optionally block enabling LDAP when `LDAP_ENABLED=false`.
  - [ ] Audit LDAP-related actions and failures with `ISecureLogService`.

This keeps LDAP/AD support **optional**, per environment and per user, while still reusing your existing auth, 2FA, and logging infrastructure.

---

## Phase 2 – Operability & Observability

### Goals

- [ ] Make the application **easy to monitor and operate**.
- [ ] Provide clear health endpoints, correlation IDs, and basic metrics.

### 2.1 Health Checks

**Goal:** Standard health endpoints for liveness and readiness.

**Steps:**

1. **Add HealthChecks to DI in `Program.cs`:**
   - `builder.Services.AddHealthChecks()`
     - Add a DB check (e.g. `AddDbContextCheck<AppDb>()`).
     - Optionally check other dependencies (email queue, external APIs).
2. **Map health endpoints:**
   - `/health/live` – returns OK if the app process is running.
   - `/health/ready` – returns OK only if DB and critical services are healthy.
3. **Wire into infra:**
   - Configure load balancer / Kubernetes to use these endpoints for liveness/readiness probes.

**Touch points:**

- `Program.cs` – HealthChecks configuration and `app.MapHealthChecks(...)`.

---

### 2.2 Correlation IDs & Enhanced Logging

**Goal:** Allow support teams to trace a single request through logs.

**Steps:**

1. **Add a correlation ID middleware:**
   - Check incoming header (e.g. `X-Correlation-ID`).
   - If missing, generate a new ID (e.g. GUID).
   - Store it in `HttpContext.Items`.
   - Add it as a response header.
2. **Integrate with `RequestLoggingMiddleware`:**
   - Include the correlation ID in every log entry.
3. **Update `ISecureLogService` usage:**
   - Ensure audit/error logs also carry the correlation ID.

**Touch points:**

- `Middleware/` – new `CorrelationIdMiddleware.cs`.
- `Program.cs` – register/use middleware.
- `RequestLoggingMiddleware` and `ISecureLogService` implementation.

---

### 2.3 Metrics (Basic)

**Goal:** Expose basic operational metrics.

**Options:**

- Use .NET built-in metrics + OpenTelemetry exporters.
- Or a light custom endpoint (`/metrics`) that exposes counters in Prometheus format.

**Suggested minimum metrics:**

- Total requests and errors per endpoint.
- Auth failures (login failures, 401s).
- Lockouts and 2FA failures.
- Email queue length / processing stats.

**Touch points:**

- `Program.cs` – metrics configuration.
- `RequestLoggingMiddleware` – increment counters.
- `EmailBackgroundService` – track queue size and processing metrics.

---

## Phase 3 – Governance & Configuration Management

### Goals

- [ ] Avoid unsafe changes via raw environment variables only.
- [ ] Provide a **config/feature management** system with auditing.

### 3.1 Feature & Config Flags in DB

**Goal:** Move "runtime-tunable" settings into the database with a small management UI.

**Candidates:**

- `SHOW_REGISTER_LINK_ON_LOGIN_PAGE`
- `SHOW_FORGOT_PASSWORD_LINK_ON_LOGIN_PAGE`
- Logging toggles (request logging enabled, body logging enabled).
- Security-related toggles (e.g. enforcing 2FA globally for all users).

**Steps:**

1. **Define a `ConfigSetting` entity in `Models/`:**
   - Key (string), Value (string), Type (string or enum), Description, UpdatedAt, UpdatedBy.
2. **Add migrations and DB set in `AppDb`:**
   - `DbSet<ConfigSetting> ConfigSettings`.
3. **Create a `ConfigService`:**
   - Typed getters (e.g. `GetBool("RequestLogging.Enabled")`).
   - Caching layer for performance.
4. **Expose an Admin API & SPA view:**
   - `ConfigController` with `[Authorize(Policy = "CanManageConfig")]`.
   - `wwwroot/js/views/admin-config.js` to list + edit config values.
5. **Audit changes:**
   - Use `ISecureLogService` to log all config changes (old/new values, user, timestamp).

**Touch points:**

- `Models/ConfigSetting.cs` (new).
- `Data/AppDb.cs` + migrations.
- `Services/ConfigService.cs` (new) + DI registration.
- `Controllers/ConfigController.cs` (new).
- `wwwroot/js/views/` – new admin config view.

---

### 3.2 Environment Safety Rails

**Goal:** Fail fast on obviously unsafe production configurations.

**Examples:**

- In `Program.cs`, at startup:
  - If environment is Production and `TRUST_ALL_PROXIES=true` → log error and **fail startup** (or at least warn loudly).
  - If environment is Production and `MIGRATION_ON_STARTUP=true` → log critical warning.

**Steps:**

1. Add a small validator on startup:
   - Read relevant env vars.
   - Throw/abort or log critical if combinations are unsafe.
2. Optionally expose a health indicator or config view flagging dangerous settings.

**Touch points:**

- `Program.cs` – env validation logic.
- (Optional) `ConfigController` / admin config UI – show warnings.

---

## Phase 4 – User Lifecycle & Security UX

### Goals

- [ ] Give admins and users better control over access.
- [ ] Fully leverage your existing session and 2FA infrastructure.

### 4.1 Session & Device Management

**Goal:** Allow users and admins to view and revoke sessions.

**Steps:**

1. **Back-end:**
   - Extend `ISessionManagementService` (or implement a session store) to:
     - List active sessions per user (device, last seen, IP, created at).
     - Revoke specific sessions.
2. **User UI:**
   - Profile page: "Active sessions" section.
   - Actions: `Log out this device`, `Log out all other devices`.
3. **Admin UI:**
   - Admin users view: actions to terminate all sessions for a selected user.

**Touch points:**

- `Services/SessionManagementService.cs` (implementation details).
- `Controllers/ProfileController.cs` – new endpoints to list/revoke sessions.
- `Controllers/AdminUsersController.cs` – admin-only session termination endpoints.
- SPA views: profile & admin-users.

---

### 4.2 Enforce 2FA for Privileged Roles

**Goal:** Ensure that admins cannot operate without 2FA.

**Steps:**

1. **Back-end rule:**
   - During login and 2FA verification, after successful auth, check:
     - If user has any privileged role (e.g. `Admin`, `GlobalAdmin`) and:
       - 2FA is not enabled → block access or force 2FA setup.
2. **Admin UI integration:**
   - In `AdminUsersController` and SPA admin-users view:
     - Show if 2FA is enforced/enabled for admins.
     - Provide a clear indication when an admin is non-compliant.
3. **Config-driven behavior:**
   - Add a config flag `Security.Require2FAForAdmins` (using the config service from Phase 3) to toggle strict enforcement.

**Touch points:**

- `AuthController` – integrate enforcement check post-login/2FA.
- `AdminUsersController` & `admin-users.js` – UX hints for enforced 2FA.
- Config infrastructure from Phase 3.

---

## Phase 5 – Testing, CI & Security Automation

### Goals

- [ ] Ensure changes keep security and critical flows intact.
- [ ] Provide an example CI pipeline teams can reuse.

### 5.1 Critical Flow Integration Tests

**Goal:** Automated tests for the most security-sensitive flows.

**Suggested tests:**

- Login (success/failure, lockout).
- 2FA: setup, login with code, invalid codes.
- Registration + email verification (both link and code).
- Password reset (request + complete).
- Admin: create/update/delete user, with checks for:
  - Last admin delete blocked.
  - 2FA enforcement if implemented.

**Touch points:**

- Create test project (if not already): `sstore.Tests/`.
- Use `WebApplicationFactory` (ASP.NET Core testing) to run integration tests.

---

### 5.2 CI Pipeline Template

**Goal:** Provide a reference CI pipeline file that others can copy.

**Stages:**

1. **Build & unit tests**
2. **Integration tests** (critical flows)
3. **Security checks:**
   - Dependency vulnerability scan.
   - Optional OWASP ZAP baseline scan against a test instance.
4. **Publish artifacts / deploy to test environment**

**Artifacts:**

- A `ci/` directory with example YAML (GitHub Actions, GitLab CI, Azure DevOps – choose what matches your environment).

---

## How to Use This Roadmap

- Treat each phase as a **separate workstream**. You dont have to complete a phase before touching the next, but the order reflects typical enterprise priorities.
- For each item you implement, update this file (or a changelog) to reflect your actual implementation details.
- Use this roadmap as documentation for new teams onboarding to S-Store as their internal app boilerplate.
