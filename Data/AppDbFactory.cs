using DotNetEnv;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using sstore.Data;

namespace sstore.Data
{
    public class AppDbFactory : IDesignTimeDbContextFactory<AppDb>
    {
        public AppDb CreateDbContext(string[] args)
        {
            Env.Load(); // .env laden

            var optionsBuilder = new DbContextOptionsBuilder<AppDb>();
            var connectionString = Environment.GetEnvironmentVariable("CONNECTION_STRING")!;

            optionsBuilder.UseMySql(connectionString,
                ServerVersion.AutoDetect(connectionString));

            return new AppDb(optionsBuilder.Options);
        }
    }
}