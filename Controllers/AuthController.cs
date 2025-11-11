using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using sstore.Filters;
using sstore.Services;
using sstore.Models;
using System.ComponentModel.DataAnnotations;

namespace sstore.Controllers
{
    [ApiController]
    [Route("auth")]
    public class AuthController : ControllerBase
    {
        private readonly SignInManager<ApplicationUser> _signIn;
        private readonly UserManager<ApplicationUser> _users;
        private readonly ISecureCodeGenerator _codeGenerator;
        private readonly ITemporaryTokenService _tokenService;
        private readonly ISecurityNotificationService _securityNotification;
        private readonly ISessionManagementService _sessionManagement;

        private readonly IAntiforgery _anti;
        private readonly ISecureLogService _log;

        /// <summary>
        /// Constructor for the AuthController
        /// </summary>
        /// <param name="signIn">Sign in manager for ApplicationUser</param>
        /// <param name="users">User manager for ApplicationUser</param>
        /// <param name="anti">Antiforgery service</param>
        /// <param name="log">Logging service</param>
        /// <param name="codeGenerator">Secure code generator</param>
        /// <param name="tokenService">Temporary token service</param>
        /// <param name="notificationService">Security notification service</param>
        /// <param name="sessionManagement">Session management service</param>
        public AuthController(
            SignInManager<ApplicationUser> signIn,
            UserManager<ApplicationUser> users,
            IAntiforgery anti,
            ISecureLogService log,
            ISecureCodeGenerator codeGenerator,
            ITemporaryTokenService tokenService,
            ISecurityNotificationService notificationService,
            ISessionManagementService sessionManagement)
        {
            _signIn = signIn;
            _users = users;
            _anti = anti;
            _log = log;
            _codeGenerator = codeGenerator;
            _tokenService = tokenService;
            _securityNotification = notificationService;
            _sessionManagement = sessionManagement;
        }

        /// <summary>
        /// Returns current user information if authenticated
        /// </summary>
        /// <returns>User information or 401 if not authenticated</returns>
        [HttpGet("me")]
        [Authorize]
        public async Task<IActionResult> GetCurrentUser()
        {
            var user = await _users.GetUserAsync(User);
            if (user is null)
            {
                await _log.LogErrorAsync(
                    "GetCurrentUser",
                    "AuthController",
                    "User authenticated but not found in database");
                return Unauthorized();
            }

            var roles = await _users.GetRolesAsync(user);

            return Ok(new
            {
                id = user.Id,
                userName = user.UserName,
                email = user.Email,
                twoFactorEnabled = user.TwoFactorEnabled,
                twoFactorMethod = user.TwoFactorMethod,
                twoFactorEnforced = user.TwoFactorEnforced,
                roles = roles
            });
        }

