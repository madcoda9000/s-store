using System.Security.Cryptography;
using System.Text;

namespace sstore.Services
{
    /// <summary>
    /// Service for data pseudonymization in logs
    /// </summary>
    public interface IDataProtectionService
    {
        /// <summary>
        /// Creates a pseudonymized identifier from an email
        /// </summary>
        string PseudonymizeEmail(string email);
        
        /// <summary>
        /// Masks sensitive data for logging (shows first 2 and last 2 chars)
        /// </summary>
        string MaskSensitiveData(string data);
    }
}