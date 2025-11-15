using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace sstore.Controllers
{
    [ApiController]
    [Route("api/config")]
    public class ConfigController : ControllerBase
    {
        /// <summary>
        /// Gets application configuration that can be exposed to the frontend
        /// </summary>
        [HttpGet]
        [AllowAnonymous]
        public IActionResult GetConfig()
        {
            return Ok(new
            {
                requestLogging = new
                {
                    enabled = Environment.GetEnvironmentVariable("REQUEST_LOGGING_ENABLED")?.ToLower() == "true"
                }
                // Add other config values here as needed
            });
        }
    }
}