using sstore.Models;

namespace sstore.Services
{
    /// <summary>
    /// Service interface for logging operations across the application
    /// </summary>
    public interface ILogService
    {
        /// <summary>
        /// Logs an error event
        /// </summary>
        /// <param name="action">The action or method where the error occurred</param>
        /// <param name="context">The context (class name, controller, etc.)</param>
        /// <param name="message">Detailed error message</param>
        /// <param name="user">The user identifier (defaults to anonymous if null)</param>
        /// <returns>The created log entry</returns>
        Task<Log> LogErrorAsync(string action, string context, string message, string? user = null);

        /// <summary>
        /// Logs an audit event (security-relevant actions)
        /// </summary>
        /// <param name="action">The action being audited</param>
        /// <param name="context">The context where the action occurred</param>
        /// <param name="message">Audit message</param>
        /// <param name="user">The user identifier (defaults to anonymous if null)</param>
        /// <returns>The created log entry</returns>
        Task<Log> LogAuditAsync(string action, string context, string message, string? user = null);

        /// <summary>
        /// Logs an HTTP request
        /// </summary>
        /// <param name="action">The HTTP method and endpoint</param>
        /// <param name="context">Request context information</param>
        /// <param name="message">Request details</param>
        /// <param name="user">The user identifier (defaults to anonymous if null)</param>
        /// <returns>The created log entry</returns>
        Task<Log> LogRequestAsync(string action, string context, string message, string? user = null);

        /// <summary>
        /// Logs a mail operation
        /// </summary>
        /// <param name="action">The mail action (send, queue, fail)</param>
        /// <param name="context">Mail context (recipient, subject, etc.)</param>
        /// <param name="message">Mail operation details</param>
        /// <param name="user">The user identifier (defaults to anonymous if null)</param>
        /// <returns>The created log entry</returns>
        Task<Log> LogMailAsync(string action, string context, string message, string? user = null);

        /// <summary>
        /// Logs a system event
        /// </summary>
        /// <param name="action">The system action</param>
        /// <param name="context">System context</param>
        /// <param name="message">System event details</param>
        /// <param name="user">The user identifier (defaults to anonymous if null)</param>
        /// <returns>The created log entry</returns>
        Task<Log> LogSystemAsync(string action, string context, string message, string? user = null);

        /// <summary>
        /// Generic log method for custom categories
        /// </summary>
        /// <param name="category">The log category</param>
        /// <param name="action">The action</param>
        /// <param name="context">The context</param>
        /// <param name="message">The message</param>
        /// <param name="user">The user identifier (defaults to anonymous if null)</param>
        /// <returns>The created log entry</returns>
        Task<Log> LogAsync(LogCategory category, string action, string context, string message, string? user = null);
    }
}
