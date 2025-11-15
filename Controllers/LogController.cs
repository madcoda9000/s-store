using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using sstore.Filters;
using sstore.Models;
using sstore.Services;
using Microsoft.AspNetCore.Antiforgery;
using sstore.Data;
using Microsoft.EntityFrameworkCore;

namespace sstore.Controllers
{
    /// <summary>
    /// Controller for logging operations from frontend
    /// </summary>
    [ApiController]
    [Route("log")]
    [Authorize]
    public class LogController : ControllerBase
    {
        private readonly ISecureLogService _log;
        private readonly IAntiforgery _anti;
        private readonly AppDb _db;

        public LogController(ISecureLogService log, IAntiforgery anti, AppDb db)
        {
            _log = log;
            _anti = anti;
            _db = db;
        }

        /// <summary>
        /// Creates a log entry from the frontend
        /// </summary>
        /// <param name="dto">The log data to create</param>
        /// <returns>The created log entry</returns>
        [HttpPost]
        [ValidateAntiForgeryApi]
        public async Task<IActionResult> CreateLog([FromBody] CreateLogDto dto)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            Log logEntry;

            try
            {
                logEntry = dto.Category switch
                {
                    LogCategory.ERROR => await _log.LogErrorAsync(dto.Action, dto.Context, dto.Message),
                    LogCategory.AUDIT => await _log.LogAuditAsync(dto.Action, dto.Context, dto.Message),
                    LogCategory.REQUEST => await _log.LogRequestAsync(dto.Action, dto.Context, dto.Message),
                    LogCategory.MAIL => await _log.LogMailAsync(dto.Action, dto.Context, dto.Message),
                    LogCategory.SYSTEM => await _log.LogSystemAsync(dto.Action, dto.Context, dto.Message),
                    _ => throw new ArgumentException($"Invalid log category: {dto.Category}")
                };
            }
            catch (Exception ex)
            {
                return BadRequest(new { error = $"Failed to create log entry: {ex.Message}" });
            }

            var tokens = _anti.GetAndStoreTokens(HttpContext);

            return Ok(new
            {
                id = logEntry.Id,
                category = logEntry.Category.ToString(),
                action = logEntry.Action,
                context = logEntry.Context,
                message = logEntry.Message,
                user = logEntry.User,
                timestamp = logEntry.Timestamp,
                csrfToken = tokens.RequestToken
            });
        }

        /// <summary>
        /// Creates an error log entry from the frontend
        /// </summary>
        /// <param name="dto">The error log data</param>
        /// <returns>The created log entry</returns>
        [HttpPost("error")]
        [ValidateAntiForgeryApi]
        public async Task<IActionResult> LogError([FromBody] SimpleLogDto dto)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var logEntry = await _log.LogErrorAsync(dto.Action, dto.Context, dto.Message);

            var tokens = _anti.GetAndStoreTokens(HttpContext);

