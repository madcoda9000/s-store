using Microsoft.AspNetCore.Identity;
using sstore.Models;

namespace sstore.Services
{
    /// <summary>
    /// Service for managing user sessions securely
    /// </summary>
    public interface ISessionManagementService
    {
        /// <summary>
        /// Invalidates all sessions for a user (e.g., after password change)
        /// </summary>
        Task InvalidateAllSessionsAsync(ApplicationUser user);
        
        /// <summary>
        /// Refreshes security stamp and logs action
        /// </summary>
        Task<bool> RefreshSecurityStampAsync(ApplicationUser user, string reason);

        /// <summary>
        /// Regenerates authentication cookie to prevent session fixation attacks.
        /// This should be called after successful authentication (login or 2FA).
        /// </summary>
        /// <param name="user">User to authenticate</param>
        /// <param name="isPersistent">Whether the cookie should persist across browser sessions</param>
        /// <param name="reason">Reason for regeneration (for audit logging)</param>
        Task RegenerateCookieAsync(ApplicationUser user, bool isPersistent, string reason);
    }
}