# TagManager release notes

## 17.0.8

### Backoffice (client)

- **Umbraco 17.3+ compatibility**: Package manifest entry point registration now uses **`backofficeEntryPoint`** instead of deprecated **`entryPoint`**.
- Restores backoffice initialization so the **Tag Manager section, tree, and workspaces** register and appear correctly.

---

## 17.0.7

### Backoffice (client)

- **Delete tag navigation** now routes deterministically to the deleted tag's **group workspace** instead of relying on `history.back()`.
- Adds a safe fallback route to the **Tag Manager dashboard** when the group value is unavailable.

---

## 17.0.6

### API / server

- **Delete / sync tag properties**: When rewriting a tag property from the database tag list (fallback path), values are now written with **`IJsonSerializer`** as a JSON array. Comma-separated text was invalid for Umbraco **Tags** / **TagsPicker** storage and could make **all tags disappear** on the node after deleting one tag (thanks [@fredrikstrandin](https://github.com/fredrikstrandin)).
- After updating content, **published** nodes are **republished** so the live site reflects tag removals without a manual publish.
- **Cross-group contamination fix**: Property updates after delete/rename now use the **`propertyTypeId`** from `cmsTagRelationship` to target only the exact property that held the tag. Previously, all tag-editor properties on a node were matched by editor alias, so deleting a tag from one group could write that group's remaining tags into a different group's property — creating duplicates in the wrong group.
- **Save-only-when-changed guard**: `_contentService.Save` / `Publish` and `_mediaService.Save` are now **skipped entirely** when no property was actually modified. This prevents Umbraco's internal tag sync from re-processing unrelated tag properties during save and recreating duplicate `cmsTags` rows in other groups.

### Backoffice (client)

- **Tag group workspace** is now a **routable** workspace (`edit/:unique`) with a small workspace context, so the **sidebar tree selection stays in sync** with the open group and switching groups reliably reloads the grid.
- **Group tag list** clears immediately when changing groups, responses are de-duplicated by request id, and tags are **filtered client-side** to the current group so a wrong or stale API row cannot flash in another group’s view.

---

## 17.0.5

### Backoffice (client)

- **Sidebar tree** lists **tag groups only**. Individual tags are no longer shown in the tree; open tags from the group workspace grid (cards).
- **Tree data source** aligned with the API: tag groups use the **group name** as the stable identifier end-to-end. Children of the hidden tree root match the root group list; **`getChildrenOf` no longer loads tags** under groups.
- **Ancestors** for an open tag workspace use the real **group name** instead of a shared numeric placeholder, so tree highlight and navigation stay consistent.
- **Group workspace** reloads when the route changes to another group even when that group has **zero** tags (fixes empty-group switching).
- **Tree item** manifest registers only `tagmanager-root` and `tagmanager-group` (tags are not tree nodes).

### API / server

- **Delete tag** now **syncs content and media**: loads the tag row and affected document/media IDs from `cmsTagRelationship` **before** deleting relationships and the tag, then updates tag picker / Tags property values using `ITagService` so stored values match the database.
- Fixes the case where **the last tag** on a property left stale text because `ITagService` returned no tags after deletion—properties are still detected when the stored value still contains the removed tag label.


### Integrating sites (project reference)

- If the site references **this project**, do **not** also copy `App_Plugins/TagManager` under the site’s own `wwwroot`. Static web assets from the TagManager project already publish those files; a second copy causes **conflicting static web assets** at the same path.

---

## 17.0.4 and earlier

See [GitHub releases](https://github.com/ZAAKS/Umbraco-Tag-Manager/releases) and commit history for prior versions.
