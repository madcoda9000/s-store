using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using sstore.Services;
using sstore.Models;
using Microsoft.AspNetCore.Antiforgery;
using sstore.Filters;
using System.ComponentModel.DataAnnotations;
using sstore.Data;
using Microsoft.EntityFrameworkCore;
using System.Diagnostics.CodeAnalysis;

namespace sstore.Controllers
{
    [ApiController]
    [Route("admin/users")]
    [Authorize(Roles = "Admin")]
    public class AdminUsersController : ControllerBase
    {
        private readonly UserManager<ApplicationUser> _users;
        private readonly AppDb _context;
        private readonly ISecureLogService _log;
        private readonly IAntiforgery _anti;
        /// <summary>
        /// Controller for managing users, only accessible by users with the Admin role.
        /// </summary>
        /// <param name="users">The user manager to use for retrieving and updating user data.</param>
        /// <param name="log">The log service to use for logging operations.</param>
        /// <param name="anti">The antiforgery service to use for validating anti-forgery tokens.</param>
        /// <param name="context">The database context to use for accessing user data.</param>
        [SuppressMessage("Style", "IDE0290:Use primary constructor", Justification = "Explicit constructor improves readability for dependency injection.")]
        public AdminUsersController(UserManager<ApplicationUser> users, ISecureLogService log, IAntiforgery anti, AppDb context)
        {
            this._users = users;
            this._log = log;
            _anti = anti;
            _context = context;
        }

        /// <summary>
        /// Lists all users with pagination, search, and sorting.
        /// </summary>
        /// <param name="page">The page number to retrieve (default: 1).</param>
        /// <param name="size">The number of items to retrieve per page (default: 20).</param>
        /// <returns>A list of user information.</returns>
        [HttpGet("")]
        public IActionResult List([FromQuery] int page = 1, [FromQuery] int size = 20)
        {
            var q = from u in _context.Users
                    select new
                    {
                        u.Id,
                        u.UserName,
                        u.Email,
                        u.TwoFactorEnabled,
                        u.TwoFactorEnforced,
                        u.LockoutEnd
                    };

            var total = q.Count();
            var result = q.Skip((page - 1) * size)
                          .Take(size)
                          .ToList();

            return Ok(result);
        }

