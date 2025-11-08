using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using sstore.Models;

namespace sstore.Data
{
    /// <summary>
    /// Identity-DbContext for users, roles, logins etc.
    /// </summary>
    public class AppDb : IdentityDbContext<ApplicationUser, IdentityRole, string>
    {
        public AppDb(DbContextOptions<AppDb> options) : base(options)
        {
        }

        /// <summary>
        /// Log entries for system-wide logging
        /// </summary>
        public DbSet<Log> Logs => Set<Log>();

        /// <summary>
        /// Email jobs for asynchronous email processing
        /// </summary>
        public DbSet<EmailJob> EmailJobs => Set<EmailJob>();

        // Optional: hier kannst du weitere Entities ergänzen
        // public DbSet<Ticket> Tickets => Set<Ticket>();
        // public DbSet<Category> Categories => Set<Category>();

        protected override void OnModelCreating(ModelBuilder builder)
        {
            base.OnModelCreating(builder);

            // Beispiel: Tabellenpräfix oder Schema anpassen
            // builder.HasDefaultSchema("app");

            // Beispiel: Constraints, Indizes oder benutzerdefinierte Spalten
            // builder.Entity<IdentityUser>().Property(u => u.Email).HasMaxLength(256);
        }
    }
}
