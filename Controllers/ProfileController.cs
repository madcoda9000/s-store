using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using sstore.Filters;
using sstore.Services;
using sstore.Models;
using System.ComponentModel.DataAnnotations;

namespace sstore.Controllers
{
    /// <summary>
    /// Controller for managing user profile information
    /// </summary>
    [ApiController]
    [Route("profile")]
    [Authorize]
    public class ProfileController : ControllerBase
    {
        private readonly UserManager<ApplicationUser> _users;
        private readonly SignInManager<ApplicationUser> _signIn;
        private readonly ISessionManagementService _session;
        private readonly IAntiforgery _anti;
        private readonly ILogService _log;

        /// <summary>
        /// Constructor for the ProfileController
        /// </summary>
        /// <param name="users">User manager for ApplicationUser</param>
        /// <param name="signIn">Sign in manager for ApplicationUser</param>
        /// <param name="anti">Antiforgery service</param>
        /// <param name="log">Logging service</param>
        /// <param name="session">Session management service</param>
        public ProfileController(
            UserManager<ApplicationUser> users,
            SignInManager<ApplicationUser> signIn,
            IAntiforgery anti,
            ILogService log,
            ISessionManagementService session)
        {
            _users = users;
            _signIn = signIn;
            _anti = anti;
            _log = log;
            _session = session;
        }

        /// <summary>
        /// Returns the current user's profile information
        /// </summary>
        /// <returns>User profile information</returns>
        [HttpGet("me")]
        public async Task<IActionResult> GetProfile()
        {
            var user = await _users.GetUserAsync(User);
            if (user is null)
            {
                await _log.LogErrorAsync(
                    "GetProfile",
                    "ProfileController",
                    "User authenticated but not found in database");
                return Unauthorized();
            }

            return Ok(new
            {
                id = user.Id,
                userName = user.UserName,
                email = user.Email,
                firstName = user.FirstName,
                lastName = user.LastName,
                twoFactorEnabled = user.TwoFactorEnabled,
                twoFactorMethod = user.TwoFactorMethod,
                twoFactorEnforced = user.TwoFactorEnforced,
                createdAt = user.CreatedAt,
                updatedAt = user.UpdatedAt
            });
        }

        /// <summary>
        /// Updates the current user's profile information (first name, last name, email/username)
        /// </summary>
        /// <param name="dto">Profile update data</param>
        /// <returns>Result indicating success or failure</returns>
        [HttpPut("update")]
        [ValidateAntiForgeryApi]
        public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileDto dto)
        {
            var user = await _users.GetUserAsync(User);
            if (user is null)
            {
                await _log.LogErrorAsync(
                    "UpdateProfile",
                    "ProfileController",
                    "User authenticated but not found in database");
                return Unauthorized();
            }

            var oldEmail = user.Email;
            var hasChanges = false;

            // Update first name if provided
            if (!string.IsNullOrWhiteSpace(dto.FirstName) && dto.FirstName != user.FirstName)
            {
                user.FirstName = dto.FirstName;
                hasChanges = true;
            }

            // Update last name if provided
            if (!string.IsNullOrWhiteSpace(dto.LastName) && dto.LastName != user.LastName)
            {
                user.LastName = dto.LastName;
                hasChanges = true;
            }

            // Update email/username if provided
            if (!string.IsNullOrWhiteSpace(dto.Email) && dto.Email != user.Email)
            {
                // Check if email is already taken by another user
                var existingUser = await _users.FindByEmailAsync(dto.Email);
                if (existingUser != null && existingUser.Id != user.Id)
                {
                    return BadRequest(new { error = "Email is already in use" });
                }

                user.Email = dto.Email;
                user.UserName = dto.Email; // Email and username are the same in this system
                user.EmailConfirmed = false; // Require email confirmation after change
                hasChanges = true;
            }

            if (!hasChanges)
            {
                return Ok(new { ok = true, message = "No changes detected" });
            }

            user.UpdatedAt = DateTime.UtcNow;

            var result = await _users.UpdateAsync(user);
            if (!result.Succeeded)
            {
                await _log.LogErrorAsync(
                    "UpdateProfile",
                    "ProfileController",
                    $"Failed to update profile for user {user.Email}: {string.Join(", ", result.Errors.Select(e => e.Description))}");
                return BadRequest(new { error = "Failed to update profile", errors = result.Errors });
            }

            await _log.LogAuditAsync(
                "UpdateProfile",
                "ProfileController",
                $"Profile updated successfully. Old email: {oldEmail}, New email: {user.Email}",
                user.Email ?? user.UserName);

            // If email changed, sign out user (they need to confirm new email)
            if (oldEmail != user.Email)
            {
                await _signIn.SignOutAsync();
                
                await _log.LogAuditAsync(
                    "EmailChanged",
                    "ProfileController",
                    "User signed out after email change",
                    user.Email ?? user.UserName);

                var tokens = _anti.GetAndStoreTokens(HttpContext);
                return Ok(new 
                { 
                    ok = true, 
                    emailChanged = true, 
                    message = "Profile updated. Please login with your new email.",
                    csrfToken = tokens.RequestToken 
                });
            }

            var csrfTokens = _anti.GetAndStoreTokens(HttpContext);
            return Ok(new { ok = true, csrfToken = csrfTokens.RequestToken });
        }

