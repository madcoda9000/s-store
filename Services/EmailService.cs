using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;
using sstore.Data;
using sstore.Models;

namespace sstore.Services
{
    /// <summary>
    /// Service implementation for email queue management
    /// </summary>
    public class EmailService : IEmailService
    {
        private readonly AppDb _db;
        private readonly ILogService _logService;
        private readonly EmailConfiguration _emailConfig;

        public EmailService(AppDb db, ILogService logService, EmailConfiguration emailConfig)
        {
            _db = db;
            _logService = logService;
            _emailConfig = emailConfig;
        }

        /// <inheritdoc/>
        public async Task<EmailJob> SendEmailAsync(
            string templateName,
            string subject,
            string toEmail,
            Dictionary<string, object> templateData,
            string? toName = null,
            string? triggeredBy = null)
        {
            // Validate input
            if (string.IsNullOrWhiteSpace(templateName))
                throw new ArgumentException("Template name cannot be empty", nameof(templateName));
            
            if (string.IsNullOrWhiteSpace(subject))
                throw new ArgumentException("Subject cannot be empty", nameof(subject));
            
            if (string.IsNullOrWhiteSpace(toEmail))
                throw new ArgumentException("Recipient email cannot be empty", nameof(toEmail));

            // Create email job
            var emailJob = new EmailJob
            {
                TemplateName = templateName,
                Subject = subject,
                ToEmail = toEmail,
                ToName = toName,
                TemplateData = JsonConvert.SerializeObject(templateData),
                Status = EmailJobStatus.Pending,
                MaxRetryAttempts = _emailConfig.MaxRetryAttempts,
                ScheduledFor = DateTime.UtcNow,
                CreatedAt = DateTime.UtcNow,
                TriggeredBy = triggeredBy
            };

            _db.EmailJobs.Add(emailJob);
            await _db.SaveChangesAsync();

            await _logService.LogMailAsync(
                "SendMailAsync",
                "EmailService",
                $"Email queued for {toEmail} with subject '{subject}' using Template '{templateName}'",
                triggeredBy
            );

            return emailJob;
        }

        /// <inheritdoc/>
        public async Task<List<EmailJob>> GetPendingJobsAsync(int limit = 10)
        {
            var now = DateTime.UtcNow;

            return await _db.EmailJobs
                .Where(e => (e.Status == EmailJobStatus.Pending || e.Status == EmailJobStatus.Retrying) 
                    && (e.ScheduledFor == null || e.ScheduledFor <= now))
                .OrderBy(e => e.CreatedAt)
                .Take(limit)
                .ToListAsync();
        }

        /// <inheritdoc/>
        public async Task MarkAsSentAsync(int jobId)
        {
            var job = await _db.EmailJobs.FindAsync(jobId);
            if (job == null)
                throw new ArgumentException($"Email job with ID {jobId} not found", nameof(jobId));

            job.Status = EmailJobStatus.Sent;
            job.SentAt = DateTime.UtcNow;
            job.UpdatedAt = DateTime.UtcNow;
            job.LastError = null;

            await _db.SaveChangesAsync();
        }

        /// <inheritdoc/>
        public async Task MarkAsFailedAsync(int jobId, string errorMessage)
        {
            var job = await _db.EmailJobs.FindAsync(jobId);
            if (job == null)
                throw new ArgumentException($"Email job with ID {jobId} not found", nameof(jobId));

            job.RetryCount++;
            job.LastError = errorMessage;
            job.UpdatedAt = DateTime.UtcNow;

            // Check if we should retry
            if (job.RetryCount < job.MaxRetryAttempts)
            {
                // Calculate next retry time using exponential backoff
                var retryDelays = _emailConfig.GetRetryDelays();
                var delayIndex = Math.Min(job.RetryCount - 1, retryDelays.Length - 1);
                var delayMinutes = retryDelays[delayIndex];

                job.Status = EmailJobStatus.Retrying;
                job.ScheduledFor = DateTime.UtcNow.AddMinutes(delayMinutes);

                await _db.SaveChangesAsync();

                await _logService.LogMailAsync(
                    "MarkAsFailedAsync",
                    "EmailService",
                    $"Email to {job.ToEmail} failed. Retry scheduled for {job.ScheduledFor}. Attempt: {job.RetryCount}/{job.MaxRetryAttempts} - Error: {errorMessage}  ",
                    job.TriggeredBy
                );
            }
            else
            {
                // Max retries reached, mark as permanently failed
                job.Status = EmailJobStatus.Failed;

                await _db.SaveChangesAsync();

                await _logService.LogErrorAsync(
                    "MarkAsFailedAsync",
                    "EmailService",
                    $"Email to {job.ToEmail} permanently failed after {job.RetryCount} attempts. Last error: {errorMessage}",
                    job.TriggeredBy
                );
            }
        }

        /// <inheritdoc/>
        public async Task<int> GetEmailCountByStatusAsync(EmailJobStatus status)
        {
            return await _db.EmailJobs
                .Where(e => e.Status == status)
                .CountAsync();
        }
    }
}