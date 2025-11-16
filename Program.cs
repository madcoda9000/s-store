using sstore;
using AspNetCoreRateLimit;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using DotNetEnv;
using sstore.Data;
using sstore.Services;
using sstore.Models;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.OpenApi.Models;
using System.Net;
using sstore.Middleware;
using Microsoft.AspNetCore.Mvc;

// Load .env file before anything else
Env.Load();

var builder = WebApplication.CreateBuilder(args);

// check for development environment
var isDevelopment = builder.Environment.IsDevelopment();

// Configure forwarded headers for reverse proxy
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    
    var trustAllProxies = Environment.GetEnvironmentVariable("TRUST_ALL_PROXIES")?.ToLower() == "true";
    var knownProxies = Environment.GetEnvironmentVariable("KNOWN_PROXIES");
    
    if (trustAllProxies)
    {
        // UNSECURE: trust all proxies (only for DEV / ZEST)
        options.KnownNetworks.Clear();
        options.KnownProxies.Clear();
        
        if (!isDevelopment)
        {
            // Warnung in Production
            Console.WriteLine("WARNING: TRUST_ALL_PROXIES is enabled in production. This is a security risk!");
        }
    }
    else if (!string.IsNullOrEmpty(knownProxies))
    {
        // SICHER: Nur spezifische Proxies
        foreach (var proxy in knownProxies.Split(','))
        {
            if (IPAddress.TryParse(proxy.Trim(), out var ip))
            {
                options.KnownProxies.Add(ip);
            }
        }
    }
});

// add db context
var connectionString = Environment.GetEnvironmentVariable("CONNECTION_STRING");
if (string.IsNullOrEmpty(connectionString))
    throw new InvalidOperationException("CONNECTION_STRING environment variable is required");

builder.Services.AddDbContext<AppDb>(opt =>
    opt.UseMySql(connectionString,
        ServerVersion.AutoDetect(connectionString)));

// Register HttpContextAccessor for accessing current user context
builder.Services.AddHttpContextAccessor();

// Register Security Notification Service
builder.Services.AddScoped<ISecurityNotificationService, SecurityNotificationService>();

// add DataProtection service
builder.Services.AddScoped<IDataProtectionService, DataProtectionService>();

// Register LogService as scoped service
builder.Services.AddScoped<ISecureLogService, SecureLogService>();

// Configure request logging
builder.Services.Configure<RequestLoggingOptions>(options =>
{
    options.Enabled = Environment.GetEnvironmentVariable("REQUEST_LOGGING_ENABLED")?.ToLower() == "true";
    options.LogRequestBodies = Environment.GetEnvironmentVariable("REQUEST_LOGGING_LOG_REQUEST_BODIES")?.ToLower() != "false";
    options.LogResponseBodies = Environment.GetEnvironmentVariable("REQUEST_LOGGING_LOG_RESPONSE_BODIES")?.ToLower() != "false";
    options.LogHeaders = Environment.GetEnvironmentVariable("REQUEST_LOGGING_LOG_HEADERS")?.ToLower() != "false";

    // Add these lines for max body sizes
    options.MaxRequestBodySize = int.TryParse(Environment.GetEnvironmentVariable("REQUEST_LOGGING_MAX_REQUEST_BODY_SIZE"), out var maxReqSize) 
        ? maxReqSize 
        : 10 * 1024; // 10KB default
    
    options.MaxResponseBodySize = int.TryParse(Environment.GetEnvironmentVariable("REQUEST_LOGGING_MAX_RESPONSE_BODY_SIZE"), out var maxResSize) 
        ? maxResSize 
        : 10 * 1024; // 10KB default
    
    var includedMethods = Environment.GetEnvironmentVariable("REQUEST_LOGGING_INCLUDED_METHODS");
    if (!string.IsNullOrEmpty(includedMethods))
    {
        options.IncludedMethods = [
            ..includedMethods
                .Split(',')
                .Select(m => m.Trim())
                .Where(m => !string.IsNullOrEmpty(m))
        ];
    }
    
    var excludedPaths = Environment.GetEnvironmentVariable("REQUEST_LOGGING_EXCLUDED_PATHS");
    if (!string.IsNullOrEmpty(excludedPaths))
    {
        options.ExcludedPaths = [
            ..excludedPaths
                .Split(',')
                .Select(p => p.Trim())
                .Where(p => !string.IsNullOrEmpty(p))
        ];
    }
    
    var excludedHeaders = Environment.GetEnvironmentVariable("REQUEST_LOGGING_EXCLUDED_HEADERS");
    if (!string.IsNullOrEmpty(excludedHeaders))
    {
        options.ExcludedHeaders = [
            ..excludedHeaders
                .Split(',')
                .Select(h => h.Trim())
                .Where(h => !string.IsNullOrEmpty(h))
        ];
    }
});

