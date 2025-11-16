using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using sstore.Filters;
using sstore.Services;
using System.Diagnostics.CodeAnalysis;

namespace sstore.Controllers
{
    /// <summary>
    /// Controller for email functionality
    /// </summary>
    [ApiController]
    [Route("mail")]
    public class EmailController : ControllerBase
    {
        private readonly IEmailService _emailService;
        private readonly ISecureLogService _logService;

        /// <summary>
        /// Constructor for the EmailController
        /// </summary>
        /// <param name="emailService">Email service for sending emails</param>
        /// <param name="logService">Logging service for logging email events</param>
        [SuppressMessage("Style", "IDE0290:Use primary constructor", Justification = "Explicit constructor improves readability for dependency injection.")]
        public EmailController(IEmailService emailService, ISecureLogService logService)
        {
            _emailService = emailService;
            _logService = logService;
        }

        

        /// <summary>
        /// Gets email queue statistics
        /// </summary>
        /// <returns>Statistics about email queue</returns>
        [HttpGet("stats")]
        [Authorize]
        public async Task<IActionResult> GetEmailStats()
        {
            try
            {
                var pendingCount = await _emailService.GetEmailCountByStatusAsync(Models.EmailJobStatus.Pending);
                var retryingCount = await _emailService.GetEmailCountByStatusAsync(Models.EmailJobStatus.Retrying);
                var sentCount = await _emailService.GetEmailCountByStatusAsync(Models.EmailJobStatus.Sent);
                var failedCount = await _emailService.GetEmailCountByStatusAsync(Models.EmailJobStatus.Failed);

                return Ok(new
                {
                    pending = pendingCount,
                    retrying = retryingCount,
                    sent = sentCount,
                    failed = failedCount,
                    total = pendingCount + retryingCount + sentCount + failedCount
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new
                {
                    success = false,
                    message = "Failed to retrieve email statistics",
                    error = ex.Message
                });
            }
        }
    }
}