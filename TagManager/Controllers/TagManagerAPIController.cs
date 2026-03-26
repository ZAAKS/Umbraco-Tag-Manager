using System;
using System.Collections.Generic;
using System.Linq;
using Asp.Versioning;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using NPoco;
using Umbraco_Tag_Manager.Models;
using Umbraco.Cms.Core.Models;
using Umbraco.Cms.Core.Scoping;
using Umbraco.Cms.Core.Serialization;
using Umbraco.Cms.Core.Services;
using Lucene.Net.QueryParsers.Flexible.Standard.Processors;

namespace Umbraco_Tag_Manager.Controllers
{
    /// <summary>
    /// API Controller for TagManager operations.
    /// Provides endpoints for reading, creating, updating, and deleting Umbraco tags,
    /// as well as managing tag relationships across content and media nodes.
    /// </summary>
    [ApiVersion("1.0")]
    [ApiExplorerSettings(GroupName = "TagManager")]
    public class TagManagerApiController : TagManagerApiControllerBase
    {
        // -----------------------------------------------------------------------
        // Constants
        // -----------------------------------------------------------------------

        /// <summary>
        /// Stored as a set for O(1) lookup and easy extensibility.
        /// </summary>
        private static readonly HashSet<string> TagEditorAliases = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "Umbraco.Tags",
            "Umbraco.TagsPicker"
        };

        private readonly IScopeProvider _scopeProvider;
        private readonly ILogger<TagManagerApiController> _logger;
        private readonly IMediaService _mediaService;
        private readonly IContentService _contentService;
        private readonly ITagService _tagService;
        private readonly IJsonSerializer _jsonSerializer;

        public TagManagerApiController(
            IScopeProvider scopeProvider,
            ILogger<TagManagerApiController> logger,
            IMediaService mediaService,
            IContentService contentService,
            ITagService tagService,
            IJsonSerializer jsonSerializer)
        {
            _scopeProvider = scopeProvider ?? throw new ArgumentNullException(nameof(scopeProvider));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
            _mediaService = mediaService ?? throw new ArgumentNullException(nameof(mediaService));
            _contentService = contentService ?? throw new ArgumentNullException(nameof(contentService));
            _tagService = tagService ?? throw new ArgumentNullException(nameof(tagService));
            _jsonSerializer = jsonSerializer ?? throw new ArgumentNullException(nameof(jsonSerializer));
        }

        // -----------------------------------------------------------------------
        // Public API Endpoints
        // -----------------------------------------------------------------------

        /// <summary>
        /// Returns a single tag by its database ID, including tagged documents, media,
        /// and all other tags in the same group.
        /// </summary>
        [HttpGet("tag/{tagId:int}")]
        public IActionResult GetTagById(int tagId)
        {
            try
            {
                using var scope = _scopeProvider.CreateScope();

                var tag = FetchTagRow(scope, tagId);
                if (tag == null)
                    return NotFound($"Tag with ID {tagId} was not found.");

                tag.TaggedDocuments = GetTaggedDocumentNodeIds(tagId);
                tag.TaggedMedia = GetTaggedMediaNodeIds(tagId);
                tag.TagsInGroup = GetTagsInGroupForTag(tagId);

                scope.Complete();
                return Ok(tag);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving tag with ID {TagId}", tagId);
                return StatusCode(500, "An error occurred while retrieving the tag.");
            }
        }

        /// <summary>
        /// Returns all distinct tag groups.
        /// </summary>
        [HttpGet("taggroups")]
        public IActionResult GetTagGroups()
        {
            try
            {
                using var scope = _scopeProvider.CreateScope();

                var query = new Sql().Select("[group] FROM cmsTags GROUP BY [group] ORDER BY [group]");
                var tagGroups = scope.Database.Fetch<dynamic>(query);

                scope.Complete();
                return Ok(tagGroups);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving tag groups");
                return StatusCode(500, "An error occurred while retrieving tag groups.");
            }
        }


