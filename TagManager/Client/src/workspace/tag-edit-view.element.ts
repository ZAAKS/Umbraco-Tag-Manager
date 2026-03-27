import { LitElement, css, html, customElement, state } from '@umbraco-cms/backoffice/external/lit';
import { UmbElementMixin } from '@umbraco-cms/backoffice/element-api';
import { UMB_NOTIFICATION_CONTEXT } from '@umbraco-cms/backoffice/notification';
import { UMB_MODAL_MANAGER_CONTEXT, UMB_CONFIRM_MODAL } from '@umbraco-cms/backoffice/modal';
import { TagManagerRepository } from '../api/tagmanager-repository.js';
import type { CmsTag } from '../api/types.js';

@customElement('tag-edit-view')
export class TagEditViewElement extends UmbElementMixin(LitElement) {
	private _repository: TagManagerRepository;
	private _locationPoller: number | null = null;
	private _lastPathname = '';
	private _loadRequestId = 0;

	@state()
	private _tag: CmsTag | null = null;

	@state()
	private _loading = true;

	@state()
	private _saving = false;

	@state()
	private _tagId?: number;

	constructor() {
		super();
		this._repository = new TagManagerRepository(this);
	}

	async connectedCallback() {
		super.connectedCallback();

		this._lastPathname = window.location.pathname;
		await this._syncFromLocation(this._lastPathname);

		// Umbraco routing can update the URL without re-creating this view element.
		// Poll for pathname changes so selecting different tags from the tree reloads.
		this._locationPoller = window.setInterval(() => {
			const current = window.location.pathname;
			if (current !== this._lastPathname) {
				this._lastPathname = current;
				void this._syncFromLocation(current);
			}
		}, 200);
	}

	disconnectedCallback() {
		if (this._locationPoller !== null) {
			window.clearInterval(this._locationPoller);
			this._locationPoller = null;
		}

		super.disconnectedCallback();
	}

	private _getTagIdFromPath(pathname: string): number | null {
		const matches = pathname.match(/\/tagmanager-tag\/edit\/(\d+)/);
		if (matches && matches[1]) return parseInt(matches[1]);
		return null;
	}

	private async _syncFromLocation(pathname: string) {
		const tagId = this._getTagIdFromPath(pathname);
		if (!tagId) {
			this._tagId = undefined;
			this._tag = null;
			this._loading = false;
			this.requestUpdate();
			return;
		}

		if (tagId === this._tagId && this._tag) return;

		this._tagId = tagId;
		await this._loadTag();
	}

	private async _loadTag() {
		if (!this._tagId) return;

		const requestId = ++this._loadRequestId;
		this._loading = true;
		this.requestUpdate();

		const rawTag = await this._repository.getTagById(this._tagId);
		if (requestId !== this._loadRequestId) return;
		
		if (rawTag) {
			const tagsInGroupRaw = rawTag.tagsInGroup || rawTag.TagsInGroup;
			const normalizedTagsInGroup = {
				selectedItem: tagsInGroupRaw?.selectedItem || tagsInGroupRaw?.SelectedItem || { id: 0, tag: '', Id: 0, Tag: '' },
				options: (tagsInGroupRaw?.options || tagsInGroupRaw?.Options || []).map((opt: any) => ({
					id: opt.id || opt.Id || 0,
					tag: opt.tag || opt.Tag || '',
				})),
			};
			
			this._tag = {
				id: rawTag.id || rawTag.Id || 0,
				tag: rawTag.tag || rawTag.Tag || '',
				group: rawTag.group || rawTag.Group || '',
				noTaggedNodes: rawTag.noTaggedNodes || rawTag.NoTaggedNodes || 0,
				taggedDocuments: (rawTag.taggedDocuments || rawTag.TaggedDocuments || []).map((doc: any) => ({
					documentId: doc.documentId || doc.DocumentId || 0,
					documentName: doc.documentName || doc.DocumentName || '',
					documentUrl: doc.documentUrl || doc.DocumentUrl || '',
				})),
				taggedMedia: (rawTag.taggedMedia || rawTag.TaggedMedia || []).map((media: any) => ({
					documentId: media.documentId || media.DocumentId || 0,
					documentName: media.documentName || media.DocumentName || '',
					documentUrl: media.documentUrl || media.DocumentUrl || '',
				})),
				tagsInGroup: normalizedTagsInGroup,
			};
		} else {
			this._tag = null;
		}
		
		if (requestId === this._loadRequestId) {
			this._loading = false;
			this.requestUpdate();
		}
	}

	private async _save() {
		if (!this._tag) return;

		this._saving = true;
		const success = await this._repository.save(this._tag);
		this._saving = false;

		const notificationContext = await this.getContext(UMB_NOTIFICATION_CONTEXT);
		
		if (success) {
			notificationContext?.peek('positive', {
				data: {
					headline: 'Tag Saved',
					message: `"${this._tag.tag}" has been saved successfully`,
				},
			});
		} else {
			notificationContext?.peek('danger', {
				data: {
					headline: 'Save Failed',
					message: 'Failed to save the tag. Please try again.',
				},
			});
		}
	}

