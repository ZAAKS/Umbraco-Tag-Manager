var p = Object.defineProperty;
var _ = (o, t, e) => t in o ? p(o, t, { enumerable: !0, configurable: !0, writable: !0, value: e }) : o[t] = e;
var u = (o, t, e) => _(o, typeof t != "symbol" ? t + "" : t, e);
import { LitElement as v, html as l, css as f, state as h, customElement as b } from "@umbraco-cms/backoffice/external/lit";
import { UmbElementMixin as y } from "@umbraco-cms/backoffice/element-api";
import { UMB_NOTIFICATION_CONTEXT as g } from "@umbraco-cms/backoffice/notification";
import { UMB_MODAL_MANAGER_CONTEXT as x, UMB_CONFIRM_MODAL as I } from "@umbraco-cms/backoffice/modal";
import { T } from "./tagmanager-repository-BvW2JE0F.js";
var m = Object.defineProperty, w = Object.getOwnPropertyDescriptor, N = (o, t, e) => t in o ? m(o, t, { enumerable: !0, configurable: !0, writable: !0, value: e }) : o[t] = e, c = (o, t, e, i) => {
  for (var s = i > 1 ? void 0 : i ? w(t, e) : t, a = o.length - 1, n; a >= 0; a--)
    (n = o[a]) && (s = (i ? n(t, e, s) : n(s)) || s);
  return i && s && m(t, e, s), s;
}, $ = (o, t, e) => N(o, t + "", e);
let d = class extends y(v) {
  constructor() {
    super();
    u(this, "_repository");
    u(this, "_locationPoller", null);
    u(this, "_lastPathname", "");
    u(this, "_loadRequestId", 0);
    u(this, "_tag", null);
    u(this, "_loading", !0);
    u(this, "_saving", !1);
    u(this, "_tagId");
    this._repository = new T(this);
  }
  async connectedCallback() {
    super.connectedCallback(), this._lastPathname = window.location.pathname, await this._syncFromLocation(this._lastPathname), this._locationPoller = window.setInterval(() => {
      const t = window.location.pathname;
      t !== this._lastPathname && (this._lastPathname = t, this._syncFromLocation(t));
    }, 200);
  }
  disconnectedCallback() {
    this._locationPoller !== null && (window.clearInterval(this._locationPoller), this._locationPoller = null), super.disconnectedCallback();
  }
  _getTagIdFromPath(t) {
    const e = t.match(/\/tagmanager-tag\/edit\/(\d+)/);
    return e && e[1] ? parseInt(e[1]) : null;
  }
  async _syncFromLocation(t) {
    const e = this._getTagIdFromPath(t);
    if (!e) {
      this._tagId = void 0, this._tag = null, this._loading = !1, this.requestUpdate();
      return;
    }
    e === this._tagId && this._tag || (this._tagId = e, await this._loadTag());
  }
  async _loadTag() {
    if (!this._tagId) return;
    const t = ++this._loadRequestId;
    this._loading = !0, this.requestUpdate();
    const e = await this._repository.getTagById(this._tagId);
    if (t === this._loadRequestId) {
      if (e) {
        const i = e.tagsInGroup || e.TagsInGroup, s = {
          selectedItem: (i == null ? void 0 : i.selectedItem) || (i == null ? void 0 : i.SelectedItem) || { id: 0, tag: "", Id: 0, Tag: "" },
          options: ((i == null ? void 0 : i.options) || (i == null ? void 0 : i.Options) || []).map((a) => ({
            id: a.id || a.Id || 0,
            tag: a.tag || a.Tag || ""
          }))
        };
        this._tag = {
          id: e.id || e.Id || 0,
          tag: e.tag || e.Tag || "",
          group: e.group || e.Group || "",
          noTaggedNodes: e.noTaggedNodes || e.NoTaggedNodes || 0,
          taggedDocuments: (e.taggedDocuments || e.TaggedDocuments || []).map((a) => ({
            documentId: a.documentId || a.DocumentId || 0,
            documentName: a.documentName || a.DocumentName || "",
            documentUrl: a.documentUrl || a.DocumentUrl || ""
          })),
          taggedMedia: (e.taggedMedia || e.TaggedMedia || []).map((a) => ({
            documentId: a.documentId || a.DocumentId || 0,
            documentName: a.documentName || a.DocumentName || "",
            documentUrl: a.documentUrl || a.DocumentUrl || ""
          })),
          tagsInGroup: s
        };
      } else
        this._tag = null;
      t === this._loadRequestId && (this._loading = !1, this.requestUpdate());
    }
  }
  async _save() {
    if (!this._tag) return;
    this._saving = !0;
    const t = await this._repository.save(this._tag);
    this._saving = !1;
    const e = await this.getContext(g);
    t ? e == null || e.peek("positive", {
      data: {
        headline: "Tag Saved",
        message: `"${this._tag.tag}" has been saved successfully`
      }
    }) : e == null || e.peek("danger", {
      data: {
        headline: "Save Failed",
        message: "Failed to save the tag. Please try again."
      }
    });
  }
  async _delete() {
    if (this._tag)
      try {
        const t = await this.getContext(x);
        if (!t) {
          const r = await this.getContext(g);
          r == null || r.peek("danger", {
            data: {
              headline: "Error",
              message: "Unable to open confirmation dialog. Please try again."
            }
          });
          return;
        }
        const e = t.open(this, I, {
          data: {
            headline: "Delete Tag",
            content: `Are you sure you want to delete the tag "${this._tag.tag}"?`,
            color: "danger",
            confirmLabel: "Delete"
          }
        });
        if (!e) {
          const r = await this.getContext(g);
          r == null || r.peek("danger", {
            data: {
              headline: "Error",
              message: "Unable to open confirmation dialog. Please try again."
            }
          });
          return;
        }
        try {
          await e.onSubmit();
        } catch {
          return;
        }
        const i = this._tag.tag, s = this._tag.group;
        this._saving = !0;
        const a = await this._repository.deleteTag(this._tag);
        this._saving = !1;
        const n = await this.getContext(g);
        a ? (n == null || n.peek("positive", {
          data: {
            headline: "Tag Deleted",
            message: `"${i}" has been deleted successfully`
          }
        }), setTimeout(() => {
          const r = s != null && s.trim() ? `/umbraco/section/tagmanager/workspace/tagmanager-group/edit/${encodeURIComponent(s.trim())}` : "/umbraco/section/tagmanager";
          history.pushState(null, "", r), window.dispatchEvent(new PopStateEvent("popstate"));
        }, 500)) : n == null || n.peek("danger", {
          data: {
            headline: "Delete Failed",
            message: "Failed to delete the tag. Please try again."
          }
        });
      } catch {
        this._saving = !1;
        const e = await this.getContext(g);
        e == null || e.peek("danger", {
          data: {
            headline: "Error",
            message: "An error occurred while deleting the tag. Please try again."
          }
        });
      }
  }
  _onTagNameChange(t) {
    if (!this._tag) return;
    const e = t.target;
    this._tag = { ...this._tag, tag: e.value };
  }
  _onMergeTagChange(t) {
    if (!this._tag) return;
    const e = t.target, i = parseInt(e.value), s = this._tag.tagsInGroup.options.find((a) => a.id === i);
    s && (this._tag = {
      ...this._tag,
      tagsInGroup: {
        ...this._tag.tagsInGroup,
        selectedItem: s
      }
    });
  }
  render() {
    return this._loading ? l`<div class="loader-container"><uui-loader></uui-loader></div>` : this._tag ? l`
			<div class="tag-editor">
				<uui-box class="editor-header-box">
					<div class="editor-header">
						<div class="header-content">
							<h2>${this._tag.tag}</h2>
							<div class="header-meta">
								<span class="group-badge">
									<uui-icon name="icon-folder"></uui-icon>
									${this._tag.group}
								</span>
								<span class="usage-badge">
									<uui-icon name="icon-files"></uui-icon>
									${this._tag.noTaggedNodes} uses
								</span>
							</div>
						</div>
						<div class="header-actions">
							<uui-button
								label="Delete"
								look="outline"
								color="danger"
								@click=${this._delete}
								?disabled=${this._saving}>
								<uui-icon name="icon-delete"></uui-icon>
								Delete
							</uui-button>
							<uui-button
								label="Save"
								look="primary"
								color="positive"
								@click=${this._save}
								?disabled=${this._saving}>
								${this._saving ? l`<uui-loader></uui-loader>` : l`<uui-icon name="icon-save"></uui-icon>`}
								Save
							</uui-button>
						</div>
					</div>
				</uui-box>

				<div class="editor-content">
					<div class="left-column">
						<uui-box headline="Tag Details">
							<div class="form-section">
								<uui-form-layout-item>
									<uui-label slot="label" for="tagName" required>Tag Name</uui-label>
									<uui-input
										id="tagName"
										label="Tag Name"
										.value=${this._tag.tag}
										@input=${this._onTagNameChange}
										?disabled=${this._saving}>
									</uui-input>
								</uui-form-layout-item>

								${this._tag.tagsInGroup && this._tag.tagsInGroup.options && this._tag.tagsInGroup.options.length > 1 ? (() => {
      var e, i;
      const t = ((i = (e = this._tag.tagsInGroup) == null ? void 0 : e.selectedItem) == null ? void 0 : i.id) ?? 0;
      return l`
											<uui-form-layout-item>
												<uui-label slot="label" for="mergeTag">Merge with Tag</uui-label>
												<select
													id="mergeTag"
													class="merge-select"
													.value=${t.toString()}
													@change=${this._onMergeTagChange}
													?disabled=${this._saving}>
													${this._tag.tagsInGroup.options.map(
        (s) => l`
															<option 
																value="${s.id}"
																?selected=${s.id === t}>
																${s.tag}
															</option>
														`
      )}
												</select>
												<div slot="description">
													Select a tag to merge this tag into. All content using this tag will be reassigned.
												</div>
											</uui-form-layout-item>
										`;
    })() : ""}
							</div>
						</uui-box>
					</div>

					<div class="right-column">
						${this._tag.taggedDocuments && this._tag.taggedDocuments.length > 0 ? l`
									<uui-box headline="Tagged Content (${this._tag.taggedDocuments.length})">
										<div class="content-list">
											${this._tag.taggedDocuments.map(
      (t) => l`
													<uui-ref-node
														name="${t.documentName || t.DocumentName}"
														href="${t.documentUrl || t.DocumentUrl}">
														<uui-icon slot="icon" name="icon-document"></uui-icon>
													</uui-ref-node>
												`
    )}
										</div>
									</uui-box>
							  ` : l`
									<uui-box headline="Tagged Content">
										<div class="empty-state">
											<uui-icon name="icon-document"></uui-icon>
											<p>No content tagged with this tag</p>
										</div>
									</uui-box>
							  `}
					</div>
				</div>
			</div>
		` : l`<p>Tag not found</p>`;
  }
};
$(d, "styles", f`
		:host {
			display: block;
			height: 100%;
			overflow: auto;
		}

		.loader-container {
			display: flex;
			justify-content: center;
			align-items: center;
			height: 200px;
		}

		.tag-editor {
			display: flex;
			flex-direction: column;
			height: 100%;
			padding: var(--uui-size-space-6);
			gap: var(--uui-size-space-5);
		}

		.editor-header-box {
			background: linear-gradient(135deg, var(--uui-color-surface) 0%, var(--uui-color-surface-alt) 100%);
		}

		.editor-header {
			display: flex;
			justify-content: space-between;
			align-items: flex-start;
			gap: var(--uui-size-space-4);
			padding: var(--uui-size-space-5);
		}

		.header-content {
			flex: 1;
		}

		.header-content h2 {
			margin: 0 0 var(--uui-size-space-3) 0;
			font-size: 24px;
			font-weight: 700;
			color: var(--uui-color-text);
		}

		.header-meta {
			display: flex;
			gap: var(--uui-size-space-3);
			align-items: center;
		}

		.group-badge,
		.usage-badge {
			display: inline-flex;
			align-items: center;
			gap: var(--uui-size-space-2);
			padding: var(--uui-size-space-2) var(--uui-size-space-3);
			background: var(--uui-color-surface);
			border: 1px solid var(--uui-color-border);
			border-radius: var(--uui-border-radius);
			font-size: 13px;
			font-weight: 600;
			color: var(--uui-color-text);
		}

		.group-badge uui-icon,
		.usage-badge uui-icon {
			font-size: 14px;
		}

		.header-actions {
			display: flex;
			gap: var(--uui-size-space-3);
		}

		.editor-content {
			display: grid;
			grid-template-columns: 1fr 1fr;
			gap: var(--uui-size-space-5);
			flex: 1;
			overflow: hidden;
		}

		.left-column,
		.right-column {
			display: flex;
			flex-direction: column;
			gap: var(--uui-size-space-4);
			overflow: auto;
		}

		.form-section {
			display: flex;
			flex-direction: column;
			gap: var(--uui-size-space-4);
			padding: var(--uui-size-space-4);
		}

		.merge-select {
			width: 100%;
			padding: var(--uui-size-space-3);
			border: 1px solid var(--uui-color-border);
			border-radius: var(--uui-border-radius);
			background: var(--uui-color-surface);
			color: var(--uui-color-text);
			font-family: inherit;
			font-size: 14px;
			cursor: pointer;
			outline: none;
			transition: all 0.2s;
		}

		.merge-select:hover {
			border-color: var(--uui-color-border-emphasis);
		}

		.merge-select:focus {
			border-color: var(--uui-color-selected);
			box-shadow: 0 0 0 2px var(--uui-color-selected-emphasis);
		}

		.merge-select:disabled {
			opacity: 0.5;
			cursor: not-allowed;
		}

		.content-list {
			display: flex;
			flex-direction: column;
			gap: var(--uui-size-space-2);
			padding: var(--uui-size-space-4);
			max-height: 400px;
			overflow-y: auto;
		}

		.empty-state {
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			padding: var(--uui-size-space-6);
			color: var(--uui-color-text-alt);
			text-align: center;
		}

		.empty-state uui-icon {
			font-size: 48px;
			opacity: 0.3;
			margin-bottom: var(--uui-size-space-3);
		}

		.empty-state p {
			margin: 0;
			font-size: 14px;
		}

		@media (max-width: 1200px) {
			.editor-content {
				grid-template-columns: 1fr;
			}
		}
	`);
c([
  h()
], d.prototype, "_tag", 2);
c([
  h()
], d.prototype, "_loading", 2);
c([
  h()
], d.prototype, "_saving", 2);
c([
  h()
], d.prototype, "_tagId", 2);
d = c([
  b("tag-edit-view")
], d);
const C = d;
export {
  d as TagEditViewElement,
  C as default
};
//# sourceMappingURL=tag-edit-view.element-B8A-rxog.js.map
