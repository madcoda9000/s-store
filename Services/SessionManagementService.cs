using Microsoft.AspNetCore.Identity;
using sstore.Models;

namespace sstore.Services
{
    /// <summary>
    /// Implementation of session management with security features
    /// </summary>
    public class SessionManagementService : ISessionManagementService
    {
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly SignInManager<ApplicationUser> _signInManager;
        private readonly ISecureLogService _logService;

        /// <summary>
        /// Constructor for SessionManagementService
        /// </summary>
        /// <param name="userManager">User manager for ApplicationUser</param>
        /// <param name="signInManager">Sign in manager for ApplicationUser</param>
        /// <param name="logService">Logging service</param>
        public SessionManagementService(
            UserManager<ApplicationUser> userManager,
            SignInManager<ApplicationUser> signInManager,
            ISecureLogService logService)
        {
            _userManager = userManager;
            _signInManager = signInManager;
            _logService = logService;
        }

        /// <inheritdoc/>
        public async Task InvalidateAllSessionsAsync(ApplicationUser user)
        {
            // Update security stamp - this invalidates all existing sessions
            await _userManager.UpdateSecurityStampAsync(user);

            // Sign out current user if they're the one making the change
            await _signInManager.SignOutAsync();

            await _logService.LogAuditAsync(
                "InvalidateAllSessions",
                "SessionManagementService",
                "All sessions invalidated for security reasons",
                user.Email ?? user.UserName);
        }

        /// <inheritdoc/>
        public async Task<bool> RefreshSecurityStampAsync(ApplicationUser user, string reason)
        {
            var result = await _userManager.UpdateSecurityStampAsync(user);

            if (result.Succeeded)
            {
                await _logService.LogAuditAsync(
                    "RefreshSecurityStamp",
                    "SessionManagementService",
                    $"Security stamp refreshed. Reason: {reason}",
                    user.Email ?? user.UserName);
            }
            else
            {
                await _logService.LogErrorAsync(
                    "RefreshSecurityStamp",
                    "SessionManagementService",
                    $"Failed to refresh security stamp. Reason: {reason}",
                    user.Email ?? user.UserName);
            }

            return result.Succeeded;
        }

        /// <inheritdoc/>
        public async Task RegenerateCookieAsync(ApplicationUser user, bool isPersistent, string reason)
        {
            // CRITICAL: Sign out first to invalidate old cookie
            // This prevents session fixation attacks where an attacker could
            // set a victim's session cookie before authentication
            await _signInManager.SignOutAsync();

            // Sign in with a NEW authentication cookie
            // This generates a fresh cookie with new values
            await _signInManager.SignInAsync(user, isPersistent);

            // Update security stamp for additional security
            // This invalidates any other sessions that might exist
            await _userManager.UpdateSecurityStampAsync(user);

            await _logService.LogAuditAsync(
                "RegenerateCookie",
                "SessionManagementService",
                $"Authentication cookie regenerated. Reason: {reason}",
                user.Email ?? user.UserName);
        }
    }
}