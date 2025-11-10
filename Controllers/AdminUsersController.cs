using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using sstore.Services;
using sstore.Models;
using Microsoft.AspNetCore.Antiforgery;
using sstore.Filters;
using System.ComponentModel.DataAnnotations;

namespace sstore.Controllers
{
    [ApiController]
    [Route("admin/users")]
    [Authorize(Roles = "Admin")]
    public class AdminUsersController : ControllerBase
    {
        private readonly UserManager<ApplicationUser> _users;

        private readonly ISecureLogService _log;
        private readonly IAntiforgery _anti;
        /// <summary>
        /// Controller for managing users, only accessible by users with the Admin role.
        /// </summary>
        /// <param name="users">The user manager to use for retrieving and updating user data.</param>
        /// <param name="log">The log service to use for logging operations.</param>
        /// <param name="anti">The antiforgery service to use for validating anti-forgery tokens.</param>
        public AdminUsersController(UserManager<ApplicationUser> users, ISecureLogService log, IAntiforgery anti)
        {
            this._users = users;
            this._log = log;
            _anti = anti;
        }

        /// <summary>
        /// Retrieves a list of users.
        /// </summary>
        /// <param name="page">The page number to retrieve (default: 1).</param>
        /// <param name="size">The number of items to retrieve per page (default: 20).</param>
        /// <returns>A list of user information.</returns>
        [HttpGet("")]
        public IActionResult List([FromQuery] int page = 1, [FromQuery] int size = 20)
        {
            var q = _users.Users.OrderBy(u => u.UserName).Skip((page - 1) * size).Take(size)
                .Select(u => new { u.Id, u.UserName, u.Email, u.TwoFactorEnabled, u.LockoutEnd, u.TwoFactorEnforced, u.TwoFactorMethod, u.LdapLoginEnabled });
            return Ok(q);
        }

        /// <summary>
        /// Creates a new user with the specified username and email.
        /// </summary>
        /// <param name="dto">The user data to create.</param>
        /// <returns>A result indicating whether the creation was successful.</returns>
        [HttpPost("create")]
        [ValidateAntiForgeryApi]
        public async Task<IActionResult> Create([FromBody] CreateUserDto dto)
        {
            var currentUser = await _users.GetUserAsync(User);
            var currentUserName = currentUser?.Email ?? currentUser?.UserName ?? "anonymous";
            var u = new ApplicationUser 
            { 
                UserName = dto.Username, 
                Email = dto.Email, 
                EmailConfirmed = true,
                CreatedAt = DateTime.UtcNow
            };
            var res = await _users.CreateAsync(u, dto.Password);
            if (!res.Succeeded) return BadRequest(res.Errors);

            await _log.LogAuditAsync(
                "create",
                "AdminUsersController",
                "User " + u.UserName + " created successfully",
                currentUserName);

            var tokens = _anti.GetAndStoreTokens(HttpContext);
            return Ok(new { ok = true, u.Id, csrfToken = tokens.RequestToken });
        }

        /// <summary>
        /// Updates the specified user.
        /// </summary>
        /// <param name="id">The ID of the user to update.</param>
        /// <param name="dto">The updated user data.</param>
        /// <returns>A result indicating whether the update was successful.</returns>
        [HttpPut("{id}/update")]
        [ValidateAntiForgeryApi]
        public async Task<IActionResult> Update(string id, [FromBody] UpdateUserDto dto)
        {
            var u = await _users.FindByIdAsync(id);
            if (u is null) return NotFound();

            var currentUser = await _users.GetUserAsync(User);
            var currentUserName = currentUser?.Email ?? currentUser?.UserName ?? "anonymous";  

            u.Email = dto.Email ?? u.Email;
            u.UserName = dto.Username ?? u.UserName;
            var res = await _users.UpdateAsync(u);
            if (!res.Succeeded) return BadRequest(res.Errors);

            await _log.LogAuditAsync(
                "update",
                "AdminUsersController",
                "User " + u.UserName + " updated successfully",
                currentUserName);


            var tokens = _anti.GetAndStoreTokens(HttpContext);
            return Ok(new { ok = true, csrfToken = tokens.RequestToken });
        }

        /// <summary>
        /// Disables the specified user.
        /// </summary>
        /// <param name="id">The ID of the user to disable.</param>
        /// <returns>A result indicating whether the disabling was successful.</returns>
        [HttpPut("{id}/disable")]
        [ValidateAntiForgeryApi]
        public async Task<IActionResult> Disable(string id)
        {
            var u = await _users.FindByIdAsync(id);
            if (u is null) return NotFound();

            var currentUser = await _users.GetUserAsync(User);
            var currentUserName = currentUser?.Email ?? currentUser?.UserName ?? "anonymous";    

            await _users.SetLockoutEndDateAsync(u, DateTimeOffset.MaxValue);

            await _log.LogAuditAsync(
                "disable",
                "AdminUsersController",
                "User " + u.UserName + " disabled successfully",
                currentUserName);

            var tokens = _anti.GetAndStoreTokens(HttpContext);
            return Ok(new { ok = true, csrfToken = tokens.RequestToken });
        }