        /// <summary>
        /// Returns all tags within a named group, including relationship counts.
        /// </summary>
        [HttpGet("tagsingroup/{groupName}")]
        public IActionResult GetTagsInGroup(string groupName)
        {
            if (string.IsNullOrWhiteSpace(groupName))
                return BadRequest("Group name is required.");

            try
            {
                using var scope = _scopeProvider.CreateScope();

                var query = new Sql(
                    "SELECT id, tag, [group], COUNT(tagId) AS noTaggedNodes " +
                    "FROM cmsTags " +
                    "LEFT JOIN cmsTagRelationship ON cmsTags.id = cmsTagRelationship.tagId " +
                    "WHERE [group] = @0 " +
                    "GROUP BY tag, id, [group] " +
                    "ORDER BY tag",
                    groupName);

                var tags = scope.Database.Fetch<dynamic>(query);

                scope.Complete();
                return Ok(tags);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving tags for group '{GroupName}'", groupName);
                return StatusCode(500, "An error occurred while retrieving tags.");
            }
        }
        /// <summary>
        /// Creates a new tag or updates an existing one.
        /// When merging into another tag (<see cref="CmsTags.TagsInGroup"/>), tag relationships
        /// are re-pointed and the original is cleaned up.
        /// </summary>
        [HttpPost("save")]
        public IActionResult Save([FromBody] CmsTags tag)
        {
            if (tag == null)
                return BadRequest("Tag payload is required.");

            try
            {
                using var scope = _scopeProvider.CreateScope();

                var rowsAffected = tag.Id == 0
                    ? CreateTag(scope, tag)
                    : UpdateTag(scope, tag);

                scope.Complete();
                return Ok(rowsAffected);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving tag '{TagName}' (ID: {TagId})", tag.Tag, tag.Id);
                return BadRequest($"Error saving tag: {ex.Message}");
            }
        }

        /// <summary>
        /// Deletes a tag and its relationships, then removes the tag value from all
        /// associated content and media properties.
        /// </summary>
        [HttpPost("delete")]
        public IActionResult DeleteTag([FromBody] CmsTags tag)
        {
            if (tag == null || tag.Id <= 0)
                return BadRequest("A valid tag ID is required.");

            try
            {
                CmsTags? tagRow;
                using (var scope = _scopeProvider.CreateScope())
                {
                    tagRow = FetchTagRow(scope, tag.Id);
                    scope.Complete();
                }

                if (tagRow == null)
                {
                    _logger.LogWarning("No tag found for ID {TagId} — cannot delete.", tag.Id);
                    return NotFound($"Tag with ID {tag.Id} was not found.");
                }

                tag.Tag = tagRow.Tag;
                tag.Group = tagRow.Group;
                tag.PropertyTypeId = tagRow.PropertyTypeId;

                tag.TaggedDocuments = GetTaggedDocumentNodeIds(tag.Id);
                tag.TaggedMedia = GetTaggedMediaNodeIds(tag.Id);

                var removedTagLabel = tag.Tag ?? string.Empty;

                using (var scope = _scopeProvider.CreateScope())
                {
                    var relationshipsDeleted = scope.Database.Execute(
                        "DELETE FROM cmsTagRelationship WHERE tagId = @0", tag.Id);

                    _logger.LogInformation(
                        "Deleted {Count} tag relationship(s) for tag ID {TagId}",
                        relationshipsDeleted, tag.Id);

                    scope.Complete();
                }

                int rowsDeleted;
                using (var scope = _scopeProvider.CreateScope())
                {
                    rowsDeleted = scope.Database.Execute(
                        "DELETE FROM cmsTags WHERE id = @0", tag.Id);

                    scope.Complete();
                }

                if (rowsDeleted == 0)
                {
                    _logger.LogWarning("No tag deleted for ID {TagId} — it may not exist.", tag.Id);
                    return NotFound($"Tag with ID {tag.Id} was not found.");
                }

                // After relationships are removed, ITagService no longer lists this tag — refresh stored property values.
                UpdateContentProperties(tag, oldTagName: string.Empty, removedTagTextForCleanup: removedTagLabel);
                UpdateMediaProperties(tag, oldTagName: string.Empty, removedTagTextForCleanup: removedTagLabel);

                _logger.LogInformation("Successfully deleted tag ID {TagId} ({TagName})", tag.Id, removedTagLabel);
                return Ok(rowsDeleted);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting tag ID {TagId}", tag.Id);
                return BadRequest($"Error deleting tag: {ex.Message}");
            }
        }

        // -----------------------------------------------------------------------
        // Internal Query Helpers
        // -----------------------------------------------------------------------

        private CmsTags FetchTagRow(IScope scope, int tagId)
        {
            var query = new Sql().Select(
                "id, tag, [group], propertytypeid, " +
                "COUNT(tagId) AS noTaggedNodes " +
                "FROM cmsTags " +
                "LEFT JOIN cmsTagRelationship ON cmsTags.id = cmsTagRelationship.tagId " +
                $"WHERE cmsTags.Id = {tagId} " +
                "GROUP BY tag, id, [group], propertytypeid");

            return scope.Database.Fetch<CmsTags>(query).FirstOrDefault();
        }

