using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using sstore.Data;
using sstore.Filters;
using sstore.Models;
using sstore.Services;
using System.ComponentModel.DataAnnotations;

namespace sstore.Controllers
{
    /// <summary>
    /// Controller for audit log investigation (Admin only)
    /// Provides access to decrypt user information for incident response
    /// </summary>
    [ApiController]
    [Route("admin/audit")]
    [Authorize(Roles = "Admin, AuditInvestigator")]
    public class AuditInvestigationController : ControllerBase
    {
        private readonly AppDb _db;
        private readonly IDataProtectionService _dataProtection;
        private readonly IAntiforgery _anti;
        private readonly ISecureLogService _log;

        public AuditInvestigationController(
            AppDb db,
            IDataProtectionService dataProtection,
            ISecureLogService log,
            IAntiforgery anti)
        {
            _db = db;
            _dataProtection = dataProtection;
            _log = log;
            _anti = anti;
        }

        /// <summary>
        /// Get audit logs with optional decryption of user information
        /// </summary>
        /// <param name="decrypt">Whether to decrypt user information (requires justification)</param>
        /// <param name="justification">Reason for accessing encrypted data</param>
        /// <param name="limit">Maximum number of logs to return (default: 100, max: 1000)</param>
        /// <param name="category">Filter by log category (optional)</param>
        /// <param name="fromDate">Filter logs from this date (optional)</param>
        /// <param name="toDate">Filter logs until this date (optional)</param>
        /// <returns>List of audit logs with optionally decrypted user information</returns>
        [HttpGet]
        public async Task<IActionResult> GetAuditLogs(
            [FromQuery] bool decrypt = false,
            [FromQuery] string? justification = null,
            [FromQuery] int limit = 100,
            [FromQuery] LogCategory? category = null,
            [FromQuery] DateTime? fromDate = null,
            [FromQuery] DateTime? toDate = null)
        {
            // Validate justification if decryption is requested
            if (decrypt && string.IsNullOrWhiteSpace(justification))
            {
                return BadRequest(new { error = "Justification is required when accessing encrypted user data" });
            }

            // Limit maximum results
            if (limit > 1000) limit = 1000;
            if (limit < 1) limit = 100;

            // Build query
            var query = _db.Logs
                .Where(l => l.Category == LogCategory.AUDIT);

            if (fromDate.HasValue)
            {
                query = query.Where(l => l.Timestamp >= fromDate.Value);
            }

            if (toDate.HasValue)
            {
                query = query.Where(l => l.Timestamp <= toDate.Value);
            }

            var logs = await query
                .OrderByDescending(l => l.Timestamp)
                .Take(limit)
                .ToListAsync();

            // Log access to audit logs
            var adminUser = User.Identity?.Name ?? "unknown";
            await _log.LogAuditAsync(
                "GetAuditLogs",
                "AuditInvestigationController",
                decrypt 
                    ? $"Admin accessed audit logs WITH decryption. Justification: {justification}"
                    : "Admin accessed audit logs without decryption",
                adminUser);

            // Decrypt if requested
            if (decrypt)
            {
                var results = logs.Select(l => new
                {
                    l.Id,
                    l.Category,
                    l.Action,
                    l.Context,
                    l.Message,
                    l.Timestamp,
                    PseudonymizedUser = l.User,
                    DecryptedUser = !string.IsNullOrEmpty(l.EncryptedUserInfo)
                        ? _dataProtection.DecryptUserInfo(l.EncryptedUserInfo)
                        : null
                }).ToList();

                var tokens = _anti.GetAndStoreTokens(HttpContext);

                return Ok(new
                {
                    count = results.Count,
                    decrypted = true,
                    justification,
                    logs = results,
                    csrfToken = tokens.RequestToken
                });
            }

            // Return without decryption
            var tokenss = _anti.GetAndStoreTokens(HttpContext);

            return Ok(new
            {
                csrfToken = tokenss.RequestToken,
                count = logs.Count,
                decrypted = false,
                logs = logs.Select(l => new
                {
                    l.Id,
                    l.Category,
                    l.Action,
                    l.Context,
                    l.Message,
                    l.Timestamp,
                    User = l.User, // Only pseudonymized
                    HasEncryptedInfo = !string.IsNullOrEmpty(l.EncryptedUserInfo)
                })
            });
        }