// Register Email Configuration from environment variables
var emailConfig = EmailConfiguration.FromEnvironment();
builder.Services.AddSingleton(emailConfig);

// Register Email Services
builder.Services.AddScoped<IEmailService, EmailService>();
builder.Services.AddScoped<IEmailSender, EmailSender>();

// Register Email Background Service
builder.Services.AddHostedService<EmailBackgroundService>();

// register code generator service
builder.Services.AddScoped<ISecureCodeGenerator, SecureCodeGenerator>();

// register temporary token service
builder.Services.AddScoped<ITemporaryTokenService, TemporaryTokenService>();

// register session management service
builder.Services.AddScoped<ISessionManagementService, SessionManagementService>();

// Identity Core + Roles, aber ohne Razor UI, wir liefern JSON
builder.Services
    .AddIdentityCore<ApplicationUser>(o =>
    {
        o.Password.RequireDigit = true;
        o.Password.RequireUppercase = true;
        o.Password.RequireLowercase = true;
        o.Password.RequireNonAlphanumeric = false;
        o.Password.RequiredLength = 12;

        o.SignIn.RequireConfirmedAccount = true; 
        o.Lockout.MaxFailedAccessAttempts = 5;
        o.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(10);
        o.User.RequireUniqueEmail = true;
    })
    .AddRoles<IdentityRole>()
    .AddEntityFrameworkStores<AppDb>()
    .AddSignInManager()
    .AddDefaultTokenProviders();

builder.Services
    .AddAuthentication(IdentityConstants.ApplicationScheme)
    .AddCookie(IdentityConstants.ApplicationScheme, o =>
    {
        o.Cookie.Name = "app_auth";
        o.Cookie.HttpOnly = true;
        o.Cookie.SameSite = SameSiteMode.Lax;
        o.Cookie.SecurePolicy = isDevelopment
            ? CookieSecurePolicy.SameAsRequest
            : CookieSecurePolicy.Always;
        o.LoginPath = "/auth/login";     // nur falls jemand HTML will
        o.LogoutPath = "/auth/logout";
        o.SlidingExpiration = true;
        o.ExpireTimeSpan = TimeSpan.FromHours(8);
        
        // Configure events to return JSON instead of redirects
        o.Events.OnRedirectToLogin = ctx =>
        {
            ctx.Response.StatusCode = 401;
            ctx.Response.ContentType = "application/json";
            return ctx.Response.WriteAsJsonAsync(new { error = "Unauthorized" });
        };
        
        o.Events.OnRedirectToAccessDenied = ctx =>
        {
            ctx.Response.StatusCode = 403;
            ctx.Response.ContentType = "application/json";
            return ctx.Response.WriteAsJsonAsync(new { error = "Forbidden" });
        };
    });

builder.Services.AddAntiforgery(o =>
{
    o.HeaderName = "X-XSRF-TOKEN";
    o.Cookie.Name = "XSRF-TOKEN";
    o.Cookie.HttpOnly = true; // Secure: JavaScript cannot read this cookie
    o.Cookie.SameSite = SameSiteMode.Strict;
    o.Cookie.SecurePolicy = isDevelopment
        ? CookieSecurePolicy.SameAsRequest
        : CookieSecurePolicy.Always;
});

builder.Services.AddControllers(); // reines JSON

// Add automatic model validation - MUSS VOR builder.Build() SEIN!
builder.Services.Configure<ApiBehaviorOptions>(options =>
{
    options.InvalidModelStateResponseFactory = context =>
    {
        var errors = context.ModelState
            .Where(e => e.Value?.Errors.Count > 0)
            .SelectMany(e => e.Value!.Errors.Select(er => new
            {
                field = e.Key,
                message = er.ErrorMessage
            }))
            .ToList();

        return new BadRequestObjectResult(new
        {
            error = "Validation failed",
            details = errors
        });
    };
});

