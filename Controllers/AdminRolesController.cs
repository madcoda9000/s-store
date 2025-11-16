using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using sstore.Filters;
using sstore.Services;
using System.Runtime.CompilerServices;
using Microsoft.AspNetCore.Antiforgery;
using sstore.Models;
using System.ComponentModel.DataAnnotations;
using System.Diagnostics.CodeAnalysis;

namespace sstore.Controllers
{
    [ApiController]
    [Route("admin/roles")]
    [Authorize(Roles = "Admin")]
    public class AdminRolesController : ControllerBase
    {
        private readonly RoleManager<IdentityRole> _roles;
        private readonly UserManager<ApplicationUser> _users;
        private readonly ISecureLogService _log;
        private readonly IAntiforgery _anti;

        /// <summary>
        /// Controller for managing roles, only accessible by users with the Admin role.
        /// </summary>
        /// <param name="log">The log service to use for logging operations.</param>
        /// <param name="roles">The role manager to use for retrieving and updating role data.</param>
        /// <param name="users">The user manager to use for retrieving and updating user data.</param>
        /// <param name="anti">The antiforgery service to use for validating anti-forgery tokens.</param>
        [SuppressMessage("Style", "IDE0290:Use primary constructor", Justification = "Explicit constructor improves readability for dependency injection.")]
        public AdminRolesController(ISecureLogService log, RoleManager<IdentityRole> roles, UserManager<ApplicationUser> users, IAntiforgery anti)
        { _roles = roles; _users = users; _log = log; _anti = anti; }

        /// <summary>
        /// Retrieves a list of roles.
        /// </summary>
        /// <returns>A list of role information.</returns>
        [HttpGet("")]
        public IActionResult List()
            => Ok(_roles.Roles.Select(r => new { 
                id = r.Id, 
                name = r.Name, 
                normalizedName = r.NormalizedName, 
                concurrencyStamp = r.ConcurrencyStamp 
            }));

        /// <summary>
        /// Creates a new role
        /// </summary>
        /// <param name="dto">The role data to create</param>
        /// <returns>A result indicating whether the creation was successful</returns>
        [HttpPost("")]
        [ValidateAntiForgeryApi]
        public async Task<IActionResult> Create([FromBody] RoleDto dto)
        {
            var currentUserName = User.Identity?.Name ?? "anonymous";
            var newRole = new IdentityRole(dto.Name);
            var res = await _roles.CreateAsync(newRole);
            if (!res.Succeeded) return BadRequest(res.Errors);

            await _log.LogAuditAsync(
                "create",
                "AdminRolesController",
                "Role " + dto.Name + " created successfully",
                currentUserName
            );
            var tokens = _anti.GetAndStoreTokens(HttpContext);
            return Ok(new { 
                ok = true, 
                csrfToken = tokens.RequestToken,
                role = new { 
                    id = newRole.Id, 
                    name = newRole.Name, 
                    normalizedName = newRole.NormalizedName,
                    concurrencyStamp = newRole.ConcurrencyStamp
                }
            });
        }

        /// <summary>
        /// Checks if a role has any users assigned to it
        /// </summary>
        /// <param name="id">The ID of the role to check</param>
        /// <returns>Information about whether the role has users and the count</returns>
        [HttpGet("{id}/check-users")]
        public async Task<IActionResult> CheckUsers(string id)
        {
            var role = await _roles.FindByIdAsync(id);
            if (role is null) return NotFound();

            var usersInRole = await _users.GetUsersInRoleAsync(role.Name!);
            var userCount = usersInRole.Count;

            return Ok(new { hasUsers = userCount > 0, userCount });
        }

        /// <summary>
        /// Deletes the specified role.
        /// </summary>
        /// <param name="id">The ID of the role to delete.</param>
        /// <returns>A result indicating whether the deletion was successful.</returns>
        /// <remarks>
        /// If the role is currently in use, a Conflict response will be returned.
        /// </remarks>
        [HttpDelete("{id}")]
        [ValidateAntiForgeryApi]
        public async Task<IActionResult> Delete(string id)
        {
            var currentUserName = User.Identity?.Name ?? "anonymous";
            var role = await _roles.FindByIdAsync(id);
            if (role is null) return NotFound();

            // nicht löschen, wenn zugewiesen
            var assigned = (await _users.GetUsersInRoleAsync(role.Name!)).Any();
            if (assigned) return Conflict(new { error = "Role is in use" });

            var res = await _roles.DeleteAsync(role);
            if (!res.Succeeded) return BadRequest(res.Errors);

            await _log.LogAuditAsync(
                "delete",
                "AdminRolesController",
                "Role " + role.Name + " deleted successfully",
                currentUserName
            );

            var tokens = _anti.GetAndStoreTokens(HttpContext);
            return Ok(new { ok = true, csrfToken = tokens.RequestToken });
        }

        /// <summary>
        /// Assigns a role to a user
        /// </summary>
        /// <param name="dto">The role data to assign</param>
        /// <returns>A result indicating whether the assignment was successful</returns>
        /// <remarks>
        /// If the user or role does not exist, a NotFound response will be returned.
        /// </remarks>
        [HttpPut("assign")]
        [ValidateAntiForgeryApi]
        public async Task<IActionResult> Assign([FromBody] AssignRoleDto dto)
        {
            var currentUserName = User.Identity?.Name ?? "anonymous";
            var user = await _users.FindByIdAsync(dto.UserId);
            var role = await _roles.FindByNameAsync(dto.RoleName);
            if (user is null || role is null) return NotFound();
            var res = await _users.AddToRoleAsync(user, role.Name!);
            if (!res.Succeeded) return BadRequest(res.Errors);

            await _log.LogAuditAsync(
                "assign",
                "AdminRolesController",
                "Role " + role.Name + " assigned to user " + user.UserName,
                currentUserName
            );
            var tokens = _anti.GetAndStoreTokens(HttpContext);
            return Ok(new { ok = true, csrfToken = tokens.RequestToken });
        }
    }

    /// <summary>
    /// DTO for creating a new role
    /// </summary>
    public record RoleDto
    {
        [Required(ErrorMessage = "Rolename is required")]
        public required string Name { get; init; }
    };

    /// <summary>
    /// DTO for assigning a role to a user
    /// </summary>
    public record AssignRoleDto
    {
        [Required(ErrorMessage = "UserId is required")]
        [StringLength(450, ErrorMessage = "UserId is required")]
        public required string UserId { get; init; }

        [Required(ErrorMessage = "RoleName is required")]
        [StringLength(450, ErrorMessage = "RoleName is required")]
        public required string RoleName { get; init; }
    };

}