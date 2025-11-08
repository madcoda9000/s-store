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

// Register LogService as scoped service
builder.Services.AddScoped<ILogService, LogService>();

// Register Email Configuration from environment variables
var emailConfig = EmailConfiguration.FromEnvironment();
builder.Services.AddSingleton(emailConfig);

// Register Email Services
builder.Services.AddScoped<IEmailService, EmailService>();
builder.Services.AddScoped<IEmailSender, EmailSender>();

// Register Email Background Service
builder.Services.AddHostedService<EmailBackgroundService>();

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

// Swagger/OpenAPI configuration (only if ENABLE_SWAGGER=true)
var enableSwagger = Environment.GetEnvironmentVariable("ENABLE_SWAGGER")?.ToLower() == "true";
if (enableSwagger)
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
    });
}

// Basic Rate Limit (sinnvoll für Login/Passwort-vergessen)
builder.Services.AddOptions();
builder.Services.AddMemoryCache();
builder.Services.Configure<IpRateLimitOptions>(opt =>
{
    opt.GeneralRules = new()
    {
        new() { Endpoint = "*:/auth/*",     Limit = 60, Period = "10m" },
        new() { Endpoint = "*:/admin/*", Limit = 100, Period = "10m" }
    };
});
builder.Services.AddSingleton<IRateLimitConfiguration, RateLimitConfiguration>();
builder.Services.AddInMemoryRateLimiting();

var app = builder.Build();

// Initialize database and create default admin user if MIGRATION_ON_STARTUP=true
await InitializeDatabaseAsync(app);

app.UseForwardedHeaders(); // reverse proxy

// Only enforce HTTPS redirect if explicitly enabled AND not in development
// When behind a reverse proxy (nginx, traefik), the proxy handles HTTPS
// and the app receives HTTP traffic internally - no redirect needed
var enforceHttpsRedirect = Environment.GetEnvironmentVariable("ENFORCE_HTTPS_REDIRECT")?.ToLower() == "true";
if (!isDevelopment && enforceHttpsRedirect)
{
    app.UseHttpsRedirection();
}

// Swagger UI (only if ENABLE_SWAGGER=true)
if (enableSwagger)
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
    var cspPolicy = enableSwagger && ctx.Request.Path.StartsWithSegments("/api/doc")
        ? "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'"
        : "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'";
    
    ctx.Response.Headers["Content-Security-Policy"] = cspPolicy;
    ctx.Response.Headers["X-Content-Type-Options"] = "nosniff";
    ctx.Response.Headers["X-Frame-Options"] = "DENY";
    ctx.Response.Headers["Referrer-Policy"] = "no-referrer";

    // Strict-Transport-Security only in production
    if (!isDevelopment)
        ctx.Response.Headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";

    await next();
});

app.UseIpRateLimiting();
var defaultFilesOptions = new DefaultFilesOptions();
defaultFilesOptions.DefaultFileNames.Clear();
defaultFilesOptions.DefaultFileNames.Add("index.html");
app.UseDefaultFiles(defaultFilesOptions);
app.UseStaticFiles();
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
            logger.LogInformation($"Found {pendingMigrations.Count()} pending migrations. Applying...");
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
            logger.LogInformation($"Creating '{adminRoleName}' role...");
            var roleResult = await roleManager.CreateAsync(new IdentityRole(adminRoleName));
            
            if (roleResult.Succeeded)
            {
                logger.LogInformation($"'{adminRoleName}' role created successfully.");
            }
            else
            {
                logger.LogError($"Failed to create '{adminRoleName}' role: {string.Join(", ", roleResult.Errors.Select(e => e.Description))}");
            }
        }
        else
        {
            logger.LogInformation($"'{adminRoleName}' role already exists.");
        }

        // Step 3: Create default admin user if it doesn't exist
        var adminEmail = Environment.GetEnvironmentVariable("DEFAULT_ADMIN_EMAIL");
        var adminPassword = Environment.GetEnvironmentVariable("DEFAULT_ADMIN_PASSWORD");

        if (string.IsNullOrEmpty(adminEmail) || string.IsNullOrEmpty(adminPassword))
        {
            logger.LogWarning("DEFAULT_ADMIN_EMAIL or DEFAULT_ADMIN_PASSWORD not configured. Skipping admin user creation.");
        }
        else
        {
            var existingAdmin = await userManager.FindByEmailAsync(adminEmail);
            
            if (existingAdmin == null)
            {
                logger.LogInformation($"Creating default admin user '{adminEmail}'...");
                
                var adminUser = new ApplicationUser
                {
                    UserName = adminEmail,
                    Email = adminEmail,
                    EmailConfirmed = true, // Auto-confirm for default admin
                    CreatedAt = DateTime.UtcNow
                };

                var createResult = await userManager.CreateAsync(adminUser, adminPassword);

                if (createResult.Succeeded)
                {
                    logger.LogInformation($"Default admin user '{adminEmail}' created successfully.");

                    // Add user to Admin role
                    var addToRoleResult = await userManager.AddToRoleAsync(adminUser, adminRoleName);
                    
                    if (addToRoleResult.Succeeded)
                    {
                        logger.LogInformation($"User '{adminEmail}' added to '{adminRoleName}' role.");
                    }
                    else
                    {
                        logger.LogError($"Failed to add user to '{adminRoleName}' role: {string.Join(", ", addToRoleResult.Errors.Select(e => e.Description))}");
                    }
                }
                else
                {
                    logger.LogError($"Failed to create default admin user: {string.Join(", ", createResult.Errors.Select(e => e.Description))}");
                }
            }
            else
            {
                logger.LogInformation($"Default admin user '{adminEmail}' already exists.");
                
                // Ensure existing admin has the Admin role
                if (!await userManager.IsInRoleAsync(existingAdmin, adminRoleName))
                {
                    logger.LogInformation($"Adding existing user '{adminEmail}' to '{adminRoleName}' role...");
                    var addToRoleResult = await userManager.AddToRoleAsync(existingAdmin, adminRoleName);
                    
                    if (addToRoleResult.Succeeded)
                    {
                        logger.LogInformation($"User '{adminEmail}' added to '{adminRoleName}' role.");
                    }
                    else
                    {
                        logger.LogError($"Failed to add user to '{adminRoleName}' role: {string.Join(", ", addToRoleResult.Errors.Select(e => e.Description))}");
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