// CORS Configuration - only if frontend is on different origin
var allowedOrigins = Environment.GetEnvironmentVariable("ALLOWED_ORIGINS")?.Split(',')
    ?? new[] { "http://localhost:5173", "http://localhost:3000" }; // Default for dev

builder.Services.AddCors(options =>
{
    options.AddPolicy("DefaultCorsPolicy", policy =>
    {
        policy.WithOrigins(allowedOrigins)
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials() // Required for cookies
              .SetIsOriginAllowedToAllowWildcardSubdomains(); // Allow subdomains if needed
        
        // In production, be more restrictive
        if (!isDevelopment)
        {
            policy.SetPreflightMaxAge(TimeSpan.FromHours(1)); // Cache preflight requests
        }
    });
});

// Swagger/OpenAPI configuration (only if Environment is set to development)
if (isDevelopment)
{
    builder.Services.AddEndpointsApiExplorer();
    builder.Services.AddSwaggerGen(options =>
    {
        options.SwaggerDoc("v1", new OpenApiInfo
        {
            Title = "S-Store API",
            Version = "v1",
            Description = "RESTful API for S-Store application with authentication and authorization",
            Contact = new OpenApiContact
            {
                Name = "S-Store Team",
                Email = "support@s-store.local"
            }
        });

        // Add Cookie Authentication scheme for Swagger
        options.AddSecurityDefinition("Cookie", new OpenApiSecurityScheme
        {
            Type = SecuritySchemeType.ApiKey,
            In = ParameterLocation.Cookie,
            Name = "app_auth",
            Description = "Cookie-based authentication. Login via /auth/login endpoint."
        });

        // Add CSRF Token requirement
        options.AddSecurityDefinition("CSRF", new OpenApiSecurityScheme
        {
            Type = SecuritySchemeType.ApiKey,
            In = ParameterLocation.Header,
            Name = "X-XSRF-TOKEN",
            Description = "CSRF Token obtained from /api/csrf-token endpoint"
        });

        options.AddSecurityRequirement(new OpenApiSecurityRequirement
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
            },
            {
                new OpenApiSecurityScheme
                {
                    Reference = new OpenApiReference
                    {
                        Type = ReferenceType.SecurityScheme,
                        Id = "CSRF"
                    }
                },
                Array.Empty<string>()
            }
        });

        // Include XML comments if available
        var xmlFile = $"{System.Reflection.Assembly.GetExecutingAssembly().GetName().Name}.xml";
        var xmlPath = Path.Combine(AppContext.BaseDirectory, xmlFile);
        if (File.Exists(xmlPath))
        {
            options.IncludeXmlComments(xmlPath);
        }

        // Add operation filter to display authorization requirements
        options.OperationFilter<sstore.Filters.SwaggerAuthOperationFilter>();
    });
}

