using sstore.Data;
using sstore.Models;
using Microsoft.AspNetCore.Identity;

namespace sstore.Services
{
    /// <summary>
    /// Service implementation for logging operations
    /// </summary>
    public class LogService : ILogService
    {
        private readonly AppDb _db;
        private readonly IHttpContextAccessor _httpContextAccessor;
        private readonly UserManager<ApplicationUser> _userManager;

        public LogService(AppDb db, IHttpContextAccessor httpContextAccessor, UserManager<ApplicationUser> userManager)
        {
            _db = db;
            _httpContextAccessor = httpContextAccessor;
            _userManager = userManager;
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
            var logEntry = new Log
            {
                Category = category,
                Action = action,
                Context = context,
                Message = message,
                User = await GetUserIdentifierAsync(user),
                Timestamp = DateTime.UtcNow
            };

            _db.Logs.Add(logEntry);
            await _db.SaveChangesAsync();

            return logEntry;
        }

        /// <summary>
        /// Gets the user identifier from the provided string or current HTTP context
        /// </summary>
        /// <param name="user">Optional user identifier</param>
        /// <returns>User identifier or "anonymous" if not available</returns>
        private async Task<string> GetUserIdentifierAsync(string? user)
        {
            // If user is explicitly provided, use it
            if (!string.IsNullOrEmpty(user))
            {
                return user;
            }

            // Try to get user from HTTP context
            var httpContext = _httpContextAccessor.HttpContext;
            if (httpContext?.User?.Identity?.IsAuthenticated == true)
            {
                var currentUser = await _userManager.GetUserAsync(httpContext.User);
                if (currentUser != null)
                {
                    return currentUser.Email ?? currentUser.UserName ?? "anonymous";
                }
            }

            return "anonymous";
        }
    }
}