        /// <summary>
        /// Returns a <see cref="TagInGroup"/> representing all tags in the same group
        /// as the given tag ID, with the matching tag pre-selected.
        /// </summary>
        private TagInGroup GetTagsInGroupForTag(int tagId)
        {
            var result = new TagInGroup();

            try
            {
                using var scope = _scopeProvider.CreateScope();

                var groupName = scope.Database.Single<string>(
                    new Sql().Select($"[group] FROM cmsTags WHERE id = {tagId}"));

                var rows = scope.Database.Fetch<dynamic>(
                    new Sql().Select($"id, tag FROM cmsTags WHERE [group] = '{groupName}' ORDER BY tag"));

                var options = new List<PlainPair>();
                foreach (var row in rows)
                {
                    var pair = new PlainPair { Id = Convert.ToInt32(row.Id), Tag = row.Tag };
                    options.Add(pair);
                    if (row.Id == tagId)
                        result.SelectedItem = pair;
                }

                result.Options = options;
                scope.Complete();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error building tag-in-group list for tag ID {TagId}", tagId);
            }

            return result;
        }

        private List<TaggedDocument> GetTaggedDocumentNodeIds(int tagId)
        {
            var documents = new List<TaggedDocument>();

            try
            {
                using var scope = _scopeProvider.CreateScope();

                var rows = scope.Database.Fetch<dynamic>(
                    new Sql().Select("nodeId, propertyTypeId").From("cmsTagRelationship")
                             .Where($"tagID = {tagId}"));

                var grouped = new Dictionary<int, List<int>>();
                foreach (var row in rows)
                {
                    int nodeId = (int)row.nodeId;
                    int ptId = (int)row.propertyTypeId;
                    if (!grouped.ContainsKey(nodeId))
                        grouped[nodeId] = new List<int>();
                    if (!grouped[nodeId].Contains(ptId))
                        grouped[nodeId].Add(ptId);
                }

                foreach (var kv in grouped)
                {
                    var content = _contentService.GetById(kv.Key);
                    if (content == null || string.IsNullOrWhiteSpace(content.Name))
                        continue;

                    documents.Add(new TaggedDocument
                    {
                        DocumentId = kv.Key,
                        DocumentName = content.Name,
                        DocumentUrl = $"/umbraco/section/content/workspace/document/edit/{content.Key}",
                        RelationshipPropertyTypeIds = kv.Value,
                    });
                }

                scope.Complete();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving tagged documents for tag ID {TagId}", tagId);
            }

            return documents;
        }

        private List<TaggedMedia> GetTaggedMediaNodeIds(int tagId)
        {
            var mediaItems = new List<TaggedMedia>();

            try
            {
                using var scope = _scopeProvider.CreateScope();

                var rows = scope.Database.Fetch<dynamic>(
                    new Sql().Select("nodeId, propertyTypeId").From("cmsTagRelationship")
                             .Where($"tagID = {tagId}"));

                var grouped = new Dictionary<int, List<int>>();
                foreach (var row in rows)
                {
                    int nodeId = (int)row.nodeId;
                    int ptId = (int)row.propertyTypeId;
                    if (!grouped.ContainsKey(nodeId))
                        grouped[nodeId] = new List<int>();
                    if (!grouped[nodeId].Contains(ptId))
                        grouped[nodeId].Add(ptId);
                }

                foreach (var kv in grouped)
                {
                    var media = _mediaService.GetById(kv.Key);
                    if (media == null || string.IsNullOrWhiteSpace(media.Name))
                        continue;

                    mediaItems.Add(new TaggedMedia
                    {
                        DocumentId = kv.Key,
                        DocumentName = media.Name,
                        DocumentUrl = $"/umbraco/section/media/workspace/media/edit/{media.Key}",
                        RelationshipPropertyTypeIds = kv.Value,
                    });
                }

                scope.Complete();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving tagged media for tag ID {TagId}", tagId);
            }

            return mediaItems;
        }

        // -----------------------------------------------------------------------
        // Save Helpers
        // -----------------------------------------------------------------------