        /// <summary>
        /// Changes the current user's password
        /// </summary>
        /// <param name="dto">Password change data</param>
        /// <returns>Result indicating success or failure</returns>
        [HttpPut("change-password")]
        [ValidateAntiForgeryApi]
        public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordDto dto)
        {
            var user = await _users.GetUserAsync(User);
            if (user is null)
            {
                await _log.LogErrorAsync(
                    "ChangePassword",
                    "ProfileController",
                    "User authenticated but not found in database");
                return Unauthorized();
            }

            // Validate current password
            var isCurrentPasswordValid = await _users.CheckPasswordAsync(user, dto.CurrentPassword);
            if (!isCurrentPasswordValid)
            {
                await _log.LogAuditAsync(
                    "ChangePassword",
                    "ProfileController",
                    "Failed password change attempt - invalid current password",
                    user.Email ?? user.UserName);
                return BadRequest(new { error = "Current password is incorrect" });
            }

            // Change password
            var result = await _users.ChangePasswordAsync(user, dto.CurrentPassword, dto.NewPassword);
            if (!result.Succeeded)
            {
                await _log.LogErrorAsync(
                    "ChangePassword",
                    "ProfileController",
                    $"Failed to change password for user {user.Email}: {string.Join(", ", result.Errors.Select(e => e.Description))}");
                return BadRequest(new { error = "Failed to change password", errors = result.Errors });
            }

            user.UpdatedAt = DateTime.UtcNow;
            await _users.UpdateAsync(user);

            await _log.LogAuditAsync(
                "ChangePassword",
                "ProfileController",
                "Password changed successfully",
                user.Email ?? user.UserName);

            var tokens = _anti.GetAndStoreTokens(HttpContext);

            // invalidate current session!
            await _session.InvalidateAllSessionsAsync(user);

            return Ok(new { ok = true, csrfToken = tokens.RequestToken });
        }
    }

    /// <summary>
    /// Validated update profile DTO
    /// </summary>
    public record UpdateProfileDto
    {
        [StringLength(100, ErrorMessage = "First name must not exceed 100 characters")]
        [RegularExpression(@"^[a-zA-ZäöüÄÖÜß\s-]*$", ErrorMessage = "First name contains invalid characters")]
        public string? FirstName { get; init; }

        [StringLength(100, ErrorMessage = "Last name must not exceed 100 characters")]
        [RegularExpression(@"^[a-zA-ZäöüÄÖÜß\s-]*$", ErrorMessage = "Last name contains invalid characters")]
        public string? LastName { get; init; }

        [EmailAddress(ErrorMessage = "Invalid email format")]
        [StringLength(256, ErrorMessage = "Email must not exceed 256 characters")]
        public string? Email { get; init; }
    }

    /// <summary>
    /// Validated change password DTO
    /// </summary>
    public record ChangePasswordDto {
        [Required(ErrorMessage = "Current Password is required")]
        [StringLength(128, MinimumLength = 12, ErrorMessage = "Current Password must be between 12 and 128 characters")]
        public required string CurrentPassword { get; init; }

        [Required(ErrorMessage = "New Password is required")]
        [StringLength(128, MinimumLength = 12, ErrorMessage = "New Password must be between 12 and 128 characters")]
        public required string NewPassword { get; init; }
    };
}