        /// <summary>
        /// Logs a user in, using email and password.
        /// </summary>
        /// <param name="dto">The login data to use for authentication.</param>
        /// <returns>
        /// A result indicating whether the authentication was successful.
        /// If the user requires two factor authentication, the result will include a flag indicating this.
        /// </returns>
        [HttpPost("login")]
        [ValidateAntiForgeryApi]
        public async Task<IActionResult> Login([FromBody] LoginDto dto)
        {
            var user = await _users.FindByNameAsync(dto.Username)
                       ?? await _users.FindByEmailAsync(dto.Username);

            if (user is null)
            {
                await _log.LogAuditAsync(
                    "LoginAttempt",
                    "AuthController",
                    $"Failed login attempt for non-existent user: {dto.Username}",
                    "anonymous");
                return Unauthorized(new { error = "Invalid credentials" });
            }

            if (!await _users.IsEmailConfirmedAsync(user) && false) // ggf. erzwingen
            {
                await _log.LogAuditAsync(
                    "LoginAttempt",
                    "AuthController",
                    $"Login attempt with unconfirmed email",
                    user.Email ?? user.UserName);
                return Forbid();
            }

            var res = await _signIn.PasswordSignInAsync(user, dto.Password, dto.RememberMe, lockoutOnFailure: true);

            if (res.RequiresTwoFactor)
            {
                // Check if email-based 2FA is configured
                if (user.TwoFactorMethod == "Email")
                {
                    // Generate and send 2FA code via email
                    var code = _codeGenerator.GenerateNumericCode(6);
                    await _tokenService.StoreTokenAsync(
                        user,
                        "EmailTwoFactorLogin",
                        code,
                        TimeSpan.FromMinutes(10)
                    );

                    var emailService = HttpContext.RequestServices.GetRequiredService<IEmailService>();
                    await emailService.SendEmailAsync(
                        "2fa-code",
                        "Your Two-Factor Authentication Code",
                        user.Email!,
                        new Dictionary<string, object>
                        {
                            { "app_name", "S-Store" },
                            { "user_name", user.DisplayName },
                            { "verification_code", code },
                            { "expiry_minutes", 10 },
                            { "request_time", DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss UTC") },
                            { "ip_address", HttpContext.Connection.RemoteIpAddress?.ToString() ?? "Unknown" },
                            { "current_year", DateTime.UtcNow.Year }
                        },
                        user.DisplayName,
                        "system"
                    );

                    await _log.LogAuditAsync(
                        "LoginAttempt",
                        "AuthController",
                        "Login successful, 2FA email code sent",
                        user.Email ?? user.UserName);

                    return Ok(new { requires2fa = true, twoFactorMethod = "Email", email = user.Email });
                }

                await _log.LogAuditAsync(
                    "LoginAttempt",
                    "AuthController",
                    "Login successful, 2FA required",
                    user.Email ?? user.UserName);
                return Ok(new { requires2fa = true, twoFactorMethod = "Authenticator" });
            }

            if (!res.Succeeded)
            {
                // Check for lockout BEFORE generic error handling
                if (res.IsLockedOut)
                {
                    // Get lockout end time
                    var lockoutEnd = await _users.GetLockoutEndDateAsync(user);
                    var failedAttempts = await _users.GetAccessFailedCountAsync(user);

                    // Send lockout notification
                    await _securityNotification.NotifyAccountLockoutAsync(
                        user,
                        failedAttempts,
                        lockoutEnd ?? DateTimeOffset.UtcNow.AddMinutes(10)
                    );

                    await _log.LogAuditAsync(
                        "LoginAttempt",
                        "AuthController",
                        $"Account locked out after {failedAttempts} failed attempts",
                        user.Email ?? user.UserName);

                    return Unauthorized(new { error = "Account is locked. Check your email for details." });
                }

                var reason = res.IsNotAllowed ? "Login not allowed" : "Invalid credentials";

                await _log.LogAuditAsync(
                    "LoginAttempt",
                    "AuthController",
                    $"Failed login attempt: {reason}",
                    user.Email ?? user.UserName);

                return Unauthorized(new { error = "Invalid credentials" });
            }

            // CRITICAL: Regenerate session cookie to prevent session fixation
            await _sessionManagement.RegenerateCookieAsync(user, dto.RememberMe, "Successful login");

            // Check if 2FA is enforced but not yet configured
            if (user.TwoFactorEnforced == 1 && !user.TwoFactorEnabled)
            {
                await _log.LogAuditAsync(
                    "LoginSuccess",
                    "AuthController",
                    "User logged in but needs to set up 2FA",
                    user.Email ?? user.UserName);

                var tokens = _anti.GetAndStoreTokens(HttpContext);
                return Ok(new { ok = true, needsSetup2fa = true, csrfToken = tokens.RequestToken });
            }

            await _log.LogAuditAsync(
                "LoginSuccess",
                "AuthController",
                "User successfully logged in",
                user.Email ?? user.UserName);

            // Generate and return new CSRF token after successful login
            var loginTokens = _anti.GetAndStoreTokens(HttpContext);

            return Ok(new { ok = true, csrfToken = loginTokens.RequestToken });
        }

        /// <summary>
        /// Verifies the 2FA code from authenticator app
        /// </summary>
        /// <param name="dto">The verification data to use for authentication</param>
        /// <returns>A result indicating whether the verification was successful</returns>
        [HttpPost("2fa/verify-authenticator")]
        [ValidateAntiForgeryApi]
        public async Task<IActionResult> VerifyAuthenticator2Fa([FromBody] Verify2FaDto dto)
        {
            var res = await _signIn.TwoFactorAuthenticatorSignInAsync(dto.Code, isPersistent: true, rememberClient: dto.RememberThisDevice);

            if (!res.Succeeded)
            {
                await _log.LogAuditAsync(
                    "2FAVerification",
                    "AuthController",
                    "Failed 2FA authenticator verification attempt");
                return Unauthorized(new { error = "Invalid 2FA code" });
            }

            // Get user to regenerate session
            var user = await _signIn.GetTwoFactorAuthenticationUserAsync();
            if (user == null)
            {
                await _log.LogErrorAsync(
                    "2FAVerification",
                    "AuthController",
                    "User not found after successful 2FA verification");
                return Unauthorized(new { error = "Invalid 2FA session" });
            }

            // CRITICAL: Regenerate session cookie after 2FA verification
            await _sessionManagement.RegenerateCookieAsync(user, isPersistent: true, "Successful 2FA verification");


            await _log.LogAuditAsync(
                "2FAVerification",
                "AuthController",
                "Successful 2FA authenticator verification");

            // Generate and return new CSRF token after successful 2FA verification
            var tokens = _anti.GetAndStoreTokens(HttpContext);

            return Ok(new { ok = true, csrfToken = tokens.RequestToken });
        }

        /// <summary>
        /// Verifies the 2FA code from email
        /// </summary>
        /// <param name="dto">The verification data to use for authentication</param>
        /// <returns>A result indicating whether the verification was successful</returns>
        [HttpPost("2fa/verify-email")]
        [ValidateAntiForgeryApi]
        public async Task<IActionResult> VerifyEmail2Fa([FromBody] VerifyEmail2FaDto dto)
        {
            // Find user by email since we don't have the 2FA cookie
            var user = await _users.FindByEmailAsync(dto.Email);
            if (user == null)
            {
                await _log.LogErrorAsync(
                    "2FAEmailVerification",
                    "AuthController",
                    "User not found for email 2FA verification");
                return Unauthorized(new { error = "Invalid 2FA session" });
            }

            // Verify the code
            var isValid = await _tokenService.ValidateAndConsumeTokenAsync(
                user,
                "EmailTwoFactorLogin",
                dto.Code
            );

            if (!isValid)
            {
                await _log.LogAuditAsync(
                    "2FAEmailVerification",
                    "AuthController",
                    "Failed 2FA email verification - invalid or expired code",
                    user.Email ?? user.UserName);
                return Unauthorized(new { error = "Invalid or expired 2FA code" });
            }

            // CRITICAL: Regenerate session cookie after 2FA verification
            await _sessionManagement.RegenerateCookieAsync(user, isPersistent: true, "Successful 2FA email verification");

            await _log.LogAuditAsync(
                "2FAEmailVerification",
                "AuthController",
                "Successful 2FA email verification",
                user.Email ?? user.UserName);

            // Generate and return new CSRF token
            var tokens = _anti.GetAndStoreTokens(HttpContext);

            return Ok(new { ok = true, csrfToken = tokens.RequestToken });
        }

        /// <summary>
        /// Logs out the current user
        /// </summary>
        /// <returns>A result indicating whether the logout was successful</returns>
        [HttpPost("logout")]
        [ValidateAntiForgeryApi]
        public async Task<IActionResult> Logout()
        {
            var user = await _users.GetUserAsync(User);
            var userIdentifier = user?.Email ?? user?.UserName ?? "anonymous";

            await _signIn.SignOutAsync();

            await _log.LogAuditAsync(
                "Logout",
                "AuthController",
                "User logged out successfully",
                userIdentifier);

            // Generate and return new CSRF token
            var tokens = _anti.GetAndStoreTokens(HttpContext);

            return Ok(new { ok = true, csrfToken = tokens.RequestToken });
        }

        /// <summary>
        /// Resets two-factor authentication for a user (Admin only)
        /// </summary>
        /// <param name="dto">The user ID to reset 2FA for</param>
        /// <returns>A result indicating whether the reset was successful</returns>
        [Authorize(Roles = "Admin")]
        [HttpPut("2fa/reset")]
        [ValidateAntiForgeryApi]
        public async Task<IActionResult> Reset2Fa([FromBody] Reset2FaDto dto)
        {
            var user = await _users.FindByIdAsync(dto.UserId);
            if (user is null)
            {
                await _log.LogErrorAsync(
                    "Reset2FA",
                    "AuthController",
                    $"Attempted to reset 2FA for non-existent user ID: {dto.UserId}");
                return NotFound();
            }

            var currentUser = await _users.GetUserAsync(User);

            await _users.SetTwoFactorEnabledAsync(user, false);
            await _users.ResetAuthenticatorKeyAsync(user);
            user.TwoFactorMethod = null;
            await _users.UpdateAsync(user);

            // Send 2FA reset by admin notification
            await _securityNotification.NotifyTwoFactorResetByAdminAsync(
                user,
                currentUser?.Email ?? currentUser?.UserName ?? "Unknown Admin"
            );

            await _log.LogAuditAsync(
                "Reset2FA",
                "AuthController",
                $"Admin reset 2FA and disabled 2fa for user: {user.Email ?? user.UserName}",
                currentUser?.Email ?? currentUser?.UserName);

            // Generate and return new CSRF token
            var tokens = _anti.GetAndStoreTokens(HttpContext);

            return Ok(new { ok = true, csrfToken = tokens.RequestToken });
        }

        /// <summary>
        /// Initiates authenticator-based 2FA setup
        /// </summary>
        /// <returns>A result containing the OTP authentication URL and recovery codes</returns>
        [Authorize]
        [HttpPost("2fa/setup-authenticator")]
        [ValidateAntiForgeryApi]
        public async Task<IActionResult> SetupAuthenticator2Fa()
        {
            var user = await _users.GetUserAsync(User);
            if (user is null)
            {
                await _log.LogErrorAsync(
                    "Setup2FAAuthenticator",
                    "AuthController",
                    "User authenticated but not found in database");
                return Unauthorized();
            }

            // Reset authenticator key to get a new one
            await _users.ResetAuthenticatorKeyAsync(user);
            var key = await _users.GetAuthenticatorKeyAsync(user);

            if (string.IsNullOrEmpty(key))
            {
                await _log.LogErrorAsync(
                    "Setup2FAAuthenticator",
                    "AuthController",
                    "Failed to generate authenticator key");
                return BadRequest(new { error = "Failed to generate authenticator key" });
            }

            await _log.LogAuditAsync(
                "Setup2FAAuthenticator",
                "AuthController",
                "User initiated authenticator 2FA setup",
                user.Email ?? user.UserName);

            var issuer = Uri.EscapeDataString("S-Store");
            var label = Uri.EscapeDataString(user.UserName ?? user.Email ?? "user");
            var otpauth = $"otpauth://totp/{issuer}:{label}?secret={key}&issuer={issuer}&digits=6";

            // Generate and return new CSRF token
            var tokens = _anti.GetAndStoreTokens(HttpContext);

            return Ok(new { otpauth, key, csrfToken = tokens.RequestToken });
        }

        /// <summary>
        /// Verifies and completes authenticator-based 2FA setup
        /// </summary>
        /// <param name="dto">Verification code from authenticator app</param>
        /// <returns>Recovery codes if setup successful</returns>
        [Authorize]
        [HttpPost("2fa/verify-authenticator-setup")]
        [ValidateAntiForgeryApi]
        public async Task<IActionResult> VerifyAuthenticatorSetup([FromBody] VerifySetup2FaDto dto)
        {
            var user = await _users.GetUserAsync(User);
            if (user is null)
            {
                await _log.LogErrorAsync(
                    "VerifyAuthenticatorSetup",
                    "AuthController",
                    "User authenticated but not found in database");
                return Unauthorized();
            }

            // Verify the token
            var isValid = await _users.VerifyTwoFactorTokenAsync(user, _users.Options.Tokens.AuthenticatorTokenProvider, dto.Code);

            if (!isValid)
            {
                await _log.LogAuditAsync(
                    "VerifyAuthenticatorSetup",
                    "AuthController",
                    "Failed to verify authenticator setup code",
                    user.Email ?? user.UserName);
                return BadRequest(new { error = "Invalid verification code" });
            }

            // Enable 2FA
            await _users.SetTwoFactorEnabledAsync(user, true);
            user.TwoFactorMethod = "Authenticator";
            await _users.UpdateAsync(user);

            // Generate recovery codes
            var recoveryCodes = await _users.GenerateNewTwoFactorRecoveryCodesAsync(user, 10);

            await _log.LogAuditAsync(
                "VerifyAuthenticatorSetup",
                "AuthController",
                "Authenticator 2FA setup completed successfully",
                user.Email ?? user.UserName);

            var tokens = _anti.GetAndStoreTokens(HttpContext);

            return Ok(new { ok = true, recoveryCodes, csrfToken = tokens.RequestToken });
        }

        /// <summary>
        /// Initiates email-based 2FA setup
        /// </summary>
        /// <returns>Success message indicating email was sent</returns>
        [Authorize]
        [HttpPost("2fa/setup-email")]
        [ValidateAntiForgeryApi]
        public async Task<IActionResult> SetupEmail2Fa()
        {
            var user = await _users.GetUserAsync(User);
            if (user is null)
            {
                await _log.LogErrorAsync(
                    "Setup2FAEmail",
                    "AuthController",
                    "User authenticated but not found in database");
                return Unauthorized();
            }

            // Generate verification code
            var code = _codeGenerator.GenerateNumericCode(6);
            await _tokenService.StoreTokenAsync(
                user,
                "EmailTwoFactorSetup",
                code,
                TimeSpan.FromMinutes(10)
            );

            // Send email
            var emailService = HttpContext.RequestServices.GetRequiredService<IEmailService>();
            await emailService.SendEmailAsync(
                "2fa-code",
                "Setup Two-Factor Authentication",
                user.Email!,
                new Dictionary<string, object>
                {
                    { "app_name", "S-Store" },
                    { "user_name", user.DisplayName },
                    { "verification_code", code },
                    { "expiry_minutes", 10 },
                    { "request_time", DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss UTC") },
                    { "ip_address", HttpContext.Connection.RemoteIpAddress?.ToString() ?? "Unknown" },
                    { "current_year", DateTime.UtcNow.Year }
                },
                user.DisplayName,
                "system"
            );

            await _log.LogAuditAsync(
                "Setup2FAEmail",
                "AuthController",
                "User initiated email 2FA setup, code sent",
                user.Email ?? user.UserName);

            var tokens = _anti.GetAndStoreTokens(HttpContext);

            return Ok(new { ok = true, message = "Verification code sent to your email", csrfToken = tokens.RequestToken });
        }

        /// <summary>
        /// Verifies and completes email-based 2FA setup
        /// </summary>
        /// <param name="dto">Verification code from email</param>
        /// <returns>Recovery codes if setup successful</returns>
        [Authorize]
        [HttpPost("2fa/verify-email-setup")]
        [ValidateAntiForgeryApi]
        public async Task<IActionResult> VerifyEmailSetup([FromBody] VerifySetup2FaDto dto)
        {
            var user = await _users.GetUserAsync(User);
            if (user is null)
            {
                await _log.LogErrorAsync(
                    "VerifyEmailSetup",
                    "AuthController",
                    "User authenticated but not found in database");
                return Unauthorized();
            }

            // Validate token with expiration check
            var isValid = await _tokenService.ValidateAndConsumeTokenAsync(
                user,
                "EmailTwoFactorSetup",
                dto.Code
            );

            if (!isValid)
            {
                await _log.LogAuditAsync(
                    "VerifyEmailSetup",
                    "AuthController",
                    "Failed to verify email setup code - invalid or expired",
                    user.Email ?? user.UserName);
                return BadRequest(new { error = "Invalid or expired verification code" });
            }

            // Enable 2FA (Code wurde bereits automatisch entfernt)
            await _users.SetTwoFactorEnabledAsync(user, true);
            user.TwoFactorMethod = "Email";
            await _users.UpdateAsync(user);

            // Generate recovery codes
            var recoveryCodes = await _users.GenerateNewTwoFactorRecoveryCodesAsync(user, 10);

            await _log.LogAuditAsync(
                "VerifyEmailSetup",
                "AuthController",
                "Email 2FA setup completed successfully",
                user.Email ?? user.UserName);

            var tokens = _anti.GetAndStoreTokens(HttpContext);

            return Ok(new { ok = true, recoveryCodes, csrfToken = tokens.RequestToken });
        }

        /// <summary>
        /// Disables two-factor authentication for the current logged on user
        /// </summary>
        /// <returns>Result indicating success</returns>
        [Authorize]
        [HttpPost("2fa/disable")]
        [ValidateAntiForgeryApi]
        public async Task<IActionResult> Disable2Fa()
        {
            var user = await _users.GetUserAsync(User);
            if (user is null)
            {
                await _log.LogErrorAsync(
                    "Disable2FA",
                    "AuthController",
                    "User authenticated but not found in database");
                return Unauthorized();
            }

            if (user.TwoFactorEnforced == 1)
            {
                await _log.LogAuditAsync(
                    "Disable2FA",
                    "AuthController",
                    "User attempted to disable enforced 2FA",
                    user.Email ?? user.UserName);
                return BadRequest(new { error = "Two-factor authentication is enforced by administrator and cannot be disabled" });
            }

            await _users.SetTwoFactorEnabledAsync(user, false);
            await _users.ResetAuthenticatorKeyAsync(user);
            user.TwoFactorMethod = null;
            await _users.UpdateAsync(user);

            // Send 2FA disabled notification
            await _securityNotification.NotifyTwoFactorDisabledAsync(user);

            await _log.LogAuditAsync(
                "Disable2FA",
                "AuthController",
                "User disabled 2FA",
                user.Email ?? user.UserName);

            var tokens = _anti.GetAndStoreTokens(HttpContext);

            return Ok(new { ok = true, csrfToken = tokens.RequestToken });
        }

        /// <summary>
        /// Registers a new user account
        /// </summary>
        /// <param name="dto">Registration data including email, username, password, and optional names</param>
        /// <returns>Ok if registration successful and verification email sent</returns>
        [HttpPost("register")]
        [ValidateAntiForgeryApi]
        public async Task<IActionResult> Register([FromBody] RegisterDto dto)
        {
            // Check if email already exists
            var existingEmail = await _users.FindByEmailAsync(dto.Email);
            if (existingEmail != null)
            {
                await _log.LogAuditAsync(
                    "RegisterAttempt",
                    "AuthController",
                    $"Registration attempt with existing email",  // Email NICHT loggen!
                    "anonymous");

                // SECURITY: Return same message to prevent email enumeration
                await Task.Delay(Random.Shared.Next(100, 300));  // Timing attack mitigation

                var dummyTokens = _anti.GetAndStoreTokens(HttpContext);
                return Ok(new
                {
                    message = "Registration successful. Please check your email to verify your account.",
                    csrfToken = dummyTokens.RequestToken
                });
            }

            // Check if username already exists
            var existingUsername = await _users.FindByNameAsync(dto.Username);
            if (existingUsername != null)
            {
                await _log.LogAuditAsync(
                    "RegisterAttempt",
                    "AuthController",
                    $"Registration attempt with existing username: {dto.Username}",
                    "anonymous");
                return BadRequest(new { error = "Username already taken" });
            }

            // Create user
            var user = new ApplicationUser
            {
                UserName = dto.Username,
                Email = dto.Email,
                FirstName = dto.FirstName,
                LastName = dto.LastName,
                EmailConfirmed = false,
                CreatedAt = DateTime.UtcNow
            };

            var result = await _users.CreateAsync(user, dto.Password);

            if (!result.Succeeded)
            {
                var errors = string.Join(", ", result.Errors.Select(e => e.Description));
                await _log.LogErrorAsync(
                    "RegisterFailed",
                    "AuthController",
                    $"Failed to create user: {errors}",
                    dto.Email);
                return BadRequest(new { error = "Registration failed", details = result.Errors.Select(e => e.Description) });
            }

            // Generate email verification token
            var verificationToken = await _users.GenerateEmailConfirmationTokenAsync(user);

            // Generate a simple 6-digit verification code
            var verificationCode = _codeGenerator.GenerateNumericCode(6);

            await _tokenService.StoreTokenAsync(
                user,
                "EmailVerification",
                verificationCode,
                TimeSpan.FromHours(24)
            );

            // Send verification email
            var emailService = HttpContext.RequestServices.GetRequiredService<IEmailService>();

            var baseUrl = $"{Request.Scheme}://{Request.Host}";
            var verificationLink = $"{baseUrl}/#/verify-email?token={Uri.EscapeDataString(verificationToken)}&userId={user.Id}";
            var manualVerificationLink = $"{baseUrl}/#/verify-email";

            await emailService.SendEmailAsync(
                "verify-email",
                "Verify Your Email Address",
                user.Email!,
                new Dictionary<string, object>
                {
                    { "app_name", "S-Store" },
                    { "user_name", user.DisplayName },
                    { "verification_code", verificationCode },
                    { "verification_link", verificationLink },
                    { "manual_verification_link", manualVerificationLink },
                    { "expiry_hours", 24 },
                    { "current_year", DateTime.UtcNow.Year }
                },
                user.DisplayName,
                "system"
            );

            await _log.LogAuditAsync(
                "RegisterSuccess",
                "AuthController",
                $"New user registered",
                user.Email);

            // Generate and return new CSRF token
            var tokens = _anti.GetAndStoreTokens(HttpContext);

            return Ok(new
            {
                message = "Registration successful. Please check your email to verify your account.",
                csrfToken = tokens.RequestToken
            });
        }

        /// <summary>
        /// Verifies user email address using token
        /// </summary>
        /// <param name="dto">Email verification data with userId and token</param>
        /// <returns>Ok if verification successful</returns>
        [HttpPost("verify-email")]
        [ValidateAntiForgeryApi]
        public async Task<IActionResult> VerifyEmail([FromBody] VerifyEmailDto dto)
        {
            var user = await _users.FindByIdAsync(dto.UserId);
            if (user == null)
            {
                await _log.LogErrorAsync(
                    "VerifyEmail",
                    "AuthController",
                    $"Email verification attempted for non-existent user ID: {dto.UserId}");
                return BadRequest(new { error = "Invalid verification link" });
            }

            if (user.EmailConfirmed)
            {
                await _log.LogAuditAsync(
                    "VerifyEmail",
                    "AuthController",
                    "Email verification attempted for already confirmed user",
                    user.Email ?? user.UserName);
                return BadRequest(new { error = "Email already verified" });
            }

            // Verify using token
            var result = await _users.ConfirmEmailAsync(user, dto.Token);

            if (!result.Succeeded)
            {
                await _log.LogAuditAsync(
                    "VerifyEmailFailed",
                    "AuthController",
                    "Email verification failed - invalid or expired token",
                    user.Email ?? user.UserName);
                return BadRequest(new { error = "Invalid or expired verification token" });
            }

            // Clean up verification code
            await _users.RemoveAuthenticationTokenAsync(user, "EmailVerification", "VerificationCode");

            await _log.LogAuditAsync(
                "VerifyEmailSuccess",
                "AuthController",
                "Email verified successfully",
                user.Email ?? user.UserName);

            // Generate and return new CSRF token
            var tokens = _anti.GetAndStoreTokens(HttpContext);

            // send welcome Mail
            var sendWelcomeMail = Environment.GetEnvironmentVariable("SEND_WELCOME_MAIL_AFTER_EMAILCONFIRMATION")?.ToLower();
            if (!String.IsNullOrEmpty(sendWelcomeMail))
            {
                if (sendWelcomeMail == "true")
                {
                    var emailService = HttpContext.RequestServices.GetRequiredService<IEmailService>();
                    var templateData = new Dictionary<string, object>
                {
                    { "user_name", user.UserName! },
                    { "user_email", user.Email! },
                    { "app_name", "S-Store" },
                    { "login_url", $"{Request.Scheme}://{Request.Host}" },
                    { "current_year", DateTime.Now.Year }
                };

                    var job = await emailService.SendEmailAsync(
                        templateName: "welcome",
                        subject: "Welcome to S-Store!",
                        toEmail: user.Email!,
                        templateData: templateData,
                        toName: user.FirstName + " " + user.LastName,
                        triggeredBy: User.Identity?.Name
                    );

                    await _log.LogMailAsync(
                        "VerifyEmailCode",
                        "AuthController",
                        $"Welcome email queued for {user.Email}",
                        User.Identity?.Name
                    );
                }
            }


            return Ok(new
            {
                message = "Email verified successfully. You can now log in.",
                csrfToken = tokens.RequestToken
            });
        }

        /// <summary>
        /// Verifies user email address using verification code
        /// </summary>
        /// <param name="dto">Email verification data with email and code</param>
        /// <returns>Ok if verification successful</returns>
        [HttpPost("verify-email-code")]
        [ValidateAntiForgeryApi]
        public async Task<IActionResult> VerifyEmailCode([FromBody] VerifyEmailCodeDto dto)
        {
            var user = await _users.FindByEmailAsync(dto.Email);
            if (user == null)
            {
                await _log.LogErrorAsync(
                    "VerifyEmailCode",
                    "AuthController",
                    $"Email verification attempted for non-existent email: {dto.Email}");
                return BadRequest(new { error = "Invalid email or code" });
            }

            if (user.EmailConfirmed)
            {
                await _log.LogAuditAsync(
                    "VerifyEmailCode",
                    "AuthController",
                    "Email verification attempted for already confirmed user",
                    user.Email ?? user.UserName);
                return BadRequest(new { error = "Email already verified" });
            }

            // Validate token with expiration check
            var isValid = await _tokenService.ValidateAndConsumeTokenAsync(
                user,
                "EmailVerification",
                dto.Code
            );

            if (!isValid)
            {
                await _log.LogAuditAsync(
                    "VerifyEmailCode",
                    "AuthController",
                    "Email verification failed - invalid or expired code",
                    user.Email ?? user.UserName);
                return BadRequest(new { error = "Invalid or expired verification code" });
            }

            // Mark email as confirmed (Code wurde bereits automatisch entfernt)
            user.EmailConfirmed = true;
            await _users.UpdateAsync(user);

            await _log.LogAuditAsync(
                "VerifyEmailCode",
                "AuthController",
                "Email verified successfully using code",
                user.Email ?? user.UserName);

            // Generate and return new CSRF token
            var tokens = _anti.GetAndStoreTokens(HttpContext);

            // send welcome Mail
            var sendWelcomeMail = Environment.GetEnvironmentVariable("SEND_WELCOME_MAIL_AFTER_EMAILCONFIRMATION")?.ToLower();
            if (!String.IsNullOrEmpty(sendWelcomeMail))
            {
                if (sendWelcomeMail == "true")
                {
                    var emailService = HttpContext.RequestServices.GetRequiredService<IEmailService>();
                    var templateData = new Dictionary<string, object>
                {
                    { "user_name", user.UserName! },
                    { "user_email", user.Email! },
                    { "app_name", "S-Store" },
                    { "login_url", $"{Request.Scheme}://{Request.Host}" },
                    { "current_year", DateTime.Now.Year }
                };

                    var job = await emailService.SendEmailAsync(
                        templateName: "welcome",
                        subject: "Welcome to S-Store!",
                        toEmail: user.Email!,
                        templateData: templateData,
                        toName: user.FirstName + " " + user.LastName,
                        triggeredBy: User.Identity?.Name
                    );

                    await _log.LogMailAsync(
                        "VerifyEmailCode",
                        "AuthController",
                        $"Welcome email queued for {user.Email}",
                        User.Identity?.Name
                    );
                }
            }

            return Ok(new
            {
                message = "Email verified successfully. You can now log in.",
                csrfToken = tokens.RequestToken
            });
        }

        /// <summary>
        /// Resends verification email to user
        /// </summary>
        /// <param name="dto">Email address to resend verification to</param>
        /// <returns>Ok if email sent successfully</returns>
        [HttpPost("resend-verification")]
        [ValidateAntiForgeryApi]
        public async Task<IActionResult> ResendVerification([FromBody] ResendVerificationDto dto)
        {
            var user = await _users.FindByEmailAsync(dto.Email);
            if (user == null)
            {
                await _log.LogAuditAsync(
                    "ResendVerification",
                    "AuthController",
                    $"Verification resend attempted for non-existent email",  // no mail logging!
                    "anonymous");

                var dummyTokens = _anti.GetAndStoreTokens(HttpContext);
                return Ok(new
                {
                    message = "If this email is registered, a verification email will be sent.",
                    csrfToken = dummyTokens.RequestToken  // return tokrn on error too!
                });
            }

            if (user.EmailConfirmed)
            {
                await _log.LogAuditAsync(
                    "ResendVerification",
                    "AuthController",
                    "Verification resend attempted for already confirmed user",
                    user.Email ?? user.UserName);
                return BadRequest(new { error = "Email already verified" });
            }

            // Generate new verification token
            var verificationToken = await _users.GenerateEmailConfirmationTokenAsync(user);

            // Generate new 6-digit verification code
            var verificationCode = _codeGenerator.GenerateNumericCode(6);

            await _tokenService.StoreTokenAsync(
                user,
                "EmailVerification",
                verificationCode,
                TimeSpan.FromHours(24)
            );

            // Send verification email
            var emailService = HttpContext.RequestServices.GetRequiredService<IEmailService>();

            var baseUrl = $"{Request.Scheme}://{Request.Host}";
            var verificationLink = $"{baseUrl}/#/verify-email?token={Uri.EscapeDataString(verificationToken)}&userId={user.Id}";
            var manualVerificationLink = $"{baseUrl}/#/verify-email";

            await emailService.SendEmailAsync(
                "verify-email",
                "Verify Your Email Address",
                user.Email!,
                new Dictionary<string, object>
                {
                    { "app_name", "S-Store" },
                    { "user_name", user.DisplayName },
                    { "verification_code", verificationCode },
                    { "verification_link", verificationLink },
                    { "manual_verification_link", manualVerificationLink },
                    { "expiry_hours", 24 },
                    { "current_year", DateTime.UtcNow.Year }
                },
                user.DisplayName,
                user.Email
            );

            await _log.LogAuditAsync(
                "ResendVerificationSuccess",
                "AuthController",
                "Verification email resent",
                user.Email);

            // Generate and return new CSRF token
            var tokens = _anti.GetAndStoreTokens(HttpContext);

            return Ok(new
            {
                message = "If this email is registered, a verification email will be sent.",
                csrfToken = tokens.RequestToken
            });
        }

        /// <summary>
        /// Initiates password reset process by sending reset email
        /// </summary>
        /// <param name="dto">Email address to send password reset to</param>
        /// <returns>Ok response (doesn't reveal if email exists)</returns>
        [HttpPost("forgot-password")]
        [ValidateAntiForgeryApi]
        public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordDto dto)
        {
            var user = await _users.FindByEmailAsync(dto.Email);
            if (user == null)
            {
                // Don't reveal if email exists or not for security
                await _log.LogAuditAsync(
                    "ForgotPassword",
                    "AuthController",
                    $"Password reset attempted for non-existent email",
                    "anonymous");
                var dummyTokens = _anti.GetAndStoreTokens(HttpContext);
                return Ok(new
                {
                    message = "If this email is registered, a password reset link will be sent.",
                    csrfToken = dummyTokens.RequestToken
                });
            }

            if (!user.EmailConfirmed)
            {
                await _log.LogAuditAsync(
                    "ForgotPassword",
                    "AuthController",
                    "Password reset attempted for unconfirmed email",
                    user.Email ?? user.UserName);
                // Still return generic message for security
                var dummyTokens = _anti.GetAndStoreTokens(HttpContext);
                return Ok(new
                {
                    message = "If this email is registered, a password reset link will be sent.",
                    csrfToken = dummyTokens.RequestToken
                });
            }

            // Generate password reset token
            var resetToken = await _users.GeneratePasswordResetTokenAsync(user);

            // Generate secure 6-digit reset code with expiration
            var resetCode = _codeGenerator.GenerateNumericCode(6);
            await _tokenService.StoreTokenAsync(
                user,
                "PasswordReset",
                resetCode,
                TimeSpan.FromMinutes(30)
            );

            // Send password reset email
            var emailService = HttpContext.RequestServices.GetRequiredService<IEmailService>();

            var baseUrl = $"{Request.Scheme}://{Request.Host}";
            var resetUrl = $"{baseUrl}/#/reset-password?token={Uri.EscapeDataString(resetToken)}&email={Uri.EscapeDataString(user.Email!)}";

            await emailService.SendEmailAsync(
                "password-reset",
                "Password Reset Request",
                user.Email!,
                new Dictionary<string, object>
                {
                    { "app_name", "S-Store" },
                    { "user_name", user.DisplayName },
                    { "reset_url", resetUrl },
                    { "reset_token", resetCode },
                    { "expiry_minutes", 30 },
                    { "current_year", DateTime.UtcNow.Year }
                },
                user.DisplayName,
                "system"
            );

            await _log.LogAuditAsync(
                "ForgotPasswordSuccess",
                "AuthController",
                "Password reset email sent",
                user.Email);

            // Generate and return new CSRF token
            var tokens = _anti.GetAndStoreTokens(HttpContext);

            return Ok(new
            {
                message = "If this email is registered, a password reset link will be sent.",
                csrfToken = tokens.RequestToken
            });
        }

        /// <summary>
        /// Resets user password using token or code
        /// </summary>
        /// <param name="dto">Password reset data including email, token/code, and new password</param>
        /// <returns>Ok if password reset successful</returns>
        [HttpPost("reset-password")]
        [ValidateAntiForgeryApi]
        public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordDto dto)
        {
            var user = await _users.FindByEmailAsync(dto.Email);
            if (user == null)
            {
                await _log.LogErrorAsync(
                    "ResetPassword",
                    "AuthController",
                    $"Password reset attempted for non-existent email: {dto.Email}");
                return BadRequest(new { error = "Invalid reset request" });
            }

            bool isValid = false;
            IdentityResult? result = null;

            // Try token-based reset first if token is provided
            if (!string.IsNullOrEmpty(dto.Token))
            {
                result = await _users.ResetPasswordAsync(user, dto.Token, dto.NewPassword);
                isValid = result.Succeeded;
            }

            // If token failed or not provided, try code-based reset
            if (!isValid && !string.IsNullOrEmpty(dto.Code))
            {
                // Validate code with expiration check
                isValid = await _tokenService.ValidateAndConsumeTokenAsync(
                    user,
                    "PasswordReset",
                    dto.Code
                );

                if (isValid)
                {
                    // Generate new token for password reset
                    var token = await _users.GeneratePasswordResetTokenAsync(user);
                    result = await _users.ResetPasswordAsync(user, token, dto.NewPassword);
                    isValid = result?.Succeeded ?? false;
                }
            }

            if (!isValid || result == null || !result.Succeeded)
            {
                await _log.LogAuditAsync(
                    "ResetPasswordFailed",
                    "AuthController",
                    "Password reset failed - invalid or expired token/code",
                    user.Email ?? user.UserName);
                return BadRequest(new { error = "Invalid or expired reset token/code" });
            }

            // Update security stamp to invalidate existing login sessions
            await _users.UpdateSecurityStampAsync(user);

            // Send password changed notification
            await _securityNotification.NotifyPasswordChangedAsync(user);

            await _log.LogAuditAsync(
                "ResetPasswordSuccess",
                "AuthController",
                "Password reset successful",
                user.Email ?? user.UserName);

            // Generate and return new CSRF token
            var tokens = _anti.GetAndStoreTokens(HttpContext);

            return Ok(new
            {
                message = "Password reset successful. You can now log in with your new password.",
                csrfToken = tokens.RequestToken
            });
        }
    }

