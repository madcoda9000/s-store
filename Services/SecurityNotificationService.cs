using sstore.Models;

namespace sstore.Services
{
    /// <summary>
    /// Implementation of security notification service
    /// </summary>
    public class SecurityNotificationService : ISecurityNotificationService
    {
        private readonly IEmailService _emailService;
        private readonly ISecureLogService _logService;
        private readonly IHttpContextAccessor _httpContextAccessor;

        public SecurityNotificationService(
            IEmailService emailService,
            ISecureLogService logService,
            IHttpContextAccessor httpContextAccessor)
        {
            _emailService = emailService;
            _logService = logService;
            _httpContextAccessor = httpContextAccessor;
        }

        /// <inheritdoc/>
        public async Task NotifyAccountLockoutAsync(ApplicationUser user, int failedAttempts, DateTimeOffset lockoutEnd)
        {
            var ipAddress = _httpContextAccessor.HttpContext?.Connection.RemoteIpAddress?.ToString() ?? "Unknown";
            
            await _emailService.SendEmailAsync(
                "security-alert",
                "Account Temporarily Locked",
                user.Email!,
                new Dictionary<string, object>
                {
                    { "app_name", "S-Store" },
                    { "user_name", user.DisplayName },
                    { "alert_type", "Account Lockout" },
                    { "alert_message", $"Your account has been temporarily locked due to {failedAttempts} failed login attempts." },
                    { "action_time", DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss UTC") },
                    { "lockout_until", lockoutEnd.ToString("yyyy-MM-dd HH:mm:ss UTC") },
                    { "ip_address", ipAddress },
                    { "action_required", "If this wasn't you, please reset your password immediately after the lockout expires." },
                    { "current_year", DateTime.UtcNow.Year }
                },
                user.DisplayName,
                "system"
            );

            await _logService.LogAuditAsync(
                "AccountLockoutNotification",
                "SecurityNotificationService",
                $"Account lockout notification sent. Failed attempts: {failedAttempts}",
                user.Email ?? user.UserName);
        }

        /// <inheritdoc/>
        public async Task NotifyPasswordChangedAsync(ApplicationUser user)
        {
            var ipAddress = _httpContextAccessor.HttpContext?.Connection.RemoteIpAddress?.ToString() ?? "Unknown";
            
            await _emailService.SendEmailAsync(
                "security-alert",
                "Password Changed Successfully",
                user.Email!,
                new Dictionary<string, object>
                {
                    { "app_name", "S-Store" },
                    { "user_name", user.DisplayName },
                    { "alert_type", "Password Changed" },
                    { "alert_message", "Your password was successfully changed." },
                    { "action_time", DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss UTC") },
                    { "ip_address", ipAddress },
                    { "action_required", "If you didn't make this change, please contact support immediately and secure your account." },
                    { "current_year", DateTime.UtcNow.Year }
                },
                user.DisplayName,
                "system"
            );

            await _logService.LogAuditAsync(
                "PasswordChangedNotification",
                "SecurityNotificationService",
                "Password changed notification sent",
                user.Email ?? user.UserName);
        }

        /// <inheritdoc/>
        public async Task NotifyTwoFactorDisabledAsync(ApplicationUser user)
        {
            var ipAddress = _httpContextAccessor.HttpContext?.Connection.RemoteIpAddress?.ToString() ?? "Unknown";
            
            await _emailService.SendEmailAsync(
                "security-alert",
                "Two-Factor Authentication Disabled",
                user.Email!,
                new Dictionary<string, object>
                {
                    { "app_name", "S-Store" },
                    { "user_name", user.DisplayName },
                    { "alert_type", "2FA Disabled" },
                    { "alert_message", "Two-factor authentication has been disabled on your account." },
                    { "action_time", DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss UTC") },
                    { "ip_address", ipAddress },
                    { "action_required", "If you didn't make this change, please re-enable 2FA immediately and change your password." },
                    { "current_year", DateTime.UtcNow.Year }
                },
                user.DisplayName,
                "system"
            );

            await _logService.LogAuditAsync(
                "TwoFactorDisabledNotification",
                "SecurityNotificationService",
                "2FA disabled notification sent",
                user.Email ?? user.UserName);
        }

        /// <inheritdoc/>
        public async Task NotifyTwoFactorResetByAdminAsync(ApplicationUser user, string adminUser)
        {
            await _emailService.SendEmailAsync(
                "security-alert",
                "Two-Factor Authentication Reset by Administrator",
                user.Email!,
                new Dictionary<string, object>
                {
                    { "app_name", "S-Store" },
                    { "user_name", user.DisplayName },
                    { "alert_type", "2FA Reset by Admin" },
                    { "alert_message", $"An administrator ({adminUser}) has reset your two-factor authentication settings." },
                    { "action_time", DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss UTC") },
                    { "ip_address", "Admin Action" },
                    { "action_required", "Please set up two-factor authentication again at your next login." },
                    { "current_year", DateTime.UtcNow.Year }
                },
                user.DisplayName,
                "system"
            );

            await _logService.LogAuditAsync(
                "TwoFactorResetNotification",
                "SecurityNotificationService",
                $"2FA reset notification sent. Reset by: {adminUser}",
                user.Email ?? user.UserName);
        }

        /// <inheritdoc/>
        public async Task NotifySuspiciousActivityAsync(ApplicationUser user, string activityType, string details)
        {
            var ipAddress = _httpContextAccessor.HttpContext?.Connection.RemoteIpAddress?.ToString() ?? "Unknown";
            
            await _emailService.SendEmailAsync(
                "security-alert",
                "Suspicious Activity Detected",
                user.Email!,
                new Dictionary<string, object>
                {
                    { "app_name", "S-Store" },
                    { "user_name", user.DisplayName },
                    { "alert_type", activityType },
                    { "alert_message", details },
                    { "action_time", DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss UTC") },
                    { "ip_address", ipAddress },
                    { "action_required", "If this wasn't you, please secure your account immediately by changing your password and enabling 2FA." },
                    { "current_year", DateTime.UtcNow.Year }
                },
                user.DisplayName,
                "system"
            );

            await _logService.LogAuditAsync(
                "SuspiciousActivityNotification",
                "SecurityNotificationService",
                $"Suspicious activity notification sent. Type: {activityType}",
                user.Email ?? user.UserName);
        }
    }
}