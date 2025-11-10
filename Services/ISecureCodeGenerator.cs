
using System.Security.Cryptography;

namespace sstore.Services;

/// <summary>
    /// Service for generating cryptographically secure codes
    /// </summary>
    public interface ISecureCodeGenerator
    {
        /// <summary>
        /// Generates a cryptographically secure numeric code
        /// </summary>
        /// <param name="length">Length of the code (default: 6)</param>
        /// <returns>Secure numeric code as string</returns>
        string GenerateNumericCode(int length = 6);
        
        /// <summary>
        /// Generates a cryptographically secure alphanumeric code
        /// </summary>
        /// <param name="length">Length of the code (default: 32)</param>
        /// <returns>Secure alphanumeric code</returns>
        string GenerateAlphanumericCode(int length = 32);
    }