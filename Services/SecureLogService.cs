using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Identity;
using sstore.Data;
using sstore.Models;

namespace sstore.Services
{
    /// <summary>
    /// Secure logging service with dual privacy approach:
    /// - Pseudonymization (one-way) for tracking
    /// - Encryption (reversible) for audit investigation
    /// </summary>
    public class SecureLogService : ISecureLogService
    {
        private readonly AppDb _db;
        private readonly IHttpContextAccessor _httpContextAccessor;
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly IDataProtectionService _dataProtection;

        public SecureLogService(
            AppDb db, 
            IHttpContextAccessor httpContextAccessor, 
            UserManager<ApplicationUser> userManager,
            IDataProtectionService dataProtection)
        {
            _db = db;
            _httpContextAccessor = httpContextAccessor;
            _userManager = userManager;
            _dataProtection = dataProtection;
        }

        /// <inheritdoc/>
        public async Task<Log> LogErrorAsync(string action, string context, string message, string? user = null)
        {
            return await LogAsync(LogCategory.ERROR, action, context, message, user);
        }

        /// <inheritdoc/>
        public async Task<Log> LogAuditAsync(string action, string context, string message, string? user = null)
        {
            return await LogAsync(LogCategory.AUDIT, action, context, message, user);
        }

        /// <inheritdoc/>
        public async Task<Log> LogRequestAsync(string action, string context, string message, string? user = null)
        {
            return await LogAsync(LogCategory.REQUEST, action, context, message, user);
        }

        /// <inheritdoc/>
        public async Task<Log> LogMailAsync(string action, string context, string message, string? user = null)
        {
            return await LogAsync(LogCategory.MAIL, action, context, message, user);
        }

        /// <inheritdoc/>
        public async Task<Log> LogSystemAsync(string action, string context, string message, string? user = null)
        {
            return await LogAsync(LogCategory.SYSTEM, action, context, message, user);
        }

        /// <inheritdoc/>
        public async Task<Log> LogAsync(LogCategory category, string action, string context, string message, string? user = null)
        {
            // Get user identifier
            var userIdentifier = await GetUserIdentifierAsync(user);
            
            // Always pseudonymize for tracking and correlation
            var pseudonymizedUser = _dataProtection.PseudonymizeEmail(userIdentifier);

            // For AUDIT and ERROR logs: Also encrypt the actual identifier (reversible)
            // For other logs (REQUEST, SYSTEM, MAIL): No encryption needed
            string? encryptedUserInfo = null;
            if (category == LogCategory.AUDIT || category == LogCategory.ERROR)
            {
                // Only encrypt if not "anonymous" or "system"
                if (userIdentifier != "anonymous" && userIdentifier != "system")
                {
                    encryptedUserInfo = _dataProtection.EncryptUserInfo(userIdentifier);
                }
            }

            var logEntry = new Log
            {
                Category = category,
                Action = action,
                Context = context,
                Message = message, // Message should not contain PII
                User = pseudonymizedUser, // Pseudonymized for tracking
                EncryptedUserInfo = encryptedUserInfo, // Encrypted for investigation (only AUDIT/ERROR)
                Timestamp = DateTime.UtcNow
            };

            _db.Logs.Add(logEntry);
            await _db.SaveChangesAsync();

            return logEntry;
        }

        private async Task<string> GetUserIdentifierAsync(string? user)
        {
            if (!string.IsNullOrEmpty(user))
                return user;

            var httpContext = _httpContextAccessor.HttpContext;
            if (httpContext?.User?.Identity?.IsAuthenticated == true)
            {
                var currentUser = await _userManager.GetUserAsync(httpContext.User);
                if (currentUser != null)
                    return currentUser.Email ?? currentUser.UserName ?? "anonymous";
            }

            return "anonymous";
        }
    }
}