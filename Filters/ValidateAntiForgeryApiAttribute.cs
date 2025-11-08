using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace sstore.Filters
{
    /// <summary>
    /// Custom antiforgery validation filter for API controllers.
    /// Validates the X-XSRF-TOKEN header against the antiforgery cookie.
    /// </summary>
    public class ValidateAntiForgeryApiAttribute : TypeFilterAttribute
    {
        public ValidateAntiForgeryApiAttribute() : base(typeof(ValidateAntiForgeryApiFilter))
        {
        }
    }

    /// <summary>
    /// Internal filter implementation that performs the actual antiforgery validation.
    /// </summary>
    internal class ValidateAntiForgeryApiFilter : IAsyncActionFilter
    {
        private readonly IAntiforgery _antiforgery;

        public ValidateAntiForgeryApiFilter(IAntiforgery antiforgery)
        {
            _antiforgery = antiforgery;
        }

        public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
        {
            try
            {
                await _antiforgery.ValidateRequestAsync(context.HttpContext);
                await next();
            }
            catch (AntiforgeryValidationException)
            {
                context.Result = new BadRequestObjectResult(new
                {
                    error = "Invalid or missing antiforgery token"
                });
            }
        }
    }
}
