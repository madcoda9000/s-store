using System.Security.Cryptography;

namespace sstore.Helpers
{
    /// <summary>
    /// Helper methods to prevent email enumeration attacks
    /// </summary>
    public static class EmailEnumerationHelpers
    {
        /// <summary>
        /// Executes an action with a guaranteed minimum duration to prevent timing attacks.
        /// This ensures that both success and failure paths take approximately the same time.
        /// </summary>
        /// <param name="action">The async action to execute</param>
        /// <param name="minDurationMs">Minimum duration in milliseconds (default: 300ms)</param>
        /// <param name="maxDurationMs">Maximum additional random duration in milliseconds (default: 200ms)</param>
        /// <returns>Task representing the operation</returns>
        public static async Task ExecuteWithConstantTimeAsync(
            Func<Task> action, 
            int minDurationMs = 300, 
            int maxDurationMs = 200)
        {
            var startTime = DateTime.UtcNow;
            
            try
            {
                await action();
            }
            finally
            {
                // Calculate elapsed time
                var elapsed = DateTime.UtcNow - startTime;
                
                // Add cryptographically secure random delay
                var randomDelay = GetSecureRandomDelay(0, maxDurationMs);
                var targetDuration = TimeSpan.FromMilliseconds(minDurationMs + randomDelay);
                
                // Wait for remaining time if operation was faster than minimum
                if (elapsed < targetDuration)
                {
                    await Task.Delay(targetDuration - elapsed);
                }
            }
        }

        /// <summary>
        /// Gets a cryptographically secure random delay between min and max milliseconds.
        /// Uses RandomNumberGenerator instead of Random.Shared for security.
        /// </summary>
        /// <param name="minMs">Minimum delay in milliseconds</param>
        /// <param name="maxMs">Maximum delay in milliseconds</param>
        /// <returns>Random delay in milliseconds</returns>
        public static int GetSecureRandomDelay(int minMs, int maxMs)
        {
            if (minMs >= maxMs)
                return minMs;

            var buffer = new byte[4];
            using var rng = RandomNumberGenerator.Create();
            rng.GetBytes(buffer);
            
            var random = BitConverter.ToUInt32(buffer, 0);
            var range = maxMs - minMs;
            var delay = minMs + (int)(random % range);
            
            return delay;
        }
    }
}