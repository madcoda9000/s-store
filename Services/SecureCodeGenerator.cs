using System.Security.Cryptography;

namespace sstore.Services;

/// <summary>
/// Implementation of cryptographically secure code generation
/// </summary>
public class SecureCodeGenerator : ISecureCodeGenerator
{
    private const string AlphanumericChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

    /// <inheritdoc/>
    public string GenerateNumericCode(int length = 6)
    {
        if (length < 4 || length > 10)
            throw new ArgumentException("Code length must be between 4 and 10 digits", nameof(length));

        var buffer = new byte[4];
        using var rng = RandomNumberGenerator.Create();
        rng.GetBytes(buffer);

        var random = BitConverter.ToUInt32(buffer, 0);
        var min = (int)Math.Pow(10, length - 1);
        var max = (int)Math.Pow(10, length) - 1;

        // Map random number to range [min, max]
        var code = (int)(min + (random % (max - min + 1)));

        return code.ToString($"D{length}");
    }

    /// <inheritdoc/>
    public string GenerateAlphanumericCode(int length = 32)
    {
        if (length < 8 || length > 128)
            throw new ArgumentException("Code length must be between 8 and 128 characters", nameof(length));

        using var rng = RandomNumberGenerator.Create();
        var bytes = new byte[length];
        rng.GetBytes(bytes);

        var result = new char[length];
        for (int i = 0; i < length; i++)
        {
            result[i] = AlphanumericChars[bytes[i] % AlphanumericChars.Length];
        }

        return new string(result);
    }
}