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
    }
}