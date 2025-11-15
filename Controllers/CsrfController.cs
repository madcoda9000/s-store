using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Mvc;
using System.Diagnostics.CodeAnalysis;

namespace sstore.Controllers
{
    /// <summary>
    /// Controller for retrieving CSRF tokens for client-side usage.
    /// </summary>
    [ApiController]
    [Route("api")]
    public class CsrfController : ControllerBase
    {
        private readonly IAntiforgery _antiforgery;

        /// <summary>
        /// Constructor for the CsrfController.
        /// </summary>
        /// <param name="antiforgery">Antiforgery service for generating CSRF tokens.</param>
        [SuppressMessage("Style", "IDE0290:Use primary constructor", Justification = "Explicit constructor improves readability for dependency injection.")]
        public CsrfController(IAntiforgery antiforgery)
        {
            _antiforgery = antiforgery;
        }

        /// <summary>
        /// Gets the CSRF request token for the current session.
        /// This token must be included in the X-XSRF-TOKEN header for all state-changing requests.
        /// </summary>
        /// <returns>The CSRF request token</returns>
        [HttpGet("csrf-token")]
        public IActionResult GetCsrfToken()
        {
            var tokens = _antiforgery.GetAndStoreTokens(HttpContext);
            return Ok(new { token = tokens.RequestToken });
        }
    }
}