        /// <summary>
        /// Inserts a new tag. Returns 0 if the tag already exists, otherwise 1.
        /// Populates <paramref name="tag"/>.Id with the newly created record's ID.
        /// </summary>
        private int CreateTag(IScope scope, CmsTags tag)
        {
            var existing = scope.Database.FirstOrDefault<CmsTags>(
                "SELECT * FROM cmsTags WHERE tag = @0 AND [group] = @1", tag.Tag, tag.Group);

            if (existing != null)
            {
                _logger.LogWarning(
                    "Tag '{TagName}' already exists in group '{Group}' — skipping insert",
                    tag.Tag, tag.Group);
                return 0;
            }

            var rows = scope.Database.Execute(
                "INSERT INTO cmsTags (tag, [group]) VALUES (@0, @1)", tag.Tag, tag.Group);

            if (rows > 0)
            {
                var created = scope.Database.FirstOrDefault<CmsTags>(
                    "SELECT * FROM cmsTags WHERE tag = @0 AND [group] = @1", tag.Tag, tag.Group);

                if (created != null)
                {
                    tag.Id = created.Id;
                    _logger.LogInformation(
                        "Created tag ID {TagId} — '{TagName}' in group '{Group}'",
                        tag.Id, tag.Tag, tag.Group);
                }
            }

            return rows;
        }

        /// <summary>
        /// Updates an existing tag's name, optionally merging it into another tag.
        /// Then synchronises property values on all related content and media nodes.
        /// </summary>
        private int UpdateTag(IScope scope, CmsTags tag)
        {
            try
            {
                var oldTag = scope.Database.FirstOrDefault<CmsTags>(
                    "SELECT * FROM cmsTags WHERE id = @0", tag.Id);

                var oldTagName = oldTag?.Tag ?? string.Empty;

                var rows = scope.Database.Execute(
                    "UPDATE cmsTags SET tag = @0 WHERE id = @1", tag.Tag, tag.Id);

                bool isMerging = rows == 1
                    && tag.TagsInGroup?.SelectedItem != null
                    && tag.Id != tag.TagsInGroup.SelectedItem.Id;

                tag.TaggedDocuments = GetTaggedDocumentNodeIds(tag.Id);
                tag.TaggedMedia = GetTaggedMediaNodeIds(tag.Id);

                if (isMerging)
                {
                    var targetId = tag.TagsInGroup.SelectedItem.Id;

                    scope.Database.Execute(
                        "UPDATE cmsTagRelationship " +
                        "SET tagID = @0 " +
                        "WHERE tagID = @1 " +
                        "AND nodeId NOT IN (SELECT nodeId FROM cmsTagRelationship WHERE tagId = @0)",
                        targetId, tag.Id);

                    scope.Database.Execute(
                        "DELETE FROM cmsTagRelationship WHERE tagId = @0", tag.Id);

                    scope.Database.Execute(
                        "DELETE FROM cmsTags WHERE id = @0", tag.Id);

                    _logger.LogInformation(
                        "Merged tag ID {SourceId} into tag ID {TargetId}", tag.Id, targetId);
                }

                UpdateContentProperties(tag, oldTagName);
                UpdateMediaProperties(tag, oldTagName);

                return rows;
            }
            catch (Exception ex)
            {
                _logger.LogCritical("{error", ex.Message);
                throw;
            }
        }

        // -----------------------------------------------------------------------
        // Property Update Helpers
        // -----------------------------------------------------------------------

        /// <summary>
        /// Iterates all tagged content nodes and updates the tag property value
        /// to reflect the renamed or removed tag.
        /// </summary>
        private void UpdateContentProperties(
            CmsTags tag,
            string oldTagName = "",
            string? removedTagTextForCleanup = null)
        {
            if (tag.TaggedDocuments == null || tag.TaggedDocuments.Count == 0)
                return;

            foreach (var doc in tag.TaggedDocuments)
            {
                try
                {
                    var content = _contentService.GetById(doc.DocumentId);
                    if (content == null) continue;

                    var currentTags = GetCurrentTagTexts(doc.DocumentId, tag.Group);
                    bool changed = ApplyTagUpdatesToProperties(
                        content.Properties,
                        tag,
                        oldTagName,
                        currentTags,
                        removedTagTextForCleanup,
                        doc.RelationshipPropertyTypeIds);

                    if (!changed) continue;

                    var saveResult = _contentService.Save(content);
                    if (saveResult.Success && content.Published)
                    {
                        _contentService.Publish(content, []);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex,
                        "Error updating content node {DocumentId} for tag {TagId}",
                        doc.DocumentId, tag.Id);
                }
            }
        }

