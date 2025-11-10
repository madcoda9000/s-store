using System.Security.Cryptography;
using System.Text;

namespace sstore.Services
{
    /// <summary>
    /// Implementation of data protection for logging
    /// </summary>
    public class DataProtectionService : IDataProtectionService
    {
        private readonly string _hashSecret;

        public DataProtectionService(IConfiguration configuration)
        {
            // Get a secret from configuration for consistent hashing
            _hashSecret = Environment.GetEnvironmentVariable("LOG_HASH_SECRET") 
                ?? throw new InvalidOperationException("LOG_HASH_SECRET environment variable is required");
        }

        /// <inheritdoc/>
        public string PseudonymizeEmail(string email)
        {
            if (string.IsNullOrEmpty(email))
                return "anonymous";

            // Create consistent hash of email with secret
            using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(_hashSecret));
            var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(email.ToLowerInvariant()));
            var pseudonym = Convert.ToBase64String(hash).Substring(0, 16);
            
            // Keep domain visible for debugging but hide local part
            var atIndex = email.IndexOf('@');
            if (atIndex > 0)
            {
                var domain = email.Substring(atIndex);
                return $"user_{pseudonym}{domain}";
            }
            
            return $"user_{pseudonym}";
        }

        /// <inheritdoc/>
        public string MaskSensitiveData(string data)
        {
            if (string.IsNullOrEmpty(data) || data.Length <= 4)
                return "****";

            return $"{data.Substring(0, 2)}***{data.Substring(data.Length - 2)}";
        }
    }
}