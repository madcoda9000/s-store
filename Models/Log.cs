using System.ComponentModel.DataAnnotations;

namespace sstore.Models
{
    /// <summary>
    /// Represents a log entry in the system
    /// </summary>
    public class Log
    {
        /// <summary>
        /// Unique identifier for the log entry
        /// </summary>
        [Key]
        public long Id { get; set; }

        /// <summary>
        /// Username or email of the user who triggered this log. 
        /// Set to 'anonymous' if no user context is available.
        /// </summary>
        [Required]
        [MaxLength(256)]
        public string User { get; set; } = "anonymous";

        /// <summary>
        /// The action or method that was executed (e.g., 'Login', 'CreateUser', 'SendMail')
        /// </summary>
        [Required]
        [MaxLength(256)]
        public string Action { get; set; } = string.Empty;

        /// <summary>
        /// The context where the action occurred (e.g., class name, controller name, file path)
        /// </summary>
        [Required]
        [MaxLength(512)]
        public string Context { get; set; } = string.Empty;

        /// <summary>
        /// Detailed message describing what happened
        /// </summary>
        [Required]
        public string Message { get; set; } = string.Empty;

        /// <summary>
        /// Category of the log entry
        /// </summary>
        [Required]
        public LogCategory Category { get; set; }

        /// <summary>
        /// Timestamp when the log entry was created
        /// </summary>
        [Required]
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    }
}
