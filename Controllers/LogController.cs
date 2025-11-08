using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using sstore.Filters;
using sstore.Models;
using sstore.Services;
using Microsoft.AspNetCore.Antiforgery;

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
        private readonly ILogService _log;
        private readonly IAntiforgery _anti;

        public LogController(ILogService log, IAntiforgery anti)
        {
            _log = log;
            _anti = anti;
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
}
