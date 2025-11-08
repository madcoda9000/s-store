using sstore.Models;

namespace sstore.Services
{
    /// <summary>
    /// Service interface for actual email sending via SMTP
    /// </summary>
    public interface IEmailSender
    {
        /// <summary>
        /// Sends an email using the configured SMTP server
        /// </summary>
        /// <param name="job">Email job containing recipient, subject, and template information</param>
        /// <returns>True if email was sent successfully, false otherwise</returns>
        Task<bool> SendEmailAsync(EmailJob job);

        /// <summary>
        /// Validates SMTP configuration and connection
        /// </summary>
        /// <returns>True if SMTP is configured and connection is successful</returns>
        Task<bool> ValidateConfigurationAsync();
    }
}