    /// <summary>
    /// Validated login DTO
    /// </summary>
    public record LoginDto
    {
        [Required(ErrorMessage = "Username is required")]
        [StringLength(256, MinimumLength = 3, ErrorMessage = "Username must be between 3 and 256 characters")]
        public required string Username { get; init; }

        [Required(ErrorMessage = "Password is required")]
        [StringLength(128, MinimumLength = 12, ErrorMessage = "Password must be between 12 and 128 characters")]
        public required string Password { get; init; }
        public bool RememberMe { get; init; }
    }

    /// <summary>
    /// Validated 2FA verification DTO
    /// </summary>
    public record Verify2FaDto
    {
        [Required(ErrorMessage = "2FA code is required")]
        [StringLength(6, MinimumLength = 6, ErrorMessage = "2FA code must be exactly 6 digits")]
        [RegularExpression(@"^\d{6}$", ErrorMessage = "2FA code must contain only digits")]
        public required string Code { get; init; }
        public bool RememberThisDevice { get; init; }
    }

    /// <summary>
    /// Validated 2FA email verification DTO
    /// </summary>
    public record VerifyEmail2FaDto
    {
        [Required(ErrorMessage = "Email is required")]
        [EmailAddress(ErrorMessage = "Invalid email format")]
        public required string Email { get; init; }