	private async _delete() {
		if (!this._tag) {
			return;
		}

		try {
			const modalManager = await this.getContext(UMB_MODAL_MANAGER_CONTEXT);
			if (!modalManager) {
				const notificationContext = await this.getContext(UMB_NOTIFICATION_CONTEXT);
				notificationContext?.peek('danger', {
					data: {
						headline: 'Error',
						message: 'Unable to open confirmation dialog. Please try again.',
					},
				});
				return;
			}

			const modalContext = modalManager.open(this, UMB_CONFIRM_MODAL, {
				data: {
					headline: 'Delete Tag',
					content: `Are you sure you want to delete the tag "${this._tag.tag}"?`,
					color: 'danger',
					confirmLabel: 'Delete',
				},
			});

			if (!modalContext) {
				const notificationContext = await this.getContext(UMB_NOTIFICATION_CONTEXT);
				notificationContext?.peek('danger', {
					data: {
						headline: 'Error',
						message: 'Unable to open confirmation dialog. Please try again.',
					},
				});
				return;
			}

			try {
				await modalContext.onSubmit();
			} catch (error) {
				return;
			}
			const deletedTagName = this._tag.tag;
			const deletedTagGroup = this._tag.group;
			this._saving = true;
			const success = await this._repository.deleteTag(this._tag);
			this._saving = false;

			const notificationContext = await this.getContext(UMB_NOTIFICATION_CONTEXT);
			
			if (success) {
				notificationContext?.peek('positive', {
					data: {
						headline: 'Tag Deleted',
						message: `"${deletedTagName}" has been deleted successfully`,
					},
				});
				setTimeout(() => {
					const groupRoute = deletedTagGroup?.trim()
						? `/umbraco/section/tagmanager/workspace/tagmanager-group/edit/${encodeURIComponent(deletedTagGroup.trim())}`
						: '/umbraco/section/tagmanager';
					history.pushState(null, '', groupRoute);
					window.dispatchEvent(new PopStateEvent('popstate'));
				}, 500);
			} else {
				notificationContext?.peek('danger', {
					data: {
						headline: 'Delete Failed',
						message: 'Failed to delete the tag. Please try again.',
					},
				});
			}
		} catch (error) {
			this._saving = false;
			const notificationContext = await this.getContext(UMB_NOTIFICATION_CONTEXT);
			notificationContext?.peek('danger', {
				data: {
					headline: 'Error',
					message: 'An error occurred while deleting the tag. Please try again.',
				},
			});
		}
	}

	private _onTagNameChange(e: Event) {
		if (!this._tag) return;
		const input = e.target as HTMLInputElement;
		this._tag = { ...this._tag, tag: input.value };
	}

	private _onMergeTagChange(e: Event) {
		if (!this._tag) return;
		const select = e.target as HTMLSelectElement;
		const selectedId = parseInt(select.value);
		const selectedTag = this._tag.tagsInGroup.options.find((t) => t.id === selectedId);
		if (selectedTag) {
			this._tag = {
				...this._tag,
				tagsInGroup: {
					...this._tag.tagsInGroup,
					selectedItem: selectedTag,
				},
			};
		}
	}

	render() {
		if (this._loading) {
			return html`<div class="loader-container"><uui-loader></uui-loader></div>`;
		}

		if (!this._tag) {
			return html`<p>Tag not found</p>`;
		}

		return html`
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
								${this._saving ? html`<uui-loader></uui-loader>` : html`<uui-icon name="icon-save"></uui-icon>`}
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

								${this._tag.tagsInGroup && this._tag.tagsInGroup.options && this._tag.tagsInGroup.options.length > 1
									? (() => {
										const selectedId = this._tag.tagsInGroup?.selectedItem?.id ?? 0;
										return html`
											<uui-form-layout-item>
												<uui-label slot="label" for="mergeTag">Merge with Tag</uui-label>
												<select
													id="mergeTag"
													class="merge-select"
													.value=${selectedId.toString()}
													@change=${this._onMergeTagChange}
													?disabled=${this._saving}>
													${this._tag.tagsInGroup.options.map(
														(option) => html`
															<option 
																value="${option.id}"
																?selected=${option.id === selectedId}>
																${option.tag}
															</option>
														`
													)}
												</select>
												<div slot="description">
													Select a tag to merge this tag into. All content using this tag will be reassigned.
												</div>
											</uui-form-layout-item>
										`;
									})()
									: ''}
							</div>
						</uui-box>
					</div>

					<div class="right-column">
						${this._tag.taggedDocuments && this._tag.taggedDocuments.length > 0
							? html`
									<uui-box headline="Tagged Content (${this._tag.taggedDocuments.length})">
										<div class="content-list">
											${this._tag.taggedDocuments.map(
												(doc) => html`
													<uui-ref-node
														name="${doc.documentName || doc.DocumentName}"
														href="${doc.documentUrl || doc.DocumentUrl}">
														<uui-icon slot="icon" name="icon-document"></uui-icon>
													</uui-ref-node>
												`
											)}
										</div>
									</uui-box>
							  `
							: html`
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
		`;
	}

	static styles = css`
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
	`;
}

export default TagEditViewElement;

declare global {
	interface HTMLElementTagNameMap {
		'tag-edit-view': TagEditViewElement;
	}
}