        /// <summary>
        /// Decrypt a specific log entry's user information
        /// </summary>
        /// <param name="dto">Log ID and justification</param>
        /// <returns>Decrypted user information</returns>
        [HttpPost("decrypt")]
        [ValidateAntiForgeryApi]
        public async Task<IActionResult> DecryptLogEntry([FromBody] DecryptLogDto dto)
        {
            var log = await _db.Logs.FindAsync(dto.LogId);
            
            if (log == null)
            {
                return NotFound(new { error = "Log entry not found" });
            }

            if (string.IsNullOrEmpty(log.EncryptedUserInfo))
            {
                return BadRequest(new { error = "This log entry does not contain encrypted user information" });
            }

            // Decrypt the user information
            var decryptedUser = _dataProtection.DecryptUserInfo(log.EncryptedUserInfo);

            // Log the decryption access
            var adminUser = User.Identity?.Name ?? "unknown";
            await _log.LogAuditAsync(
                "AuditLogDecryption",
                "AuditInvestigationController",
                $"Admin decrypted log entry {dto.LogId}. Justification: {dto.Justification}",
                adminUser);

            var tokens = _anti.GetAndStoreTokens(HttpContext);

            return Ok(new
            {
                logId = log.Id,
                timestamp = log.Timestamp,
                action = log.Action,
                pseudonymizedUser = log.User,
                decryptedUser,
                justification = dto.Justification,
                decryptedBy = adminUser,
                decryptedAt = DateTime.UtcNow,
                csrfToken = tokens.RequestToken
            });
        }

        /// <summary>
        /// Search audit logs by pseudonymized user identifier
        /// Useful for tracking all actions of a specific user
        /// </summary>
        /// <param name="pseudonym">Pseudonymized user identifier (e.g., "user_abc123")</param>
        /// <param name="limit">Maximum number of logs to return</param>
        /// <returns>List of logs for the specified pseudonym</returns>
        [HttpGet("by-pseudonym/{pseudonym}")]
        public async Task<IActionResult> GetLogsByPseudonym(
            string pseudonym,
            [FromQuery] int limit = 100)
        {
            if (limit > 1000) limit = 1000;

            var logs = await _db.Logs
                .Where(l => l.User == pseudonym)
                .OrderByDescending(l => l.Timestamp)
                .Take(limit)
                .ToListAsync();

            var adminUser = User.Identity?.Name ?? "unknown";
            await _log.LogAuditAsync(
                "AuditLogSearch",
                "AuditInvestigationController",
                $"Admin searched logs by pseudonym: {pseudonym}",
                adminUser);

            var tokens = _anti.GetAndStoreTokens(HttpContext);

            return Ok(new
            {
                csrfToken = tokens.RequestToken,
                pseudonym,
                count = logs.Count,
                logs = logs.Select(l => new
                {
                    l.Id,
                    l.Category,
                    l.Action,
                    l.Context,
                    l.Message,
                    l.Timestamp,
                    HasEncryptedInfo = !string.IsNullOrEmpty(l.EncryptedUserInfo)
                })
            });
        }
    }

    /// <summary>
    /// DTO for decrypting a log entry
    /// </summary>
    public record DecryptLogDto
    {
        [Required(ErrorMessage = "Log ID is required")]
        public required long LogId { get; init; }

        [Required(ErrorMessage = "Justification is required")]
        [StringLength(500, MinimumLength = 10, ErrorMessage = "Justification must be between 10 and 500 characters")]
        public required string Justification { get; init; }
    }
}