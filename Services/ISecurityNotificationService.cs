using sstore.Models;

namespace sstore.Services
{
    /// <summary>
    /// Service for sending security notifications to users
    /// </summary>
    public interface ISecurityNotificationService
    {
        /// <summary>
        /// Sends account lockout notification
        /// </summary>
        /// <param name="user">The locked out user</param>
        /// <param name="failedAttempts">Number of failed login attempts</param>
        /// <param name="lockoutEnd">When the lockout expires</param>
        Task NotifyAccountLockoutAsync(ApplicationUser user, int failedAttempts, DateTimeOffset lockoutEnd);

        /// <summary>
        /// Sends password changed notification
        /// </summary>
        /// <param name="user">The user whose password was changed</param>
        Task NotifyPasswordChangedAsync(ApplicationUser user);

        /// <summary>
        /// Sends 2FA disabled notification
        /// </summary>
        /// <param name="user">The user whose 2FA was disabled</param>
        Task NotifyTwoFactorDisabledAsync(ApplicationUser user);

        /// <summary>
        /// Sends 2FA reset notification (admin action)
        /// </summary>
        /// <param name="user">The user whose 2FA was reset</param>
        /// <param name="adminUser">The admin who performed the reset</param>
        Task NotifyTwoFactorResetByAdminAsync(ApplicationUser user, string adminUser);

        /// <summary>
        /// Sends suspicious activity notification
        /// </summary>
        /// <param name="user">The affected user</param>
        /// <param name="activityType">Type of suspicious activity</param>
        /// <param name="details">Additional details</param>
        Task NotifySuspiciousActivityAsync(ApplicationUser user, string activityType, string details);
    }
}