            return Ok(new
            {
                id = logEntry.Id,
                timestamp = logEntry.Timestamp,
                csrfToken = tokens.RequestToken
            });
        }

        /// <summary>
        /// Creates a system log entry from the frontend
        /// </summary>
        /// <param name="dto">The system log data</param>
        /// <returns>The created log entry</returns>
        [HttpPost("system")]
        [ValidateAntiForgeryApi]
        public async Task<IActionResult> LogSystem([FromBody] SimpleLogDto dto)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var logEntry = await _log.LogSystemAsync(dto.Action, dto.Context, dto.Message);

            var tokens = _anti.GetAndStoreTokens(HttpContext);

            return Ok(new
            {
                id = logEntry.Id,
                timestamp = logEntry.Timestamp,
                csrfToken = tokens.RequestToken
            });
        }

        // ===== GET ENDPOINTS FOR LOG RETRIEVAL =====

        // NOTE: Audit logs are handled by AuditInvestigationController
        // at /admin/audit because they contain sensitive encrypted user data
        // that requires special handling and justification for decryption

        /// <summary>
        /// Retrieves system logs with pagination
        /// </summary>
        /// <param name="page">Page number (default: 1)</param>
        /// <param name="size">Page size (default: 50, max: 100)</param>
        /// <returns>Paginated list of system logs</returns>
        [HttpGet("system")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> GetSystemLogs([FromQuery] int page = 1, [FromQuery] int size = 50)
        {
            if (size > 100) size = 100;
            if (page < 1) page = 1;

            var query = _db.Logs
                .Where(l => l.Category == LogCategory.SYSTEM)
                .OrderByDescending(l => l.Timestamp)
                .Select(l => new LogResponseDto
                {
                    Id = l.Id,
                    User = l.User,
                    Action = l.Action,
                    Context = l.Context,
                    Message = l.Message,
                    Category = l.Category.ToString(),
                    Timestamp = l.Timestamp
                });

            var total = await query.CountAsync();
            var logs = await query
                .Skip((page - 1) * size)
                .Take(size)
                .ToListAsync();

            var tokens = _anti.GetAndStoreTokens(HttpContext);

            return Ok(new
            {
                csrfToken = tokens.RequestToken,
                logs,
                pagination = new
                {
                    page,
                    size,
                    total,
                    totalPages = (int)Math.Ceiling(total / (double)size)
                }
            });
        }



        /// <summary>
        /// Retrieves mail logs with pagination
        /// </summary>
        /// <param name="page">Page number (default: 1)</param>
        /// <param name="size">Page size (default: 50, max: 100)</param>
        /// <param name="fromDate">Optional start timestamp filter</param>
        /// <param name="toDate">Optional end timestamp filter</param>
        /// <returns>Paginated list of mail logs</returns>
        [HttpGet("mail")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> GetMailLogs(
            [FromQuery] int page = 1,
            [FromQuery] int size = 50,
            [FromQuery] DateTime? fromDate = null,
            [FromQuery] DateTime? toDate = null)
        {
            if (size > 100) size = 100;
            if (page < 1) page = 1;

            var query = _db.Logs
                .Where(l => l.Category == LogCategory.MAIL)
                .AsQueryable();

            if (fromDate.HasValue)
            {
                query = query.Where(l => l.Timestamp >= fromDate.Value);
            }

            if (toDate.HasValue)
            {
                query = query.Where(l => l.Timestamp <= toDate.Value);
            }

            var orderedQuery = query.OrderByDescending(l => l.Timestamp);

            var total = await orderedQuery.CountAsync();
            var logs = await orderedQuery
                .Skip((page - 1) * size)
                .Take(size)
                .Select(l => new LogResponseDto
                {
                    Id = l.Id,
                    User = l.User,
                    Action = l.Action,
                    Context = l.Context,
                    Message = l.Message,
                    Category = l.Category.ToString(),
                    Timestamp = l.Timestamp
                })
                .ToListAsync();

            var tokens = _anti.GetAndStoreTokens(HttpContext);

            return Ok(new
            {
                csrfToken = tokens.RequestToken,
                logs,
                pagination = new
                {
                    page,
                    size,
                    total,
                    totalPages = (int)Math.Ceiling(total / (double)size)
                }
            });
        }

        /// <summary>
        /// Retrieves error logs with pagination
        /// </summary>
        /// <param name="page">Page number (default: 1)</param>
        /// <param name="size">Page size (default: 50, max: 100)</param>
        /// <returns>Paginated list of error logs</returns>
        [HttpGet("error")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> GetErrorLogs([FromQuery] int page = 1, [FromQuery] int size = 50)
        {
            if (size > 100) size = 100;
            if (page < 1) page = 1;

            var query = _db.Logs
                .Where(l => l.Category == LogCategory.ERROR)
                .OrderByDescending(l => l.Timestamp)
                .Select(l => new LogResponseDto
                {
                    Id = l.Id,
                    User = l.User,
                    Action = l.Action,
                    Context = l.Context,
                    Message = l.Message,
                    Category = l.Category.ToString(),
                    Timestamp = l.Timestamp
                });

            var total = await query.CountAsync();
            var logs = await query
                .Skip((page - 1) * size)
                .Take(size)
                .ToListAsync();

            var tokens = _anti.GetAndStoreTokens(HttpContext);

            return Ok(new
            {
                csrfToken = tokens.RequestToken,
                logs,
                pagination = new
                {
                    page,
                    size,
                    total,
                    totalPages = (int)Math.Ceiling(total / (double)size)
                }
            });
        }

        /// <summary>
        /// Retrieves HTTP request logs with pagination
        /// </summary>
        /// <param name="page">Page number (default: 1)</param>
        /// <param name="size">Page size (default: 50, max: 100)</param>
        /// <param name="sortBy">Field to sort by (default: timestamp)</param>
        /// <param name="sortOrder">Sort order (asc/desc, default: desc)</param>
        /// <param name="search">Search term (optional)</param>
        /// <returns>Paginated list of HTTP request logs</returns>
        [HttpGet("request")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> GetRequestLogs(
            [FromQuery] int page = 1,
            [FromQuery] int size = 50,
            [FromQuery] string sortBy = "timestamp",
            [FromQuery] string sortOrder = "desc",
            [FromQuery] string? search = null)
        {
            try
            {
                if (size > 100) size = 100;
                if (page < 1) page = 1;

                var query = _db.Logs
                    .Where(l => l.Category == LogCategory.REQUEST);

                // Apply search filter if provided
                if (!string.IsNullOrWhiteSpace(search))
                {
                    var searchTerm = search.Trim().ToLower();
                    query = query.Where(l =>
                        l.User.ToLower().Contains(searchTerm) ||
                        l.Action.ToLower().Contains(searchTerm) ||
                        l.Context.ToLower().Contains(searchTerm) ||
                        l.Message.ToLower().Contains(searchTerm)
                    );
                }

                // Apply sorting
                query = sortBy.ToLower() switch
                {
                    "user" => sortOrder.ToLower() == "asc"
                        ? query.OrderBy(l => l.User)
                        : query.OrderByDescending(l => l.User),
                    "action" => sortOrder.ToLower() == "asc"
                        ? query.OrderBy(l => l.Action)
                        : query.OrderByDescending(l => l.Action),
                    "context" => sortOrder.ToLower() == "asc"
                        ? query.OrderBy(l => l.Context)
                        : query.OrderByDescending(l => l.Context),
                    "timestamp" => sortOrder.ToLower() == "asc"
                        ? query.OrderBy(l => l.Timestamp)
                        : query.OrderByDescending(l => l.Timestamp),
                    _ => query.OrderByDescending(l => l.Timestamp)
                };

                var total = await query.CountAsync();
                var logs = await query
                    .Skip((page - 1) * size)
                    .Take(size)
                    .Select(l => new LogResponseDto
                    {
                        Id = l.Id,
                        User = l.User,
                        Action = l.Action,
                        Context = l.Context,
                        Message = l.Message,
                        Category = l.Category.ToString(),
                        Timestamp = l.Timestamp
                    })
                    .ToListAsync();

                var tokens = _anti.GetAndStoreTokens(HttpContext);

                return Ok(new
                {
                    csrfToken = tokens.RequestToken,
                    logs,
                    pagination = new
                    {
                        page,
                        size,
                        total,
                        totalPages = (int)Math.Ceiling(total / (double)size)
                    }
                });
            }
            catch (Exception ex)
            {
                await _log.LogErrorAsync(
                    nameof(GetRequestLogs),
                    "LogController",
                    $"Error retrieving request logs: {ex.Message}",
                    User.Identity?.Name
                );

                return StatusCode(500, "An error occurred while retrieving request logs");
            }
        }
    }

    /// <summary>
    /// DTO for creating a log entry with specific category
    /// </summary>
    public record CreateLogDto
    {
        /// <summary>
        /// The log category
        /// </summary>
        public LogCategory Category { get; init; }

        /// <summary>
        /// The action or method that triggered the log
        /// </summary>
        public string Action { get; init; } = string.Empty;

        /// <summary>
        /// The context where the action occurred (e.g., component name, page, etc.)
        /// </summary>
        public string Context { get; init; } = string.Empty;

        /// <summary>
        /// Detailed log message
        /// </summary>
        public string Message { get; init; } = string.Empty;
    }

    /// <summary>
    /// Simplified DTO for creating error or system logs
    /// </summary>
    public record SimpleLogDto
    {
        /// <summary>
        /// The action or method that triggered the log
        /// </summary>
        public string Action { get; init; } = string.Empty;

        /// <summary>
        /// The context where the action occurred (e.g., component name, page, etc.)
        /// </summary>
        public string Context { get; init; } = string.Empty;

        /// <summary>
        /// Detailed log message
        /// </summary>
        public string Message { get; init; } = string.Empty;
    }

    /// <summary>
    /// DTO for log responses (without sensitive encrypted data)
    /// </summary>
    public record LogResponseDto
    {
        /// <summary>
        /// Unique identifier for the log entry
        /// </summary>
        public long Id { get; init; }

        /// <summary>
        /// Pseudonymized user identifier
        /// </summary>
        public string User { get; init; } = string.Empty;

        /// <summary>
        /// The action that was executed
        /// </summary>
        public string Action { get; init; } = string.Empty;

        /// <summary>
        /// The context where the action occurred
        /// </summary>
        public string Context { get; init; } = string.Empty;

        /// <summary>
        /// Detailed message describing what happened
        /// </summary>
        public string Message { get; init; } = string.Empty;

        /// <summary>
        /// Category of the log entry
        /// </summary>
        public string Category { get; init; } = string.Empty;

        /// <summary>
        /// Timestamp when the log entry was created
        /// </summary>
        public DateTime Timestamp { get; init; }
    }
}