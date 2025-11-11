using Microsoft.AspNetCore.Identity;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using sstore.Models;

namespace sstore.Services;

/// <summary>
/// Secure implementation of temporary token management with hashing
/// </summary>
public class TemporaryTokenService : ITemporaryTokenService
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly ISecureLogService _logService;

    public TemporaryTokenService(UserManager<ApplicationUser> userManager, ISecureLogService logService)
    {
        _userManager = userManager;
        _logService = logService;
    }

    /// <inheritdoc/>
    public async Task StoreTokenAsync(ApplicationUser user, string purpose, string code, TimeSpan expiresIn)
    {
        // Hash the code before storage - NEVER store plaintext!
        var codeHash = ComputeHash(code);

        var tokenData = new TokenData
        {
            CodeHash = codeHash,
            ExpiresAt = DateTime.UtcNow.Add(expiresIn),
            FailedAttempts = 0,
            MaxAttempts = 3 // Default: 3 attempts
        };

        var serialized = JsonSerializer.Serialize(tokenData);
        await _userManager.SetAuthenticationTokenAsync(user, "TempToken", purpose, serialized);

        await _logService.LogAuditAsync(
            "StoreToken",
            "TemporaryTokenService",
            $"Token stored for purpose: {purpose} (expires in {expiresIn.TotalMinutes} minutes)",
            user.Email ?? user.UserName);
    }

    /// <inheritdoc/>
    public async Task<bool> ValidateAndConsumeTokenAsync(ApplicationUser user, string purpose, string code)
    {
        var stored = await _userManager.GetAuthenticationTokenAsync(user, "TempToken", purpose);

        if (string.IsNullOrEmpty(stored))
        {
            await _logService.LogAuditAsync(
                "ValidateToken",
                "TemporaryTokenService",
                $"Token validation failed - no token found for purpose: {purpose}",
                user.Email ?? user.UserName);
            return false;
        }

        TokenData? tokenData;
        try
        {
            tokenData = JsonSerializer.Deserialize<TokenData>(stored);
        }
        catch
        {
            await _logService.LogErrorAsync(
                "ValidateToken",
                "TemporaryTokenService",
                $"Token validation failed - invalid token format for purpose: {purpose}",
                user.Email ?? user.UserName);

            // Clean up corrupted token
            await RemoveTokenAsync(user, purpose);
            return false;
        }

        // Validate token data structure
        if (tokenData == null || string.IsNullOrEmpty(tokenData.CodeHash))
        {
            await _logService.LogErrorAsync(
                "ValidateToken",
                "TemporaryTokenService",
                $"Token validation failed - invalid token structure for purpose: {purpose}",
                user.Email ?? user.UserName);
            await RemoveTokenAsync(user, purpose);
            return false;
        }

        // Check expiration
        if (tokenData.ExpiresAt < DateTime.UtcNow)
        {
            await _logService.LogAuditAsync(
                "ValidateToken",
                "TemporaryTokenService",
                $"Token validation failed - token expired for purpose: {purpose}",
                user.Email ?? user.UserName);
            await RemoveTokenAsync(user, purpose);
            return false;
        }

        // Check if max attempts exceeded
        if (tokenData.FailedAttempts >= tokenData.MaxAttempts)
        {
            await _logService.LogAuditAsync(
                "ValidateToken",
                "TemporaryTokenService",
                $"Token validation failed - max attempts ({tokenData.MaxAttempts}) exceeded for purpose: {purpose}",
                user.Email ?? user.UserName);
            await RemoveTokenAsync(user, purpose);
            return false;
        }

        // Validate code by comparing hashes
        var inputHash = ComputeHash(code);
        if (!ConstantTimeEquals(tokenData.CodeHash, inputHash))
        {
            // Increment failed attempts and store updated data
            tokenData.FailedAttempts++;
            var updatedData = JsonSerializer.Serialize(tokenData);
            await _userManager.SetAuthenticationTokenAsync(user, "TempToken", purpose, updatedData);

            await _logService.LogAuditAsync(
                "ValidateToken",
                "TemporaryTokenService",
                $"Token validation failed - code mismatch (attempt {tokenData.FailedAttempts}/{tokenData.MaxAttempts}) for purpose: {purpose}",
                user.Email ?? user.UserName);

            return false;
        }

        // Token is valid - consume it (single use)
        await RemoveTokenAsync(user, purpose);

        await _logService.LogAuditAsync(
            "ValidateToken",
            "TemporaryTokenService",
            $"Token successfully validated and consumed for purpose: {purpose}",
            user.Email ?? user.UserName);

        return true;
    }

    /// <inheritdoc/>
    public async Task RemoveTokenAsync(ApplicationUser user, string purpose)
    {
        await _userManager.RemoveAuthenticationTokenAsync(user, "TempToken", purpose);
    }

    /// <summary>
    /// Computes SHA256 hash of input string
    /// </summary>
    /// <param name="input">Input to hash</param>
    /// <returns>Base64-encoded hash</returns>
    private static string ComputeHash(string input)
    {
        var bytes = Encoding.UTF8.GetBytes(input);
        var hash = SHA256.HashData(bytes);
        return Convert.ToBase64String(hash);
    }

    /// <summary>
    /// Constant-time string comparison to prevent timing attacks
    /// </summary>
    /// <param name="a">First string</param>
    /// <param name="b">Second string</param>
    /// <returns>True if strings are equal</returns>
    private static bool ConstantTimeEquals(string a, string b)
    {
        if (a.Length != b.Length)
            return false;

        var result = 0;
        for (int i = 0; i < a.Length; i++)
        {
            result |= a[i] ^ b[i];
        }

        return result == 0;
    }

    /// <summary>
    /// Internal token data structure
    /// </summary>
    private class TokenData
    {
        /// <summary>
        /// SHA256 hash of the actual code
        /// </summary>
        public string CodeHash { get; set; } = string.Empty;

        /// <summary>
        /// UTC timestamp when token expires
        /// </summary>
        public DateTime ExpiresAt { get; set; }

        /// <summary>
        /// Number of failed validation attempts
        /// </summary>
        public int FailedAttempts { get; set; } = 0;

        /// <summary>
        /// Maximum allowed validation attempts before token is invalidated
        /// </summary>
        public int MaxAttempts { get; set; } = 3;
    }
}