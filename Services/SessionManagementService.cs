using Microsoft.AspNetCore.Identity;
using sstore.Models;

namespace sstore.Services
{
    /// <summary>
    /// Implementation of session management
    /// </summary>
    public class SessionManagementService : ISessionManagementService
    {
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly SignInManager<ApplicationUser> _signInManager;
        private readonly ISecureLogService _logService;

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
                $"All sessions invalidated for security reasons",
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
    }
}