        [Required(ErrorMessage = "2FA code is required")]
        [StringLength(6, MinimumLength = 6, ErrorMessage = "2FA code must be exactly 6 digits")]
        public required string Code { get; init; }
        public bool RememberThisDevice { get; init; }
    };

    /// <summary>
    /// Validated 2FA setup DTO
    /// </summary>
    public record VerifySetup2FaDto
    {
        [Required(ErrorMessage = "2FA code is required")]
        [StringLength(6, MinimumLength = 6, ErrorMessage = "2FA code must be exactly 6 digits")]
        public required string Code { get; init; }
    };

    /// <summary>
    /// Validated 2FA reset DTO
    /// </summary>
    public record Reset2FaDto
    {
        [Required(ErrorMessage = "User ID is required")]
        [StringLength(256, MinimumLength = 3, ErrorMessage = "User ID must be between 3 and 256 characters")]
        public required string UserId { get; init; }

    };

    /// <summary>
    /// Validated registration DTO
    /// </summary>
    public record RegisterDto
    {
        [Required(ErrorMessage = "Email is required")]
        [EmailAddress(ErrorMessage = "Invalid email format")]
        [StringLength(256, ErrorMessage = "Email must not exceed 256 characters")]
        public required string Email { get; init; }

        [Required(ErrorMessage = "Username is required")]
        [StringLength(50, MinimumLength = 3, ErrorMessage = "Username must be between 3 and 50 characters")]
        [RegularExpression(@"^[a-zA-Z0-9._-]+$", ErrorMessage = "Username can only contain letters, numbers, dots, underscores and hyphens")]
        public required string Username { get; init; }

