using sstore.Models;

namespace sstore.Services
{
    /// <summary>
    /// Service interface for email queue management
    /// </summary>
    public interface IEmailService
    {
        /// <summary>
        /// Enqueues an email to be sent asynchronously
        /// </summary>
        /// <param name="templateName">Name of the email template (e.g., "welcome", "password-reset")</param>
        /// <param name="subject">Email subject line</param>
        /// <param name="toEmail">Recipient email address</param>
        /// <param name="templateData">Dictionary of template variables</param>
        /// <param name="toName">Optional recipient name</param>
        /// <param name="triggeredBy">Optional user who triggered this email</param>
        /// <returns>The created email job</returns>
        Task<EmailJob> SendEmailAsync(
            string templateName,
            string subject,
            string toEmail,
            Dictionary<string, object> templateData,
            string? toName = null,
            string? triggeredBy = null);

        /// <summary>
        /// Gets pending email jobs that are ready to be processed
        /// </summary>
        /// <param name="limit">Maximum number of jobs to retrieve</param>
        /// <returns>List of email jobs ready for processing</returns>
        Task<List<EmailJob>> GetPendingJobsAsync(int limit = 10);

        /// <summary>
        /// Marks an email job as successfully sent
        /// </summary>
        /// <param name="jobId">Email job ID</param>
        Task MarkAsSentAsync(int jobId);

        /// <summary>
        /// Marks an email job as failed and schedules retry if attempts remain
        /// </summary>
        /// <param name="jobId">Email job ID</param>
        /// <param name="errorMessage">Error message describing the failure</param>
        Task MarkAsFailedAsync(int jobId, string errorMessage);

        /// <summary>
        /// Gets total count of emails by status
        /// </summary>
        /// <param name="status">Email job status</param>
        /// <returns>Count of emails with specified status</returns>
        Task<int> GetEmailCountByStatusAsync(EmailJobStatus status);
    }
}