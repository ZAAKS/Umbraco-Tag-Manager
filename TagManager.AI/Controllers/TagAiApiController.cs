using System.Text.Json;
using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.AI;
using Microsoft.Extensions.Logging;
using Umbraco.AI.Core.Chat;
using Umbraco.Cms.Api.Common.Attributes;
using Umbraco.Cms.Web.Common.Authorization;
using Umbraco.Cms.Web.Common.Routing;

namespace TagManager.AI.Controllers;

/// <summary>
/// Suggests tags through Umbraco.AI. This assembly is only loaded when TagManager.AI is installed.
/// </summary>
[ApiController]
[ApiVersion("1.0")]
[ApiExplorerSettings(GroupName = "TagManager.AI")]
[BackOfficeRoute("TagManager/api/v{version:apiVersion}/TagAi")]
[Authorize(Policy = AuthorizationPolicies.BackOfficeAccess)]
[MapToApi("TagManager.AI")]
public class TagAiApiController : ControllerBase
{
    public const int MaxCount = 20;

    private readonly IAIChatService _chat;
    private readonly ILogger<TagAiApiController> _logger;

    public TagAiApiController(IAIChatService chat, ILogger<TagAiApiController> logger)
    {
        _chat = chat;
        _logger = logger;
    }

    /// <summary>
    /// Asks Umbraco.AI for new tags from the content open in the editor.
    /// </summary>
    [HttpPost("suggest")]
    public async Task<IActionResult> Suggest([FromBody] SuggestTagsRequest? request, CancellationToken cancellationToken)
    {
        if (request == null)
            return BadRequest(new { message = "A tag request is required." });

        if (request.Count is < 1 or > MaxCount)
            return BadRequest(new { message = $"Choose between 1 and {MaxCount} tags." });

        try
        {
            var tags = await SuggestTagsAsync(request, cancellationToken);
            if (tags.Count == 0)
                return StatusCode(502, new { message = "Umbraco.AI did not return any new tags." });

            return Ok(new { tags });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "AI tag suggestion failed");
            return StatusCode(502, new { message = "Tag suggestion failed. Add an Umbraco.AI connection and a default profile, then try again." });
        }
    }

    private async Task<IReadOnlyList<string>> SuggestTagsAsync(SuggestTagsRequest request, CancellationToken cancellationToken)
    {
        var existing = request.ExistingTags?.Where(tag => !string.IsNullOrWhiteSpace(tag)).Select(tag => tag.Trim()).ToArray()
            ?? [];
        var content = request.ContentText?.Trim() ?? string.Empty;
        if (content.Length > 6000)
            content = content[..6000];

        var response = await _chat.GetChatResponseAsync(
            chat => chat.WithAlias("tagmanager-create-tags"),
            [
                new ChatMessage(ChatRole.System, "You suggest short content tags. Reply with a JSON array of strings and nothing else."),
                new ChatMessage(ChatRole.User, $"""
                    Suggest exactly {request.Count} short tags for this content item.
                    Do not repeat existing tags.
                    Name: {request.ContentName}
                    Existing tags: {string.Join(", ", existing)}
                    Content:
                    {content}
                    """)
            ],
            cancellationToken);

        return ParseTags(response.Text, request.Count, existing);
    }

    private static IReadOnlyList<string> ParseTags(string? text, int count, IReadOnlyCollection<string> existing)
    {
        if (string.IsNullOrWhiteSpace(text))
            return [];

        var json = text.Trim();
        var start = json.IndexOf('[');
        var end = json.LastIndexOf(']');
        if (start >= 0 && end > start)
            json = json[start..(end + 1)];

        string[]? parsed;
        try
        {
            parsed = JsonSerializer.Deserialize<string[]>(json);
        }
        catch (JsonException)
        {
            return [];
        }

        var seen = new HashSet<string>(existing, StringComparer.OrdinalIgnoreCase);
        var tags = new List<string>();
        foreach (var tag in parsed ?? [])
        {
            var trimmed = tag?.Trim();
            if (string.IsNullOrWhiteSpace(trimmed) || trimmed.Length > 80 || !seen.Add(trimmed))
                continue;

            tags.Add(trimmed);
            if (tags.Count == count)
                break;
        }

        return tags;
    }
}

/// <summary>Content context from the tag editor.</summary>
public class SuggestTagsRequest
{
    /// <summary>How many new tags to create.</summary>
    public int Count { get; set; }

    /// <summary>Name of the item open in the editor.</summary>
    public string? ContentName { get; set; }

    /// <summary>Plain text from the other properties on the item.</summary>
    public string? ContentText { get; set; }

    /// <summary>Tags already on the property.</summary>
    public string[]? ExistingTags { get; set; }
}