// Enhanced Rate Limiting Configuration
builder.Services.AddOptions();
builder.Services.AddMemoryCache();
builder.Services.Configure<IpRateLimitOptions>(opt =>
{
    opt.GeneralRules = new()
    {
        // === CRITICAL AUTHENTICATION ENDPOINTS ===
        new() { Endpoint = "POST:/auth/login", Limit = 5, Period = "15m" },
        new() { Endpoint = "POST:/auth/2fa/verify-authenticator", Limit = 5, Period = "15m" },
        new() { Endpoint = "POST:/auth/2fa/verify-email", Limit = 5, Period = "15m" },
        new() { Endpoint = "POST:/auth/reset-password", Limit = 3, Period = "1h" },
        new() { Endpoint = "POST:/auth/forgot-password", Limit = 3, Period = "1h" },  // KORRIGIERT: 60mm -> 1h
        
        // === REGISTRATION AND VERIFICATION ===
        new() { Endpoint = "POST:/auth/register", Limit = 3, Period = "1h" },
        new() { Endpoint = "POST:/auth/verify-email", Limit = 10, Period = "1h" },  // KORRIGIERT: verify.email -> verify-email
        new() { Endpoint = "POST:/auth/verify-email-code", Limit = 10, Period = "1h" },
        new() { Endpoint = "POST:/auth/resend-verification", Limit = 3, Period = "1h" },
        
        // === 2FA SETUP ===
        new() { Endpoint = "POST:/auth/2fa/setup-authenticator", Limit = 5, Period = "1h" },
        new() { Endpoint = "POST:/auth/2fa/setup-email", Limit = 5, Period = "1h" },
        new() { Endpoint = "POST:/auth/2fa/verify-authenticator-setup", Limit = 10, Period = "1h" },
        new() { Endpoint = "POST:/auth/2fa/verify-email-setup", Limit = 10, Period = "1h" },
        
        // === GENERAL ENDPOINTS ===
        new() { Endpoint = "*:/auth/*", Limit = 30, Period = "10m" },
        new() { Endpoint = "*:/admin/*", Limit = 100, Period = "10m" },
        new() { Endpoint = "*:/profile/*", Limit = 20, Period = "10m" },
        new() { Endpoint = "*:/api/*", Limit = 200, Period = "10m" }
    };
    
    // Endpoint whitelist
    opt.EndpointWhitelist = new List<string>
    {
        "GET:/api/csrf-token",
        "GET:/",
        "GET:/favicon.ico"
    };
    
    // Enable endpoint-specific rate limiting
    opt.EnableEndpointRateLimiting = true;
    opt.StackBlockedRequests = false;
    
    // Customize response when rate limit exceeded
    opt.HttpStatusCode = 429;
    opt.QuotaExceededResponse = new QuotaExceededResponse
    {
        Content = "{{ \"error\": \"Rate limit exceeded. Please try again later.\", \"retryAfter\": \"{0}\" }}",
        ContentType = "application/json"
    };
    
    // Real client IP resolution
    opt.RealIpHeader = "X-Real-IP";
    opt.ClientIdHeader = "X-ClientId";
});

builder.Services.AddSingleton<IRateLimitConfiguration, RateLimitConfiguration>();
builder.Services.AddInMemoryRateLimiting();

// ============================================
// AB HIER: var app = builder.Build()
// KEINE builder.Services mehr ab hier!
// ============================================

var app = builder.Build();

// Initialize database and create default admin user if MIGRATION_ON_STARTUP=true
await InitializeDatabaseAsync(app);

app.UseForwardedHeaders(); // reverse proxy

// use cors
app.UseCors("DefaultCorsPolicy");

// Add request validation
app.UseRequestValidation();

// Only enforce HTTPS redirect if explicitly enabled AND not in development
// When behind a reverse proxy (nginx, traefik), the proxy handles HTTPS
// and the app receives HTTP traffic internally - no redirect needed
var enforceHttpsRedirect = Environment.GetEnvironmentVariable("ENFORCE_HTTPS_REDIRECT")?.ToLower() == "true";
if (!isDevelopment && enforceHttpsRedirect)
{
    app.UseHttpsRedirection();
}

// Swagger UI (only if development)
if (isDevelopment)
{
    app.UseSwagger();
    app.UseSwaggerUI(options =>
    {
        options.SwaggerEndpoint("/swagger/v1/swagger.json", "S-Store API v1");
        options.RoutePrefix = "api/doc"; // Swagger UI available at /api/doc
        options.DocumentTitle = "S-Store API Documentation";
        options.DefaultModelsExpandDepth(-1); // Hide schemas section by default
    });
    
    app.Logger.LogInformation("Swagger documentation enabled at /api/doc");
}

// CSP & Security Headers
app.Use(async (ctx, next) =>
{
    // Adjust CSP for Swagger UI if enabled
    var cspPolicy = isDevelopment && ctx.Request.Path.StartsWithSegments("/api/doc")
        ? "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'"
        : "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'";
    
    ctx.Response.Headers.ContentSecurityPolicy = cspPolicy;
    ctx.Response.Headers.XContentTypeOptions = "nosniff";
    ctx.Response.Headers.XFrameOptions = "DENY";
    ctx.Response.Headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
    ctx.Response.Headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()";

    // Strict-Transport-Security only in production
    if (!isDevelopment)
        ctx.Response.Headers.StrictTransportSecurity = "max-age=31536000; includeSubDomains; preload";

    await next();
});

app.UseIpRateLimiting();