        /// <summary>
        /// Retrieves a single user by ID with all details including roles.
        /// </summary>
        /// <param name="id">The ID of the user to retrieve.</param>
        /// <returns>User details including roles.</returns>
        [HttpGet("details/{id}")]
        public async Task<IActionResult> GetById(string id)
        {
            var u = await _users.FindByIdAsync(id);
            if (u is null) return NotFound();

            var roles = await _users.GetRolesAsync(u);

            return Ok(new
            {
                u.Id,
                u.UserName,
                u.Email,
                u.FirstName,
                u.LastName,
                u.TwoFactorEnabled,
                u.TwoFactorEnforced,
                u.TwoFactorMethod,
                u.LdapLoginEnabled,
                u.LockoutEnd,
                Roles = roles.ToList()
            });
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

        /// <summary>
        /// Creates a new user with comprehensive fields including roles, 2FA settings, and LDAP options.
        /// </summary>
        /// <param name="dto">The comprehensive user data to create.</param>
        /// <returns>A result indicating whether the creation was successful.</returns>
        [HttpPost("create-extended")]
        [ValidateAntiForgeryApi]
        public async Task<IActionResult> CreateExtended([FromBody] CreateUserExtendedDto dto)
        {
            var currentUser = await _users.GetUserAsync(User);
            var currentUserName = currentUser?.Email ?? currentUser?.UserName ?? "anonymous";

            var u = new ApplicationUser
            {
                UserName = dto.Username!,
                Email = dto.Email!,
                EmailConfirmed = true,
                FirstName = dto.FirstName,
                LastName = dto.LastName,
                TwoFactorEnforced = dto.TwoFactorEnforced ? 1 : 0,
                LdapLoginEnabled = dto.LdapLoginEnabled ? 1 : 0,
                CreatedAt = DateTime.UtcNow
            };

            var res = await _users.CreateAsync(u, dto.Password!);
            if (!res.Succeeded) return BadRequest(res.Errors);

            // Assign roles
            if (dto.Roles != null)
            {
                foreach (var roleName in dto.Roles)
                {
                    var roleExists = await _context.Roles.AnyAsync(r => r.Name == roleName);
                    if (roleExists)
                    {
                        await _users.AddToRoleAsync(u, roleName);
                    }
                }
            }

            await _log.LogAuditAsync(
                "create",
                "AdminUsersController",
                $"User {u.UserName} created successfully with roles: {string.Join(", ", dto.Roles ?? new List<string>())}",
                currentUserName);

            var tokens = _anti.GetAndStoreTokens(HttpContext);
            return Ok(new { ok = true, u.Id, csrfToken = tokens.RequestToken });
        }

        /// <summary>
        /// Updates an existing user with comprehensive fields including roles, 2FA settings, and LDAP options.
        /// </summary>
        /// <param name="id">The ID of the user to update.</param>
        /// <param name="dto">The comprehensive updated user data.</param>
        /// <returns>A result indicating whether the update was successful.</returns>
        [HttpPut("{id}/update-extended")]
        [ValidateAntiForgeryApi]
        public async Task<IActionResult> UpdateExtended(string id, [FromBody] UpdateUserExtendedDto dto)
        {
            var u = await _users.FindByIdAsync(id);
            if (u is null) return NotFound();

            var currentUser = await _users.GetUserAsync(User);
            var currentUserName = currentUser?.Email ?? currentUser?.UserName ?? "anonymous";

            // Update basic fields
            u.UserName = dto.Username!;
            u.Email = dto.Email!;
            u.FirstName = dto.FirstName;
            u.LastName = dto.LastName;
            u.TwoFactorEnforced = dto.TwoFactorEnforced ? 1 : 0;
            u.LdapLoginEnabled = dto.LdapLoginEnabled ? 1 : 0;
            u.UpdatedAt = DateTime.UtcNow;

            var res = await _users.UpdateAsync(u);
            if (!res.Succeeded) return BadRequest(res.Errors);

            // Update password if provided
            if (!string.IsNullOrEmpty(dto.NewPassword))
            {
                var token = await _users.GeneratePasswordResetTokenAsync(u);
                var pwdRes = await _users.ResetPasswordAsync(u, token, dto.NewPassword);
                if (!pwdRes.Succeeded) return BadRequest(pwdRes.Errors);
            }

            // Update roles - remove all existing roles and add new ones
            var currentRoles = await _users.GetRolesAsync(u);
            await _users.RemoveFromRolesAsync(u, currentRoles);

            if (dto.Roles != null)
            {
                foreach (var roleName in dto.Roles)
                {
                    var roleExists = await _context.Roles.AnyAsync(r => r.Name == roleName);
                    if (roleExists)
                    {
                        await _users.AddToRoleAsync(u, roleName);
                    }
                }
            }

            await _log.LogAuditAsync(
                "update",
                "AdminUsersController",
                $"User {u.UserName} updated successfully with roles: {string.Join(", ", dto.Roles ?? new List<string>())}",
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

    /// <summary>
    /// Comprehensive DTO for creating a new user with all fields
    /// </summary>
    public record CreateUserExtendedDto
    {
        [Required(ErrorMessage = "Username is required")]
        [StringLength(50, MinimumLength = 3, ErrorMessage = "Username must be between 3 and 50 characters")]
        [RegularExpression(@"^[a-zA-Z0-9._-]+$", ErrorMessage = "Username can only contain letters, numbers, dots, underscores and hyphens")]
        public string? Username { get; init; }

        [Required(ErrorMessage = "Email is required")]
        [EmailAddress(ErrorMessage = "Invalid email format")]
        [StringLength(256, ErrorMessage = "Email must not exceed 256 characters")]
        public string? Email { get; init; }

        [Required(ErrorMessage = "Password is required")]
        [StringLength(128, MinimumLength = 12, ErrorMessage = "Password must be between 12 and 128 characters")]
        public string? Password { get; init; }

        [Required(ErrorMessage = "First name is required")]
        [StringLength(100, MinimumLength = 1, ErrorMessage = "First name must be between 1 and 100 characters")]
        public string? FirstName { get; init; }

        [Required(ErrorMessage = "Last name is required")]
        [StringLength(100, MinimumLength = 1, ErrorMessage = "Last name must be between 1 and 100 characters")]
        public string? LastName { get; init; }

        public bool TwoFactorEnforced { get; init; }

        public bool LdapLoginEnabled { get; init; }

        [Required(ErrorMessage = "At least one role must be selected")]
        [MinLength(1, ErrorMessage = "At least one role must be selected")]
        public List<string>? Roles { get; init; }
    }

    /// <summary>
    /// Comprehensive DTO for updating an existing user with all fields
    /// </summary>
    public record UpdateUserExtendedDto
    {
        [Required(ErrorMessage = "Username is required")]
        [StringLength(50, MinimumLength = 3, ErrorMessage = "Username must be between 3 and 50 characters")]
        [RegularExpression(@"^[a-zA-Z0-9._-]+$", ErrorMessage = "Username can only contain letters, numbers, dots, underscores and hyphens")]
        public string? Username { get; init; }

        [Required(ErrorMessage = "Email is required")]
        [EmailAddress(ErrorMessage = "Invalid email format")]
        [StringLength(256, ErrorMessage = "Email must not exceed 256 characters")]
        public string? Email { get; init; }

        [Required(ErrorMessage = "First name is required")]
        [StringLength(100, MinimumLength = 1, ErrorMessage = "First name must be between 1 and 100 characters")]
        public string? FirstName { get; init; }

        [Required(ErrorMessage = "Last name is required")]
        [StringLength(100, MinimumLength = 1, ErrorMessage = "Last name must be between 1 and 100 characters")]
        public string? LastName { get; init; }

        public bool TwoFactorEnforced { get; init; }

        public bool LdapLoginEnabled { get; init; }

        [Required(ErrorMessage = "At least one role must be selected")]
        [MinLength(1, ErrorMessage = "At least one role must be selected")]
        public List<string>? Roles { get; init; }

        [StringLength(128, MinimumLength = 12, ErrorMessage = "Password must be between 12 and 128 characters")]
        public string? NewPassword { get; init; }
    }
}