        [Required(ErrorMessage = "Password is required")]
        [StringLength(128, MinimumLength = 12, ErrorMessage = "Password must be between 12 and 128 characters")]
        public required string Password { get; init; }

        [StringLength(100, ErrorMessage = "First name must not exceed 100 characters")]
        [RegularExpression(@"^[a-zA-ZäöüÄÖÜß\s-]*$", ErrorMessage = "First name contains invalid characters")]
        public string? FirstName { get; init; }

        [StringLength(100, ErrorMessage = "Last name must not exceed 100 characters")]
        [RegularExpression(@"^[a-zA-ZäöüÄÖÜß\s-]*$", ErrorMessage = "Last name contains invalid characters")]
        public string? LastName { get; init; }
    }

    /// <summary>
    /// Validated email verification DTO
    /// </summary>
    public record VerifyEmailDto
    {
        [Required(ErrorMessage = "User ID is required")]
        [StringLength(128, ErrorMessage = "User ID must not exceed 128 characters")]
        public required string UserId { get; init; }

        [Required(ErrorMessage = "Token is required")]
        [StringLength(128, ErrorMessage = "Token must not exceed 128 characters")]
        public required string Token { get; init; }
    };

    /// <summary>
    /// Validated email verification DTO
    /// </summary>
    public record VerifyEmailCodeDto
    {
        [Required(ErrorMessage = "Email is required")]
        [EmailAddress(ErrorMessage = "Invalid email format")]
        [StringLength(256, ErrorMessage = "Email must not exceed 256 characters")]
        public required string Email { get; init; }

