namespace sstore.Models
{
    /// <summary>
    /// Defines the different categories for system logging
    /// </summary>
    public enum LogCategory
    {
        /// <summary>
        /// Error events that require attention
        /// </summary>
        ERROR = 0,

        /// <summary>
        /// Audit trail for security-relevant actions
        /// </summary>
        AUDIT = 1,

        /// <summary>
        /// HTTP request logging
        /// </summary>
        REQUEST = 2,

        /// <summary>
        /// Email sending operations
        /// </summary>
        MAIL = 3,

        /// <summary>
        /// General system operations
        /// </summary>
        SYSTEM = 4
    }
}
