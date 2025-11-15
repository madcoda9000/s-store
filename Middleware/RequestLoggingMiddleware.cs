using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;
using sstore.Services;

namespace sstore.Middleware
{
    /// <summary>
    /// Middleware for logging HTTP requests and responses
    /// </summary>
    public class RequestLoggingMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly ILogger<RequestLoggingMiddleware> _logger;
        private readonly RequestLoggingOptions _options;
        private readonly ISecureLogService _logService;
        private readonly HashSet<string> _excludedPaths;

        /// <summary>
        /// Initializes a new instance of the <see cref="RequestLoggingMiddleware"/> class.
        /// </summary>
        /// <param name="next"></param>
        /// <param name="logger"></param>
        /// <param name="options"></param>
        public RequestLoggingMiddleware(
            RequestDelegate next,
            ILogger<RequestLoggingMiddleware> logger,
            IOptions<RequestLoggingOptions> options)
        {
            _next = next ?? throw new ArgumentNullException(nameof(next));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
            _options = options?.Value ?? new RequestLoggingOptions();

            // Initialize excluded paths
            _excludedPaths = new HashSet<string>(_options.ExcludedPaths ?? Array.Empty<string>(),
                StringComparer.OrdinalIgnoreCase);
        }

        /// <summary>
        /// Invokes the middleware pipeline and logs the request and response.
        /// </summary>
        /// <param name="context"></param>
        /// <param name="logService"></param>
        public async Task InvokeAsync(HttpContext context, ISecureLogService logService)
        {
            // Skip logging if disabled or path is excluded
            if (!_options.Enabled || IsPathExcluded(context.Request.Path))
            {
                await _next(context);
                return;
            }

            // Capture request details
            var request = context.Request;
            var requestBody = await ReadRequestBodyAsync(request);

            // Store the original response body stream
            var originalResponseBody = context.Response.Body;

            try
            {
                // Create a new memory stream for the response
                using var responseBody = new MemoryStream();
                context.Response.Body = responseBody;

                // Call the next middleware in the pipeline
                await _next(context);

                // Capture response details
                var response = context.Response;
                var responseBodyContent = await ReadResponseBodyAsync(response);

                // Log the request and response
                await LogRequestAsync(context, request, response, requestBody, responseBodyContent, logService);

                // Copy the response body back to the original stream
                responseBody.Seek(0, SeekOrigin.Begin);
                await responseBody.CopyToAsync(originalResponseBody);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing request logging");
                throw;
            }
            finally
            {
                // Always restore the original response body stream
                context.Response.Body = originalResponseBody;
            }
        }

        /// <summary>
        /// Checks if the path is excluded from logging.
        /// </summary>
        /// <param name="path"></param>
        /// <returns></returns>
        private bool IsPathExcluded(PathString path)
        {
            return _excludedPaths.Any(p =>
                path.StartsWithSegments(p, StringComparison.OrdinalIgnoreCase));
        }

        /// <summary>
        /// Reads the request body and returns it as a string.
        /// </summary>
        /// <param name="request"></param>
        /// <returns></returns>
        private async Task<string> ReadRequestBodyAsync(HttpRequest request)
        {
            if (!_options.LogRequestBodies ||
                !request.ContentLength.HasValue ||
                request.ContentLength <= 0 ||
                !_options.IncludedMethods.Contains(request.Method, StringComparer.OrdinalIgnoreCase))
            {
                return string.Empty;
            }

            try
            {
                request.EnableBuffering();
                var encoding = GetRequestEncoding(request);
                return await ReadAndTruncateBodyAsync(
                    request.Body,
                    _options.MaxRequestBodySize,
                    true,
                    encoding);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error reading request body");
                return "[Error reading request body]";
            }
        }

        /// <summary>
        /// Reads the response body and returns it as a string.
        /// </summary>
        /// <param name="response"></param>
        /// <returns></returns>
        private async Task<string> ReadResponseBodyAsync(HttpResponse response)
        {
            if (!_options.LogResponseBodies || response.ContentLength <= 0)
            {
                return string.Empty;
            }

            try
            {
                response.Body.Seek(0, SeekOrigin.Begin);
                var encoding = GetResponseEncoding(response);
                var body = await ReadAndTruncateBodyAsync(
                    response.Body,
                    _options.MaxResponseBodySize,
                    true,
                    encoding);
                response.Body.Seek(0, SeekOrigin.Begin);
                return body;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error reading response body");
                return "[Error reading response body]";
            }
        }

