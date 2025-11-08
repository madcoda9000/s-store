using Microsoft.AspNetCore.Identity;

namespace sstore.Models
{
    /// <summary>
    /// Extended user model with additional properties
    /// </summary>
    public class ApplicationUser : IdentityUser
    {
        /// <summary>
        /// User's first name
        /// </summary>
        public string? FirstName { get; set; }

        /// <summary>
        /// User's last name
        /// </summary>
        public string? LastName { get; set; }

        /// <summary>
        /// Date when the user account was created
        /// </summary>
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        /// <summary>
        /// Date when the user profile was last updated
        /// </summary>
        public DateTime? UpdatedAt { get; set; }

        /// <summary>
        /// Optional profile picture URL or path
        /// </summary>
        public string? ProfilePictureUrl { get; set; }

        /// <summary>
        /// Returns the full name of the user
        /// </summary>
        public string FullName => $"{FirstName} {LastName}".Trim();

        /// <summary>
        /// Returns the display name (full name if available, otherwise username)
        /// </summary>
        public string DisplayName => !string.IsNullOrEmpty(FullName) ? FullName : UserName ?? Email ?? "User";

        /// <summary>
        /// Enforce two-factor authentication setup
        /// </summary>
        public int? TwoFactorEnforced { get; set; } = 0;

        /// <summary>
        /// Two-factor authentication method (Authenticator or Email)
        /// </summary>
        public string? TwoFactorMethod { get; set; }

        /// <summary>
        /// LDAP authentication enabled or not
        /// </summary>
        public int? LdapLoginEnabled { get; set; } = 0;
    }
}