var defaultFilesOptions = new DefaultFilesOptions();
defaultFilesOptions.DefaultFileNames.Clear();
defaultFilesOptions.DefaultFileNames.Add("index.html");
app.UseDefaultFiles(defaultFilesOptions);

app.UseStaticFiles();

// Add request logging middleware
app.UseRequestLogging();

app.UseAuthentication();

// Generate CSRF cookie for any GET request
app.Use(async (ctx, next) =>
{
    if (HttpMethods.IsGet(ctx.Request.Method))
    {
        var anti = ctx.RequestServices.GetRequiredService<IAntiforgery>();
        anti.GetAndStoreTokens(ctx);
    }
    await next();
});

app.UseAuthorization();
app.MapControllers();
app.Run();

// Initializes the database by running migrations and creating default admin user.
// Only executes if MIGRATION_ON_STARTUP environment variable is set to 'true'.
async static Task InitializeDatabaseAsync(WebApplication app)
{
    var migrationOnStartup = Environment.GetEnvironmentVariable("MIGRATION_ON_STARTUP")?.ToLower();
    
    if (migrationOnStartup != "true")
    {
        app.Logger.LogInformation("MIGRATION_ON_STARTUP is not enabled. Skipping database initialization.");
        return;
    }

    app.Logger.LogInformation("Starting database initialization...");

    using var scope = app.Services.CreateScope();
    var services = scope.ServiceProvider;

    try
    {
        // Get required services
        var context = services.GetRequiredService<AppDb>();
        var userManager = services.GetRequiredService<UserManager<ApplicationUser>>();
        var roleManager = services.GetRequiredService<RoleManager<IdentityRole>>();
        var logger = services.GetRequiredService<ILogger<Program>>();

        // Step 1: Ensure database exists and apply migrations
        logger.LogInformation("Checking database and applying migrations...");
        var pendingMigrations = await context.Database.GetPendingMigrationsAsync();
        
        if (pendingMigrations.Any())
        {
            logger.LogInformation("Found {MigrationCount} pending migrations. Applying...", pendingMigrations.Count());
            await context.Database.MigrateAsync();
            logger.LogInformation("Migrations applied successfully.");
        }
        else
        {
            logger.LogInformation("No pending migrations. Database is up to date.");
        }

        // Step 2: Create default Admin role if it doesn't exist
        const string adminRoleName = "Admin";

        if (!await roleManager.RoleExistsAsync(adminRoleName))
        {
            logger.LogInformation("Creating '{AdminRoleName}' role...", adminRoleName);
            var roleResult = await roleManager.CreateAsync(new IdentityRole(adminRoleName));

            if (roleResult.Succeeded)
            {
                logger.LogInformation("'{AdminRoleName}' role created successfully.", adminRoleName);
            }
            else
            {
                logger.LogError("Failed to create '{AdminRoleName}' role: {Errors}", adminRoleName, string.Join(", ", roleResult.Errors.Select(e => e.Description)));
            }
        }
        else
        {
            logger.LogInformation("'{AdminRoleName}' role already exists.", adminRoleName);
        }

        // Step 2.1: Create default AuditInvestigator role if it doesn't exist
        const string AuditInvestigatorRole = "AuditInvestigator";

        if (!await roleManager.RoleExistsAsync(AuditInvestigatorRole))
        {
            logger.LogInformation("Creating '{AuditInvestigatorRole}' role...", AuditInvestigatorRole);
            var roleResult = await roleManager.CreateAsync(new IdentityRole(AuditInvestigatorRole));

            if (roleResult.Succeeded)
            {
                logger.LogInformation("'{AuditInvestigatorRole}' role created successfully.", AuditInvestigatorRole);
            }
            else
            {
                logger.LogError("Failed to create '{AuditInvestigatorRole}' role: {Errors}", AuditInvestigatorRole, string.Join(", ", roleResult.Errors.Select(e => e.Description)));
            }
        }
        else
        {
            logger.LogInformation("'{AuditInvestigatorRole}' role already exists.", AuditInvestigatorRole);
        }
        
        // Step 2.2: Create default User role if it doesn't exist
        const string UserRole = "User";

        if (!await roleManager.RoleExistsAsync(UserRole))
        {
            logger.LogInformation("Creating '{UserRole}' role...", UserRole);
            var roleResult = await roleManager.CreateAsync(new IdentityRole(UserRole));

            if (roleResult.Succeeded)
            {
                logger.LogInformation("'{UserRole}' role created successfully.", UserRole);
            }
            else
            {
                logger.LogError("Failed to create '{UserRole}' role: {Errors}", UserRole, string.Join(", ", roleResult.Errors.Select(e => e.Description)));
            }
        }
        else
        {
            logger.LogInformation("'{UserRole}' role already exists.", UserRole);
        }


        // Step 3: Create default admin user if it doesn't exist
        var adminEmail = Environment.GetEnvironmentVariable("DEFAULT_ADMIN_EMAIL");
        var adminPassword = Environment.GetEnvironmentVariable("DEFAULT_ADMIN_PASSWORD");
        var adminUsername = Environment.GetEnvironmentVariable("DEFAULT_ADMIN_USERNAME");

        if (string.IsNullOrEmpty(adminEmail) || string.IsNullOrEmpty(adminPassword))
        {
            logger.LogWarning("DEFAULT_ADMIN_EMAIL or DEFAULT_ADMIN_PASSWORD not configured. Skipping admin user creation.");
        }
        else
        {
            var existingAdmin = await userManager.FindByEmailAsync(adminEmail);
            
            if (existingAdmin == null)
            {
                logger.LogInformation("Creating default admin user '{AdminEmail}'...", adminEmail);
                
                var adminUser = new ApplicationUser
                {
                    UserName = adminUsername,
                    Email = adminEmail,
                    EmailConfirmed = true, // Auto-confirm for default admin
                    CreatedAt = DateTime.UtcNow
                };

                var createResult = await userManager.CreateAsync(adminUser, adminPassword);

                if (createResult.Succeeded)
                {
                    logger.LogInformation("Default admin user '{AdminEmail}' created successfully.", adminEmail);

                    // Add user to Admin role and AuditInvestigator role
                    var addToRoleResult1 = await userManager.AddToRoleAsync(adminUser, adminRoleName);
                    var addToRoleResult2 = await userManager.AddToRoleAsync(adminUser, AuditInvestigatorRole);

                    if (addToRoleResult1.Succeeded)
                    {
                        logger.LogInformation("User '{AdminEmail}' added to '{AdminRoleName}' role.", adminEmail, adminRoleName);
                    }
                    else
                    {
                        logger.LogError("Failed to add user to '{AdminRoleName}' role: {Errors}", adminRoleName, string.Join(", ", addToRoleResult1.Errors.Select(e => e.Description)));
                    }

                    if (addToRoleResult2.Succeeded)
                    {
                        logger.LogInformation("User '{AdminEmail}' added to '{AuditInvestigatorRole}' role.", adminEmail, AuditInvestigatorRole);
                    }
                    else
                    {
                        logger.LogError("Failed to add user to '{AuditInvestigatorRole}' role: {Errors}", AuditInvestigatorRole, string.Join(", ", addToRoleResult2.Errors.Select(e => e.Description)));
                    }
                    }
                    else
                    {
                        logger.LogError("Failed to create default admin user: {Errors}", string.Join(", ", createResult.Errors.Select(e => e.Description)));
                    }
            }
            else
            {
                logger.LogInformation("Default admin user '{AdminEmail}' already exists.", adminEmail);
                
                // Ensure existing admin has the Admin role
                if (!await userManager.IsInRoleAsync(existingAdmin, adminRoleName))
                {
                    logger.LogInformation("Adding existing user '{AdminEmail}' to '{AdminRoleName}' role...", adminEmail, adminRoleName);
                    var addToRoleResult = await userManager.AddToRoleAsync(existingAdmin, adminRoleName);
                    
                    if (addToRoleResult.Succeeded)
                    {
                        logger.LogInformation("User '{AdminEmail}' added to '{AdminRoleName}' role.", adminEmail, adminRoleName);
                    }
                    else
                    {
                        logger.LogError("Failed to add user to '{AdminRoleName}' role: {Errors}", adminRoleName, string.Join(", ", addToRoleResult.Errors.Select(e => e.Description)));
                    }
                }
            }
        }

        logger.LogInformation("Database initialization completed successfully.");
    }
    catch (Exception ex)
    {
        app.Logger.LogError(ex, "An error occurred during database initialization.");
        throw; // Re-throw to prevent application startup if DB init fails
    }
}