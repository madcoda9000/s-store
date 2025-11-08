namespace sstore.Models
{
    /// <summary>
    /// Configuration settings for email/SMTP functionality
    /// </summary>
    public class EmailConfiguration
    {
        /// <summary>
        /// SMTP server hostname
        /// </summary>
        public string SmtpHost { get; set; } = string.Empty;

        /// <summary>
        /// SMTP server port
        /// </summary>
        public int SmtpPort { get; set; }

        /// <summary>
        /// Whether to use SSL/TLS for SMTP connection
        /// </summary>
        public bool UseSsl { get; set; }

        /// <summary>
        /// SMTP authentication username
        /// </summary>
        public string SmtpUsername { get; set; } = string.Empty;

        /// <summary>
        /// SMTP authentication password
        /// </summary>
        public string SmtpPassword { get; set; } = string.Empty;

        /// <summary>
        /// Default "from" email address
        /// </summary>
        public string FromEmail { get; set; } = string.Empty;

        /// <summary>
        /// Default "from" display name
        /// </summary>
        public string FromName { get; set; } = string.Empty;

        /// <summary>
        /// Interval in seconds between email processing runs
        /// </summary>
        public int ProcessingIntervalSeconds { get; set; } = 30;

        /// <summary>
        /// Maximum number of retry attempts for failed emails
        /// </summary>
        public int MaxRetryAttempts { get; set; } = 3;

        /// <summary>
        /// Retry delay intervals in minutes (comma-separated for each attempt)
        /// Example: "1,5,15" means 1 min after 1st fail, 5 min after 2nd fail, 15 min after 3rd fail
        /// </summary>
        public string RetryDelayMinutes { get; set; } = "1,5,15";

        /// <summary>
        /// Path to email templates directory (relative to application root)
        /// </summary>
        public string TemplatesPath { get; set; } = "EmailTemplates";

        /// <summary>
        /// Parses the retry delay configuration into an array of minutes
        /// </summary>
        /// <returns>Array of delay minutes for each retry attempt</returns>
        public int[] GetRetryDelays()
        {
            return RetryDelayMinutes
                .Split(',')
                .Select(s => int.TryParse(s.Trim(), out var minutes) ? minutes : 1)
                .ToArray();
        }

        /// <summary>
        /// Validates that all required configuration values are set
        /// </summary>
        /// <returns>True if configuration is valid</returns>
        public bool IsValid()
        {
            return !string.IsNullOrEmpty(SmtpHost) &&
                   SmtpPort > 0 &&
                   !string.IsNullOrEmpty(SmtpUsername) &&
                   !string.IsNullOrEmpty(SmtpPassword) &&
                   !string.IsNullOrEmpty(FromEmail);
        }

        /// <summary>
        /// Creates EmailConfiguration from environment variables
        /// </summary>
        /// <returns>Configured EmailConfiguration instance</returns>
        public static EmailConfiguration FromEnvironment()
        {
            return new EmailConfiguration
            {
                SmtpHost = Environment.GetEnvironmentVariable("SMTP_HOST") ?? string.Empty,
                SmtpPort = int.TryParse(Environment.GetEnvironmentVariable("SMTP_PORT"), out var port) ? port : 587,
                UseSsl = Environment.GetEnvironmentVariable("SMTP_USE_SSL")?.ToLower() == "true",
                SmtpUsername = Environment.GetEnvironmentVariable("SMTP_USERNAME") ?? string.Empty,
                SmtpPassword = Environment.GetEnvironmentVariable("SMTP_PASSWORD") ?? string.Empty,
                FromEmail = Environment.GetEnvironmentVariable("SMTP_FROM_EMAIL") ?? string.Empty,
                FromName = Environment.GetEnvironmentVariable("SMTP_FROM_NAME") ?? "Application",
                ProcessingIntervalSeconds = int.TryParse(Environment.GetEnvironmentVariable("EMAIL_PROCESSING_INTERVAL_SECONDS"), out var interval) ? interval : 30,
                MaxRetryAttempts = int.TryParse(Environment.GetEnvironmentVariable("EMAIL_MAX_RETRY_ATTEMPTS"), out var maxRetries) ? maxRetries : 3,
                RetryDelayMinutes = Environment.GetEnvironmentVariable("EMAIL_RETRY_DELAY_MINUTES") ?? "1,5,15"
            };
        }
    }
}