using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace sstore.Models
{
    /// <summary>
    /// Represents an email job in the queue for asynchronous processing
    /// </summary>
    public class EmailJob
    {
        /// <summary>
        /// Unique identifier for the email job
        /// </summary>
        [Key]
        public int Id { get; set; }

        /// <summary>
        /// Name of the email template to use (e.g., "welcome", "password-reset")
        /// </summary>
        [Required]
        [MaxLength(100)]
        public string TemplateName { get; set; } = string.Empty;

        /// <summary>
        /// Email subject line
        /// </summary>
        [Required]
        [MaxLength(500)]
        public string Subject { get; set; } = string.Empty;

        /// <summary>
        /// Recipient email address
        /// </summary>
        [Required]
        [MaxLength(255)]
        public string ToEmail { get; set; } = string.Empty;

        /// <summary>
        /// Optional recipient name
        /// </summary>
        [MaxLength(255)]
        public string? ToName { get; set; }

        /// <summary>
        /// JSON-serialized template data (variables to replace in template)
        /// </summary>
        [Column(TypeName = "TEXT")]
        public string? TemplateData { get; set; }

        /// <summary>
        /// Current status of the email job
        /// </summary>
        [Required]
        [MaxLength(50)]
        public EmailJobStatus Status { get; set; } = EmailJobStatus.Pending;

        /// <summary>
        /// Number of send attempts made
        /// </summary>
        public int RetryCount { get; set; } = 0;

        /// <summary>
        /// Maximum number of retry attempts allowed
        /// </summary>
        public int MaxRetryAttempts { get; set; } = 3;

        /// <summary>
        /// Last error message if send failed
        /// </summary>
        [Column(TypeName = "TEXT")]
        public string? LastError { get; set; }

        /// <summary>
        /// When the email job was created
        /// </summary>
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        /// <summary>
        /// When the email job was last updated
        /// </summary>
        public DateTime? UpdatedAt { get; set; }

        /// <summary>
        /// When the next send attempt should be made (for retry logic)
        /// </summary>
        public DateTime? ScheduledFor { get; set; }

        /// <summary>
        /// When the email was successfully sent
        /// </summary>
        public DateTime? SentAt { get; set; }

        /// <summary>
        /// User who triggered this email (for audit purposes)
        /// </summary>
        [MaxLength(255)]
        public string? TriggeredBy { get; set; }
    }

    /// <summary>
    /// Status values for email jobs
    /// </summary>
    public enum EmailJobStatus
    {
        /// <summary>
        /// Email is waiting to be sent
        /// </summary>
        Pending,

        /// <summary>
        /// Email is currently being processed
        /// </summary>
        Processing,

        /// <summary>
        /// Email was successfully sent
        /// </summary>
        Sent,

        /// <summary>
        /// Email failed after all retry attempts
        /// </summary>
        Failed,

        /// <summary>
        /// Email is waiting for retry after a failed attempt
        /// </summary>
        Retrying
    }
}