        /// <summary>
        /// Enables the specified user, allowing them to log in again.
        /// </summary>
        /// <param name="id">The ID of the user to enable.</param>
        /// <returns>A result indicating whether the enabling was successful.</returns>
        [HttpPut("{id}/enable")]
        [ValidateAntiForgeryApi]
        public async Task<IActionResult> Enable(string id)
        {
            var u = await _users.FindByIdAsync(id);
            if (u is null) return NotFound();

            var currentUser = await _users.GetUserAsync(User);
            var currentUserName = currentUser?.Email ?? currentUser?.UserName ?? "anonymous";

            await _users.SetLockoutEndDateAsync(u, null);
            
            await _log.LogAuditAsync(
                "enable",
                "AdminUsersController",
                "User " + u.UserName + " enabled successfully",
                currentUserName);

            var tokens = _anti.GetAndStoreTokens(HttpContext);
            return Ok(new { ok = true, csrfToken = tokens.RequestToken });
        }

        /// <summary>
        /// Enforces two factor authentication for the specified user.
        /// </summary>
        /// <param name="id">The ID of the user to enforce 2FA for.</param>
        /// <returns>A result indicating whether the enforcement was successful.</returns>
        [HttpPut("{id}/enforce-2fa")]
        [ValidateAntiForgeryApi]
        public async Task<IActionResult> Enforce2Fa(string id)
        {
            var u = await _users.FindByIdAsync(id);
            if (u is null) return NotFound();

            var currentUser = await _users.GetUserAsync(User);
            var currentUserName = currentUser?.Email ?? currentUser?.UserName ?? "anonymous";

            u.TwoFactorEnforced = 1;
            await _users.UpdateAsync(u);

            await _log.LogAuditAsync(
                "enforce-2fa",
                "AdminUsersController",
                "2fa enforced for user" + u.UserName,
                currentUserName);

            var tokens = _anti.GetAndStoreTokens(HttpContext);
            return Ok(new { ok = true, csrfToken = tokens.RequestToken });
        }


        /// <summary>
        /// Unenforces two factor authentication for the specified user.
        /// </summary>
        /// <param name="id">The ID of the user to unenforce 2FA for.</param>
        /// <returns>A result indicating whether the unenforcing was successful.</returns>
        [HttpPut("{id}/unenforce-2fa")]
        [ValidateAntiForgeryApi]
        public async Task<IActionResult> UnEnforce2Fa(string id)
        {
            var u = await _users.FindByIdAsync(id);
            if (u is null) return NotFound();

            var currentUser = await _users.GetUserAsync(User);
            var currentUserName = currentUser?.Email ?? currentUser?.UserName ?? "anonymous";

            u.TwoFactorEnforced = 0;
            await _users.UpdateAsync(u);

            await _log.LogAuditAsync(
                "unenforce-2fa",
                "AdminUsersController",
                "2fa unenforced for user" + u.UserName,
                currentUserName);

            var tokens = _anti.GetAndStoreTokens(HttpContext);
            return Ok(new { ok = true, csrfToken = tokens.RequestToken });
        }

        /// <summary>
        /// Deletes the user with the specified ID.
        /// </summary>
        /// <param name="id">The ID of the user to delete.</param>
        /// <returns>A result indicating whether the deletion was successful.</returns>
        [HttpDelete("{id}/delete")]
        [ValidateAntiForgeryApi]
        public async Task<IActionResult> Delete(string id)
        {
            var u = await _users.FindByIdAsync(id);
            if (u is null) return NotFound();

            var currentUser = await _users.GetUserAsync(User);
            var currentUserName = currentUser?.Email ?? currentUser?.UserName ?? "anonymous";

            var res = await _users.DeleteAsync(u);

            if (!res.Succeeded) return BadRequest(res.Errors);

            await _log.LogAuditAsync(
                "delete",
                "AdminUsersController",
                u.UserName + " deleted successfully.",
                currentUserName);

            var tokens = _anti.GetAndStoreTokens(HttpContext);
            return Ok(new { ok = true, csrfToken = tokens.RequestToken });
        }
    }

    /// <summary>
    /// Validated create user DTO (Admin)
    /// </summary>
    public record CreateUserDto
    {
        [Required(ErrorMessage = "Username is required")]
        [StringLength(50, MinimumLength = 3, ErrorMessage = "Username must be between 3 and 50 characters")]
        [RegularExpression(@"^[a-zA-Z0-9._-]+$", ErrorMessage = "Username can only contain letters, numbers, dots, underscores and hyphens")]
        public required string Username { get; init; }

        [Required(ErrorMessage = "Email is required")]
        [EmailAddress(ErrorMessage = "Invalid email format")]
        [StringLength(256, ErrorMessage = "Email must not exceed 256 characters")]
        public required string Email { get; init; }

        [Required(ErrorMessage = "Password is required")]
        [StringLength(128, MinimumLength = 12, ErrorMessage = "Password must be between 12 and 128 characters")]
        public required string Password { get; init; }
    }

    /// <summary>
    /// Validated update user DTO
    /// </summary>
    public record UpdateUserDto
    {
        [Required(ErrorMessage = "Username is required")]
        [StringLength(50, MinimumLength = 3, ErrorMessage = "Username must be between 3 and 50 characters")]
        [RegularExpression(@"^[a-zA-Z0-9._-]+$", ErrorMessage = "Username can only contain letters, numbers, dots, underscores and hyphens")]
        public required string Username { get; init; }

        [Required(ErrorMessage = "Email is required")]
        [EmailAddress(ErrorMessage = "Invalid email format")]
        [StringLength(256, ErrorMessage = "Email must not exceed 256 characters")]
        public required string Email { get; init; }
    }
}