using System.Security.Cryptography;
using System.Text;

namespace sstore.Services
{
    /// <summary>
    /// Implementation of data protection with both pseudonymization and encryption
    /// </summary>
    public class DataProtectionService : IDataProtectionService
    {
        private readonly string _hashSecret;
        private readonly byte[] _encryptionKey;

        public DataProtectionService(IConfiguration configuration)
        {
            // Get hash secret for pseudonymization
            _hashSecret = Environment.GetEnvironmentVariable("LOG_HASH_SECRET") 
                ?? throw new InvalidOperationException("LOG_HASH_SECRET environment variable is required");

            // Derive encryption key from hash secret (32 bytes for AES-256)
            // In production, consider using a separate AUDIT_ENCRYPTION_KEY
            using var sha256 = SHA256.Create();
            _encryptionKey = sha256.ComputeHash(Encoding.UTF8.GetBytes(_hashSecret));
        }

        /// <inheritdoc/>
        public string PseudonymizeEmail(string email)
        {
            if (string.IsNullOrEmpty(email))
                return "anonymous";

            // Special case: already pseudonymized or system user
            if (email.StartsWith("user_") || email == "anonymous" || email == "system")
                return email;

            // Create consistent hash of ENTIRE email (including domain) with secret
            // This provides better privacy - no domain information leaked
            using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(_hashSecret));
            var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(email.ToLowerInvariant()));
            var pseudonym = Convert.ToBase64String(hash).Substring(0, 16);
            
            // Return pseudonymized identifier without any domain information
            return $"user_{pseudonym}";
        }

        /// <inheritdoc/>
        public string MaskSensitiveData(string data)
        {
            if (string.IsNullOrEmpty(data) || data.Length <= 4)
                return "****";

            return $"{data.Substring(0, 2)}***{data.Substring(data.Length - 2)}";
        }

        /// <inheritdoc/>
        public string EncryptUserInfo(string userInfo)
        {
            if (string.IsNullOrEmpty(userInfo))
                return string.Empty;

            try
            {
                using var aes = Aes.Create();
                aes.Key = _encryptionKey;
                aes.GenerateIV();

                using var encryptor = aes.CreateEncryptor(aes.Key, aes.IV);
                using var msEncrypt = new MemoryStream();
                
                // Write IV first (needed for decryption)
                msEncrypt.Write(aes.IV, 0, aes.IV.Length);
                
                using (var csEncrypt = new CryptoStream(msEncrypt, encryptor, CryptoStreamMode.Write))
                using (var swEncrypt = new StreamWriter(csEncrypt))
                {
                    swEncrypt.Write(userInfo);
                }
                
                return Convert.ToBase64String(msEncrypt.ToArray());
            }
            catch (Exception ex)
            {
                // Log encryption failure but don't expose details
                Console.Error.WriteLine($"Encryption failed: {ex.Message}");
                return string.Empty;
            }
        }

        /// <inheritdoc/>
        public string DecryptUserInfo(string encryptedInfo)
        {
            if (string.IsNullOrEmpty(encryptedInfo))
                return string.Empty;

            try
            {
                var cipherBytes = Convert.FromBase64String(encryptedInfo);

                using var aes = Aes.Create();
                aes.Key = _encryptionKey;

                // Extract IV from beginning of cipher text
                var iv = new byte[aes.IV.Length];
                Array.Copy(cipherBytes, 0, iv, 0, iv.Length);
                aes.IV = iv;

                using var decryptor = aes.CreateDecryptor(aes.Key, aes.IV);
                using var msDecrypt = new MemoryStream(cipherBytes, iv.Length, cipherBytes.Length - iv.Length);
                using var csDecrypt = new CryptoStream(msDecrypt, decryptor, CryptoStreamMode.Read);
                using var srDecrypt = new StreamReader(csDecrypt);
                
                return srDecrypt.ReadToEnd();
            }
            catch (Exception ex)
            {
                // Log decryption failure
                Console.Error.WriteLine($"Decryption failed: {ex.Message}");
                return "[DECRYPTION_FAILED]";
            }
        }
    }
}