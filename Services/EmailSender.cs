using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;
using Newtonsoft.Json;
using Scriban;
using sstore.Models;

namespace sstore.Services
{
    /// <summary>
    /// Service implementation for sending emails via SMTP using MailKit
    /// </summary>
    public class EmailSender : IEmailSender
    {
        private readonly EmailConfiguration _config;
        private readonly ILogger<EmailSender> _logger;
        private readonly string _templatesBasePath;

        public EmailSender(EmailConfiguration config, ILogger<EmailSender> logger, IWebHostEnvironment environment)
        {
            _config = config;
            _logger = logger;
            _templatesBasePath = Path.Combine(environment.ContentRootPath, _config.TemplatesPath);
        }

        /// <inheritdoc/>
        public async Task<bool> SendEmailAsync(EmailJob job)
        {
            try
            {
                // Load and render template
                var htmlBody = await RenderTemplateAsync(job.TemplateName, job.TemplateData);

                // Create email message
                var message = new MimeMessage();
                message.From.Add(new MailboxAddress(_config.FromName, _config.FromEmail));
                message.To.Add(new MailboxAddress(job.ToName ?? job.ToEmail, job.ToEmail));
                message.Subject = job.Subject;

                var bodyBuilder = new BodyBuilder
                {
                    HtmlBody = htmlBody
                };

                message.Body = bodyBuilder.ToMessageBody();

                // Send email via SMTP
                using var client = new SmtpClient();
                
                await client.ConnectAsync(_config.SmtpHost, _config.SmtpPort, _config.UseSsl ? SecureSocketOptions.SslOnConnect : SecureSocketOptions.StartTls);
                await client.AuthenticateAsync(_config.SmtpUsername, _config.SmtpPassword);
                await client.SendAsync(message);
                await client.DisconnectAsync(true);

                _logger.LogInformation("Email sent successfully to {ToEmail} with subject '{Subject}'", job.ToEmail, job.Subject);
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to send email to {ToEmail} with subject '{Subject}'", job.ToEmail, job.Subject);
                return false;
            }
        }

        /// <inheritdoc/>
        public async Task<bool> ValidateConfigurationAsync()
        {
            try
            {
                if (!_config.IsValid())
                {
                    _logger.LogError("Email configuration is invalid or incomplete");
                    return false;
                }

                // Test SMTP connection
                using var client = new SmtpClient();
                await client.ConnectAsync(_config.SmtpHost, _config.SmtpPort, _config.UseSsl ? SecureSocketOptions.SslOnConnect : SecureSocketOptions.StartTls);
                await client.AuthenticateAsync(_config.SmtpUsername, _config.SmtpPassword);
                await client.DisconnectAsync(true);

                _logger.LogInformation("SMTP configuration validated successfully");
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "SMTP configuration validation failed");
                return false;
            }
        }

        /// <summary>
        /// Renders an email template with the provided data using Scriban
        /// </summary>
        /// <param name="templateName">Name of the template file (without .sbn extension)</param>
        /// <param name="templateDataJson">JSON string containing template variables</param>
        /// <returns>Rendered HTML content</returns>
        private async Task<string> RenderTemplateAsync(string templateName, string? templateDataJson)
        {
            // Load template file
            var templatePath = Path.Combine(_templatesBasePath, $"{templateName}.sbn");
            
            if (!File.Exists(templatePath))
            {
                _logger.LogError("Email template not found: {TemplatePath}", templatePath);
                throw new FileNotFoundException($"Email template '{templateName}' not found at {templatePath}");
            }

            var templateContent = await File.ReadAllTextAsync(templatePath);

            // Parse template data
            var templateData = string.IsNullOrEmpty(templateDataJson) 
                ? new Dictionary<string, object>() 
                : JsonConvert.DeserializeObject<Dictionary<string, object>>(templateDataJson) ?? new Dictionary<string, object>();

            // Render template with Scriban
            var template = Template.Parse(templateContent);
            var result = await template.RenderAsync(templateData);

            return result;
        }
    }
}