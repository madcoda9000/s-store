using Microsoft.AspNetCore.Authorization;
using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace sstore.Filters
{
    /// <summary>
    /// Operation filter that adds authorization information to Swagger documentation
    /// </summary>
    public class SwaggerAuthOperationFilter : IOperationFilter
    {
        /// <summary>
        /// Applies authorization metadata to Swagger operations
        /// </summary>
        /// <param name="operation">The Swagger operation to modify</param>
        /// <param name="context">The operation filter context containing metadata</param>
        public void Apply(OpenApiOperation operation, OperationFilterContext context)
        {
            // Get authorization attributes from the method and controller
            var authAttributes = context.MethodInfo.DeclaringType?
                .GetCustomAttributes(true)
                .Union(context.MethodInfo.GetCustomAttributes(true))
                .OfType<AuthorizeAttribute>()
                .ToList();

            // Check if there's an AllowAnonymous attribute
            var allowAnonymous = context.MethodInfo.DeclaringType?
                .GetCustomAttributes(true)
                .Union(context.MethodInfo.GetCustomAttributes(true))
                .OfType<AllowAnonymousAttribute>()
                .Any() ?? false;

            if (allowAnonymous)
            {
                // Endpoint allows anonymous access
                operation.Description = (operation.Description ?? "") + 
                    "\n\n**Authorization:** Public endpoint (no authentication required)";
                return;
            }

            if (authAttributes == null || !authAttributes.Any())
            {
                // No authorization required
                return;
            }

            // Collect all required roles
            var requiredRoles = authAttributes
                .Where(a => !string.IsNullOrEmpty(a.Roles))
                .SelectMany(a => a.Roles!.Split(','))
                .Select(r => r.Trim())
                .Distinct()
                .ToList();

            // Collect all required policies
            var requiredPolicies = authAttributes
                .Where(a => !string.IsNullOrEmpty(a.Policy))
                .Select(a => a.Policy!)
                .Distinct()
                .ToList();

            // Build authorization description
            var authDescription = "\n\n**Authorization:**";
            
            if (requiredRoles.Any())
            {
                authDescription += $"\n- **Required Role(s):** {string.Join(", ", requiredRoles.Select(r => $"`{r}`"))}";
            }
            
            if (requiredPolicies.Any())
            {
                authDescription += $"\n- **Required Policy:** {string.Join(", ", requiredPolicies.Select(p => $"`{p}`"))}";
            }
            
            if (!requiredRoles.Any() && !requiredPolicies.Any())
            {
                authDescription += "\n- Authentication required";
            }

            // Append to existing description
            operation.Description = (operation.Description ?? "") + authDescription;

            // Add a lock icon to the summary
            if (!string.IsNullOrEmpty(operation.Summary))
            {
                operation.Summary = "🔒 " + operation.Summary;
            }

            // Ensure security requirement is set
            if (operation.Security == null || !operation.Security.Any())
            {
                operation.Security = new List<OpenApiSecurityRequirement>
                {
                    new OpenApiSecurityRequirement
                    {
                        {
                            new OpenApiSecurityScheme
                            {
                                Reference = new OpenApiReference
                                {
                                    Type = ReferenceType.SecurityScheme,
                                    Id = "Cookie"
                                }
                            },
                            Array.Empty<string>()
                        }
                    }
                };
            }

            // Add response for unauthorized access
            if (!operation.Responses.ContainsKey("401"))
            {
                operation.Responses.Add("401", new OpenApiResponse
                {
                    Description = "Unauthorized - Authentication required"
                });
            }

            // Add response for forbidden access if roles are required
            if (requiredRoles.Any() && !operation.Responses.ContainsKey("403"))
            {
                operation.Responses.Add("403", new OpenApiResponse
                {
                    Description = $"Forbidden - Requires one of the following roles: {string.Join(", ", requiredRoles)}"
                });
            }
        }
    }
}