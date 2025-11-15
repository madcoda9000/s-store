
using Microsoft.AspNetCore.Mvc;
using System.ComponentModel.DataAnnotations;

namespace sstore.Middleware
{
    /// <summary>
    /// Middleware to limit request body size and validate content
    /// </summary>
    public class RequestValidationMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly ILogger<RequestValidationMiddleware> _logger;
        private const long MaxRequestBodySize = 10 * 1024 * 1024; // 10 MB

        /// <summary>
        /// Initializes a new instance of the <see cref="RequestValidationMiddleware"/> class.
        /// </summary>
        /// <param name="next"></param>
        /// <param name="logger"></param>
        public RequestValidationMiddleware(RequestDelegate next, ILogger<RequestValidationMiddleware> logger)
        {
            _next = next;
            _logger = logger;
        }

        /// <summary>
        /// Invokes the middleware pipeline and validates the request.
        /// </summary>
        /// <param name="context"></param>
        public async Task InvokeAsync(HttpContext context)
        {
            // Check request body size
            if (context.Request.ContentLength.HasValue && 
                context.Request.ContentLength.Value > MaxRequestBodySize)
            {
                context.Response.StatusCode = 413; // Payload Too Large
                await context.Response.WriteAsJsonAsync(new 
                { 
                    error = "Request body too large. Maximum size is 10MB." 
                });
                return;
            }

            // Validate Content-Type for POST/PUT requests
            if ((context.Request.Method == "POST" || context.Request.Method == "PUT") &&
                context.Request.ContentLength > 0)
            {
                var contentType = context.Request.ContentType?.ToLowerInvariant();
                if (string.IsNullOrEmpty(contentType) || 
                    !contentType.StartsWith("application/json"))
                {
                    context.Response.StatusCode = 415; // Unsupported Media Type
                    await context.Response.WriteAsJsonAsync(new 
                    { 
                        error = "Content-Type must be application/json" 
                    });
                    return;
                }
            }

            await _next(context);
        }
    }

    /// <summary>
    /// Extension method to add request validation middleware
    /// </summary>
    public static class RequestValidationMiddlewareExtensions
    {
        public static IApplicationBuilder UseRequestValidation(this IApplicationBuilder builder)
        {
            return builder.UseMiddleware<RequestValidationMiddleware>();
        }
    }
}