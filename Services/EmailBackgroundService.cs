using sstore.Models;

namespace sstore.Services
{
    /// <summary>
    /// Background service that processes queued email jobs at regular intervals
    /// </summary>
    public class EmailBackgroundService : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<EmailBackgroundService> _logger;
        private readonly EmailConfiguration _emailConfig;

        public EmailBackgroundService(
            IServiceProvider serviceProvider,
            ILogger<EmailBackgroundService> logger,
            EmailConfiguration emailConfig)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
            _emailConfig = emailConfig;
        }

        /// <summary>
        /// Executes the background service
        /// </summary>
        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            using var scope = _serviceProvider.CreateScope();
            var logService = scope.ServiceProvider.GetRequiredService<ISecureLogService>();
            var emailSender = scope.ServiceProvider.GetRequiredService<IEmailSender>();
            var isValid = await emailSender.ValidateConfigurationAsync();

            _logger.LogInformation("Email Background Service started");
            await logService.LogMailAsync("ExecuteAsync", "EmailBackgroundService", "Email Background Service started", "system");


            // Validate configuration on startup
            if (!isValid)
            {
                _logger.LogWarning("Email configuration validation failed. Service will continue but emails may fail to send.");
                await logService.LogMailAsync("ExecuteAsync", "EmailBackgroundService", "Email configuration validation failed. Service will continue but emails may fail to send.", "system");
            }

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await ProcessEmailQueueAsync(stoppingToken);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error occurred while processing email queue");
                    await logService.LogMailAsync("ExecuteAsync", "EmailBackgroundService", "Error occurred while processing email queue", "system");
                }

                // Wait for configured interval before next processing cycle
                await Task.Delay(TimeSpan.FromSeconds(_emailConfig.ProcessingIntervalSeconds), stoppingToken);
            }

            _logger.LogInformation("Email Background Service stopped");
            await logService.LogMailAsync("ExecuteAsync", "EmailBackgroundService", "Email Background Service stopped", "system");
        }

        /// <summary>
        /// Processes pending email jobs from the queue
        /// </summary>
        private async Task ProcessEmailQueueAsync(CancellationToken stoppingToken)
        {
            using var scope = _serviceProvider.CreateScope();

            var emailService = scope.ServiceProvider.GetRequiredService<IEmailService>();
            var emailSender = scope.ServiceProvider.GetRequiredService<IEmailSender>();
            var logService = scope.ServiceProvider.GetRequiredService<ISecureLogService>();

            // Get pending jobs
            var pendingJobs = await emailService.GetPendingJobsAsync(limit: 10);

            if (pendingJobs.Count == 0)
            {
                return; // No jobs to process
            }

            _logger.LogInformation("Processing {Count} pending email jobs", pendingJobs.Count);
            await logService.LogMailAsync("ProcessEmailQueueAsync", "EmailBackgroundService", $"Processing {pendingJobs.Count} pending email jobs", "system");

            foreach (var job in pendingJobs)
            {
                if (stoppingToken.IsCancellationRequested)
                {
                    break;
                }

                try
                {
                    _logger.LogInformation("Processing email job {JobId}: {TemplateName} to {ToEmail}",
                        job.Id, job.TemplateName, job.ToEmail);
                    await logService.LogMailAsync(
                        "ProcessEmailQueueAsync",
                        "EmailBackgroundService",
                        $"Processing email job {job.Id}: {job.TemplateName} to {job.ToEmail}",
                        "system"
                    );

                    // Update status to Processing
                    job.Status = EmailJobStatus.Processing;
                    job.UpdatedAt = DateTime.UtcNow;

                    // Attempt to send email
                    var success = await emailSender.SendEmailAsync(job);

                    if (success)
                    {
                        // Mark as sent
                        await emailService.MarkAsSentAsync(job.Id);
                        _logger.LogInformation("Email job {JobId} sent successfully", job.Id);
                        await logService.LogMailAsync(
                            "ProcessEmailQueueAsync",
                            "EmailBackgroundService",
                            $"Email successfully sent to {job.ToEmail} with subject '{job.Subject}'",
                            "system"
                        );
                    }
                    else
                    {
                        // Mark as failed and schedule retry if applicable
                        await emailService.MarkAsFailedAsync(job.Id, "SMTP send failed");
                        _logger.LogWarning("Email job {JobId} failed, retry scheduled", job.Id);
                        await logService.LogMailAsync(
                            "ProcessEmailQueueAsync",
                            "EmailBackgroundService",
                            $"Email to {job.ToEmail} failed. Retry scheduled for {job.ScheduledFor}.",
                            "system"
                        );
                    }
                }
                catch (FileNotFoundException ex)
                {
                    // Template not found - permanent failure
                    await emailService.MarkAsFailedAsync(job.Id, $"Template not found: {ex.Message}");

                    _logger.LogError(ex, "Template not found for email job {JobId}", job.Id);
                    await logService.LogErrorAsync(
                        "ProcessEmailQueueAsync",
                        "EmailBackgroundService",
                        $"Template not found: {ex.Message}",
                        "system"
                    )
                    ;
                    await logService.LogMailAsync(
                        "ProcessEmailQueueAsync",
                        "EmailBackgroundService",
                        $"Template not found: {ex.Message}",
                        "system"
                    );
                }
                catch (Exception ex)
                {
                    // Generic error - mark as failed and allow retry
                    await emailService.MarkAsFailedAsync(job.Id, $"Error: {ex.Message}");

                    await logService.LogErrorAsync(
                        "ProcessEmailQueueAsync",
                        "EmailBackgroundService",
                        $"Error processing email to {job.ToEmail}: {ex.Message}",
                        "system"
                    );
                    await logService.LogMailAsync(
                        "ProcessEmailQueueAsync",
                        "EmailBackgroundService",
                        $"Error processing email to {job.ToEmail}: {ex.Message}",
                        "system"
                    );

                    _logger.LogError(ex, "Error processing email job {JobId}", job.Id);
                }

                // Small delay between emails to avoid overwhelming SMTP server
                await Task.Delay(100, stoppingToken);
            }
        }

        /// <summary>
        /// Triggered when the application host is performing a graceful shutdown
        /// </summary>
        public override async Task StopAsync(CancellationToken stoppingToken)
        {
            using var scope = _serviceProvider.CreateScope();
            var logService = scope.ServiceProvider.GetRequiredService<ISecureLogService>();

            _logger.LogInformation("Email Background Service is stopping...");
            await logService.LogMailAsync("StopAsync", "EmailBackgroundService", "Email Background Service is stopping...", "system");
            await base.StopAsync(stoppingToken);
        }
    }
}