        /// <summary>
        /// Gets the encoding of the request.
        /// </summary>
        /// <param name="request"></param>
        /// <returns></returns>
        private static Encoding GetRequestEncoding(HttpRequest request)
        {
            try
            {
                var contentType = request.ContentType;
                if (string.IsNullOrEmpty(contentType))
                    return Encoding.UTF8;

                var charset = contentType.Split(';')
                    .Select(s => s.Trim())
                    .FirstOrDefault(s => s.StartsWith("charset=", StringComparison.OrdinalIgnoreCase))?
                    .Substring("charset=".Length);

                return !string.IsNullOrEmpty(charset)
                    ? Encoding.GetEncoding(charset)
                    : Encoding.UTF8;
            }
            catch
            {
                return Encoding.UTF8;
            }
        }

        /// <summary>
        /// Gets the encoding of the response.
        /// </summary>
        /// <param name="response"></param>
        /// <returns></returns>
        private static Encoding GetResponseEncoding(HttpResponse response)
        {
            try
            {
                var contentType = response.ContentType;
                if (string.IsNullOrEmpty(contentType))
                    return Encoding.UTF8;

                var charset = contentType.Split(';')
                    .Select(s => s.Trim())
                    .FirstOrDefault(s => s.StartsWith("charset=", StringComparison.OrdinalIgnoreCase))?
                    .Substring("charset=".Length);

                return !string.IsNullOrEmpty(charset)
                    ? Encoding.GetEncoding(charset)
                    : Encoding.UTF8;
            }
            catch
            {
                return Encoding.UTF8;
            }
        }

        /// <summary>
        /// Logs the request and response details.
        /// </summary>
        /// <param name="context"></param>
        /// <param name="request"></param>
        /// <param name="response"></param>
        /// <param name="requestBody"></param>
        /// <param name="responseBody"></param>
        /// <param name="logService"></param>
        private async Task LogRequestAsync(
    HttpContext context,
    HttpRequest request,
    HttpResponse response,
    string requestBody,
    string responseBody,
    ISecureLogService logService)
        {
            try
            {
                var logData = new
                {
                    Method = request.Method,
                    Path = request.Path + request.QueryString,
                    StatusCode = response.StatusCode,
                    Headers = _options.LogHeaders ? request.Headers
                        .Where(h => !_options.ExcludedHeaders.Contains(h.Key, StringComparer.OrdinalIgnoreCase))
                        .ToDictionary(h => h.Key, h => h.Value.ToString()) : null,
                    RequestBody = TruncateIfNeeded(requestBody, _options.MaxRequestBodySize, out var requestTruncated),
                    RequestTruncated = requestTruncated,
                    ResponseBody = TruncateIfNeeded(responseBody, _options.MaxResponseBodySize, out var responseTruncated),
                    ResponseTruncated = responseTruncated,
                    RemoteIpAddress = context.Connection.RemoteIpAddress?.ToString(),
                    User = context.User.Identity?.Name ?? "anonymous"
                };

                var logMessage = JsonSerializer.Serialize(logData, new JsonSerializerOptions
                {
                    WriteIndented = false,
                    PropertyNamingPolicy = JsonNamingPolicy.CamelCase
                });

                await logService.LogRequestAsync(
                    action: $"{request.Method} {request.Path}",
                    context: "HTTP Request",
                    message: logMessage,
                    user: context.User.Identity?.Name);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error logging request");
            }
        }

        /// <summary>
        /// Truncates the content if it exceeds the specified maximum length.
        /// </summary>
        /// <param name="content"></param>
        /// <param name="maxLength"></param>
        /// <param name="wasTruncated"></param>
        /// <returns></returns>
        private string TruncateIfNeeded(string content, int maxLength, out bool wasTruncated)
        {
            wasTruncated = content.Length > maxLength;
            return wasTruncated ? content.Substring(0, maxLength) + " [TRUNCATED]" : content;
        }