        /// <summary>
        /// Iterates all tagged media nodes and updates the tag property value
        /// to reflect the renamed or removed tag.
        /// </summary>
        private void UpdateMediaProperties(
            CmsTags tag,
            string oldTagName = "",
            string? removedTagTextForCleanup = null)
        {
            if (tag.TaggedMedia == null || tag.TaggedMedia.Count == 0)
                return;

            foreach (var med in tag.TaggedMedia)
            {
                try
                {
                    var media = _mediaService.GetById(med.DocumentId);
                    if (media == null) continue;

                    var currentTags = GetCurrentTagTexts(med.DocumentId, tag.Group);
                    bool changed = ApplyTagUpdatesToProperties(
                        media.Properties,
                        tag,
                        oldTagName,
                        currentTags,
                        removedTagTextForCleanup,
                        med.RelationshipPropertyTypeIds);

                    if (!changed) continue;

                    var saveAttempt = _mediaService.Save(media);
                    if (!saveAttempt.Success || saveAttempt.Result is not { Success: true })
                    {
                        _logger.LogWarning(
                            "Tag sync save failed for media {MediaId} (tag {TagId}). Attempt.Success={AttemptOk}, Result.Success={ResultOk}",
                            med.DocumentId,
                            tag.Id,
                            saveAttempt.Success,
                            saveAttempt.Result?.Success);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex,
                        "Error updating media node {DocumentId} for tag {TagId}",
                        med.DocumentId, tag.Id);
                }
            }
        }

        /// <summary>
        /// Returns the current tag texts for a given entity and group.
        /// Fetched once per entity and shared across all property iterations.
        /// </summary>
        private List<string> GetCurrentTagTexts(int entityId, string group)
        {
            return _tagService
                .GetTagsForEntity(entityId, group)
                ?.Select(t => t.Text)
                .ToList()
                ?? new List<string>();
        }

        /// <summary>
        /// Iterates an entity's properties and updates any tag picker properties
        /// that belong to the tag being modified.
        /// </summary>
        /// <param name="relationshipPropertyTypeIds">
        /// Property-type IDs from cmsTagRelationship for this entity + tag.
        /// When non-empty, only properties whose PropertyType.Id is in this set are touched,
        /// preventing writes to tag properties that belong to a different group.
        /// </param>
        /// <returns>True if at least one property was modified.</returns>
        private bool ApplyTagUpdatesToProperties(
            IEnumerable<IProperty> properties,
            CmsTags tag,
            string oldTagName,
            List<string> currentTags,
            string? removedTagTextForCleanup = null,
            List<int>? relationshipPropertyTypeIds = null)
        {
            bool modified = false;
            foreach (var property in properties)
            {
                if (!IsTagProperty(property, tag, currentTags, removedTagTextForCleanup, relationshipPropertyTypeIds))
                    continue;
                SetUpdatedTagValue(property, currentTags);
                modified = true;
            }
            return modified;
        }


        /// <summary>
        /// Determines whether a property should be updated.
        ///
        /// A property qualifies if:
        ///   1. The relationship carried a propertyTypeId list and this property is in it (most precise), OR
        ///   2. Its PropertyType.Id matches the tag row's PropertyTypeId, OR
        ///   3. (Fallback only when no relationship IDs are available) its editor alias is a known tag editor
        ///      AND the entity has tags in the relevant group.
        /// </summary>
        private static bool IsTagProperty(
            IProperty property,
            CmsTags tag,
            List<string> currentTags,
            string? removedTagTextForCleanup = null,
            List<int>? relationshipPropertyTypeIds = null)
        {
            var propertyType = property.PropertyType;
            if (propertyType == null)
                return false;

            if (relationshipPropertyTypeIds != null && relationshipPropertyTypeIds.Count > 0)
                return relationshipPropertyTypeIds.Contains(propertyType.Id);

            if (tag.PropertyTypeId > 0 && propertyType.Id == tag.PropertyTypeId)
                return true;

            var editorAlias = propertyType.PropertyEditorAlias;
            if (string.IsNullOrEmpty(editorAlias) || !TagEditorAliases.Contains(editorAlias))
                return false;

            if (currentTags.Count > 0)
                return true;

            if (!string.IsNullOrEmpty(removedTagTextForCleanup))
            {
                var raw = property.GetValue()?.ToString() ?? string.Empty;
                if (raw.Contains(removedTagTextForCleanup, StringComparison.OrdinalIgnoreCase))
                    return true;
            }

            return false;
        }

        /// <summary>
        /// Sets the updated value on a tag property.
        ///
        /// Strategy:
        ///   - If the old name is known and present in the stored string, do a targeted replace
        ///     (preserves ordering and avoids a full rewrite).
        ///   - Otherwise fall back to writing the full current tag list from the database,
        ///     which is the authoritative source of truth.
        /// </summary>
        private void SetUpdatedTagValue(
            IProperty property,
            List<string> currentTags)
        {
                // Tags / TagsPicker store JSON arrays; CSV corrupts the value and clears tags in the UI.
                property.SetValue(
                    currentTags.Count > 0 ? _jsonSerializer.Serialize(currentTags) : string.Empty);
         }
    }
}