using System.Threading.RateLimiting;
using Bever.AspNetCore;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.DataProtection;

var builder = WebApplication.CreateBuilder(args);

// Sign-in cookies are encrypted with these keys; keeping them on disk keeps people signed in across restarts.
builder.Services.AddDataProtection()
    .PersistKeysToFileSystem(new DirectoryInfo(Path.Combine(builder.Environment.ContentRootPath, "..", ".bever", "keys")))
    .SetApplicationName("__PROJECT_DOTNET_NAME__");

// At most 10 sign-in or registration attempts per minute from one address.
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
        HttpMethods.IsPost(context.Request.Method) && context.Request.Path.StartsWithSegments("/api/v1/_identity")
            ? RateLimitPartition.GetFixedWindowLimiter(context.Connection.RemoteIpAddress?.ToString() ?? "unknown", _ => new FixedWindowRateLimiterOptions { PermitLimit = 10, Window = TimeSpan.FromMinutes(1) })
            : RateLimitPartition.GetNoLimiter("unlimited"));
});

builder.Services.AddProblemDetails();

// Reads bev/.output/model.json and stores data in .bever/bever.db. Override with the "Bever" configuration
// section, for example Bever__DatabasePath=/data/app.db.
builder.Services.AddBever();

var app = builder.Build();

app.UseExceptionHandler();
app.UseRateLimiter();
app.UseDefaultFiles();
app.UseStaticFiles();
app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/api/v1/_antiforgery/token", (IAntiforgery antiforgery, HttpContext context) =>
    Results.Ok(new { token = antiforgery.GetAndStoreTokens(context).RequestToken }));
app.MapBeverApi();

// Unknown API routes are 404s; every other path is a client route served by the built app in wwwroot.
app.MapFallback("/api/{**path}", () => Results.NotFound());
app.MapFallbackToFile("index.html");

app.Run();
