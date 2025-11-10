using Microsoft.AspNetCore.Identity;
using System.Text.Json;
using sstore.Models;

namespace sstore.Services;

/// <summary>
/// Implementation of temporary token management
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
        var tokenData = new TokenData
        {
            Code = code,
            ExpiresAt = DateTime.UtcNow.Add(expiresIn)
        };

        var serialized = JsonSerializer.Serialize(tokenData);
        await _userManager.SetAuthenticationTokenAsync(user, "TempToken", purpose, serialized);
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

        if (tokenData == null || tokenData.ExpiresAt < DateTime.UtcNow)
        {
            await _logService.LogAuditAsync(
                "ValidateToken",
                "TemporaryTokenService",
                $"Token validation failed - token expired for purpose: {purpose}",
                user.Email ?? user.UserName);

            // Clean up expired token
            await RemoveTokenAsync(user, purpose);
            return false;
        }

        if (tokenData.Code != code)
        {
            await _logService.LogAuditAsync(
                "ValidateToken",
                "TemporaryTokenService",
                $"Token validation failed - code mismatch for purpose: {purpose}",
                user.Email ?? user.UserName);
            return false;
        }

        // Token is valid - consume it (single use)
        await RemoveTokenAsync(user, purpose);
        return true;
    }

    /// <inheritdoc/>
    public async Task RemoveTokenAsync(ApplicationUser user, string purpose)
    {
        await _userManager.RemoveAuthenticationTokenAsync(user, "TempToken", purpose);
    }

    private class TokenData
    {
        public string Code { get; set; } = string.Empty;
        public DateTime ExpiresAt { get; set; }
    }
}