        /// <summary>
        /// Reads the body of the request or response and truncates it if it exceeds the specified maximum length.
        /// </summary>
        /// <param name="body"></param>
        /// <param name="maxLength"></param>
        /// <param name="canRead"></param>
        /// <param name="encoding"></param>
        /// <returns></returns>
        private async Task<string> ReadAndTruncateBodyAsync(Stream body, int maxLength, bool canRead, Encoding encoding)
        {
            if (!canRead || maxLength <= 0)
            {
                return string.Empty;
            }

            try
            {
                body.Seek(0, SeekOrigin.Begin);
                using var reader = new StreamReader(body, encoding, true, 1024, true);
                var buffer = new char[Math.Min(maxLength, 1024)];
                var totalRead = 0;
                var result = new StringBuilder();

                while (totalRead < maxLength)
                {
                    var bytesRead = await reader.ReadBlockAsync(buffer, 0, Math.Min(maxLength - totalRead, buffer.Length));
                    if (bytesRead == 0) break;

                    result.Append(buffer, 0, bytesRead);
                    totalRead += bytesRead;
                }

                if (totalRead >= maxLength)
                {
                    result.Append(" [TRUNCATED]");
                }

                return result.ToString();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error reading request/response body");
                return "[Error reading body]";
            }
            finally
            {
                body.Seek(0, SeekOrigin.Begin);
            }
        }
    }

    /// <summary>
    /// Options for request logging middleware
    /// </summary>
    public class RequestLoggingOptions
    {
        /// <summary>
        /// Gets or sets a value indicating whether request logging is enabled
        /// </summary>
        public bool Enabled { get; set; } = true;

        /// <summary>
        /// Gets or sets a value indicating whether to log request bodies
        /// </summary>
        public bool LogRequestBodies { get; set; } = true;

        /// <summary>
        /// Gets or sets a value indicating whether to log response bodies
        /// </summary>
        public bool LogResponseBodies { get; set; } = true;

        /// <summary>
        /// Gets or sets a value indicating whether to log headers
        /// </summary>
        public bool LogHeaders { get; set; } = true;

        /// <summary>
        /// Gets or sets the list of HTTP methods to include in request body logging
        /// </summary>
        public string[] IncludedMethods { get; set; } = new[] { "POST", "PUT", "PATCH" };

        /// <summary>
        /// Gets or sets the list of paths to exclude from logging
        /// </summary>
        public string[] ExcludedPaths { get; set; } = Array.Empty<string>();

        /// <summary>
        /// Gets or sets the list of headers to exclude from logging
        /// </summary>
        public string[] ExcludedHeaders { get; set; } = new[] { "Authorization", "Cookie" };

        /// <summary>
        /// Gets or sets the maximum size in bytes for request bodies to log
        /// </summary>
        public int MaxRequestBodySize { get; set; } = 1024 * 10; // 10KB default

        /// <summary>
        /// Gets or sets the maximum size in bytes for response bodies to log
        /// </summary>
        public int MaxResponseBodySize { get; set; } = 1024 * 10; // 10KB default
    }

    /// <summary>
    /// Extension methods for adding request logging middleware
    /// </summary>
    public static class RequestLoggingMiddlewareExtensions
    {
        /// <summary>
        /// Adds request logging middleware to the application's request pipeline
        /// </summary>
        /// <param name="builder">The application builder</param>
        /// <returns>The application builder for chaining</returns>
        public static IApplicationBuilder UseRequestLogging(this IApplicationBuilder builder)
        {
            return builder.UseMiddleware<RequestLoggingMiddleware>();
        }

        /// <summary>
        /// Configures request logging options
        /// </summary>
        /// <param name="services">The service collection</param>
        /// <param name="configureOptions">Action to configure the options</param>
        /// <returns>The service collection for chaining</returns>
        public static IServiceCollection ConfigureRequestLogging(
            this IServiceCollection services,
            Action<RequestLoggingOptions> configureOptions)
        {
            return services.Configure(configureOptions);
        }
    }
}