        [Required(ErrorMessage = "Verification code is required")]
        [StringLength(6, MinimumLength = 6, ErrorMessage = "Verification code must be exactly 6 digits")]
        [RegularExpression(@"^\d{6}$", ErrorMessage = "Verification code must contain only digits")]
        public required string Code { get; init; }
    };

    /// <summary>
    /// Validated resend verification DTO
    /// </summary>
    public record ResendVerificationDto
    {
        [Required(ErrorMessage = "Email is required")]
        [EmailAddress(ErrorMessage = "Invalid email format")]
        public required string Email { get; init; }
    };

    /// <summary>
    /// Validated forgot password DTO
    /// </summary>
    public record ForgotPasswordDto
    {
        [Required(ErrorMessage = "Email is required")]
        [EmailAddress(ErrorMessage = "Invalid email format")]
        public required string Email { get; init; }
    };

    /// <summary>
    /// Validated password reset DTO
    /// </summary>
    public record ResetPasswordDto
    {
        [Required(ErrorMessage = "Email is required")]
        [EmailAddress(ErrorMessage = "Invalid email format")]
        [StringLength(256, ErrorMessage = "Email must not exceed 256 characters")]
        public required string Email { get; init; }

        [StringLength(1000, ErrorMessage = "Token must not exceed 1000 characters")]
        public string? Token { get; init; }

        [StringLength(6, MinimumLength = 6, ErrorMessage = "Code must be exactly 6 digits")]
        [RegularExpression(@"^\d{6}$", ErrorMessage = "Code must contain only digits")]
        public string? Code { get; init; }

        [Required(ErrorMessage = "New password is required")]
        [StringLength(128, MinimumLength = 12, ErrorMessage = "Password must be between 12 and 128 characters")]
        public required string NewPassword { get; init; }
    }
}
