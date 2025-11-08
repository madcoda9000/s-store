using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using sstore.Filters;
using sstore.Services;
using System.Runtime.CompilerServices;
using Microsoft.AspNetCore.Antiforgery;
using sstore.Models;

namespace sstore.Controllers
{
    [ApiController]
    [Route("admin/roles")]
    [Authorize(Roles = "Admin")]
    public class AdminRolesController : ControllerBase
    {
        private readonly RoleManager<IdentityRole> _roles;
        private readonly UserManager<ApplicationUser> _users;
        private readonly ILogService _log;
        private readonly IAntiforgery _anti;

        /// <summary>
        /// Controller for managing roles, only accessible by users with the Admin role.
        /// </summary>
        /// <param name="log">The log service to use for logging operations.</param>
        /// <param name="roles">The role manager to use for retrieving and updating role data.</param>
        /// <param name="users">The user manager to use for retrieving and updating user data.</param>
        /// <param name="anti">The antiforgery service to use for validating anti-forgery tokens.</param>
        public AdminRolesController(ILogService log, RoleManager<IdentityRole> roles, UserManager<ApplicationUser> users, IAntiforgery anti)
        { _roles = roles; _users = users; _log = log; _anti = anti; }

        /// <summary>
        /// Retrieves a list of roles.
        /// </summary>
        /// <returns>A list of role information.</returns>
        [HttpGet("")]
        public IActionResult List()
            => Ok(_roles.Roles.Select(r => new { r.Id, r.Name }));

        /// <summary>
        /// Creates a new role
        /// </summary>
        /// <param name="dto">The role data to create</param>
        /// <returns>A result indicating whether the creation was successful</returns>
        [HttpPost("create")]
        [ValidateAntiForgeryApi]
        public async Task<IActionResult> Create([FromBody] RoleDto dto)
        {
            var currentUserName = User.Identity?.Name ?? "anonymous";
            var res = await _roles.CreateAsync(new IdentityRole(dto.Name));
            if (!res.Succeeded) return BadRequest(res.Errors);

            await _log.LogAuditAsync(
                "create",
                "AdminRolesController",
                "Role " + dto.Name + " created successfully",
                currentUserName
            );
            var tokens = _anti.GetAndStoreTokens(HttpContext);
            return Ok(new { ok = true, csrfToken = tokens.RequestToken });
        }

        /// <summary>
        /// Deletes the specified role.
        /// </summary>
        /// <param name="id">The ID of the role to delete.</param>
        /// <returns>A result indicating whether the deletion was successful.</returns>
        /// <remarks>
        /// If the role is currently in use, a Conflict response will be returned.
        /// </remarks>
        [HttpDelete("{id}/delete")]
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

    public record RoleDto(string Name);
    public record AssignRoleDto(string UserId, string RoleName);

}