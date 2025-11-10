using Microsoft.AspNetCore.Identity;
using System.Text.Json;
using sstore.Models;

namespace sstore.Services
{
    /// <summary>
    /// Service for managing temporary tokens with expiration
    /// </summary>
    public interface ITemporaryTokenService
    {
        /// <summary>
        /// Stores a token with expiration time
        /// </summary>
        Task StoreTokenAsync(ApplicationUser user, string purpose, string code, TimeSpan expiresIn);

        /// <summary>
        /// Validates and consumes a token (single use)
        /// </summary>
        Task<bool> ValidateAndConsumeTokenAsync(ApplicationUser user, string purpose, string code);

        /// <summary>
        /// Removes an expired or used token
        /// </summary>
        Task RemoveTokenAsync(ApplicationUser user, string purpose);
    }
}