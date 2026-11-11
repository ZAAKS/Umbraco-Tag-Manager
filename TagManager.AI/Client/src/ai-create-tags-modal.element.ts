import { html, css, customElement, state } from '@umbraco-cms/backoffice/external/lit';
import { UmbModalBaseElement } from '@umbraco-cms/backoffice/modal';
import type { AiCreateTagsModalData, AiCreateTagsModalValue } from './ai-create-tags-modal.token.js';
import { TagAiRepository } from './tag-ai-repository.js';

@customElement('tag-ai-create-modal')
export class AiCreateTagsModalElement extends UmbModalBaseElement<AiCreateTagsModalData, AiCreateTagsModalValue> {
	#repository = new TagAiRepository(this);

	@state()
	private _count = 5;

	@state()
	private _saving = false;

	@state()
	private _error = '';

	#onCountInput(event: Event) {
		const value = Number((event.target as HTMLInputElement).value);
		this._count = Number.isFinite(value) ? value : 0;
	}

	async #submit(event: Event) {
		event.preventDefault();
		if (this._count < 1 || this._count > 20) {
			this._error = 'Choose between 1 and 20 tags.';
			return;
		}

		this._saving = true;
		this._error = '';
		try {
			const tags = await this.#repository.suggest({
				count: this._count,
				contentName: this.data?.contentName ?? '',
				contentText: this.data?.contentText ?? '',
				existingTags: this.data?.existingTags ?? [],
			});
			if (tags.length === 0) {
				this._error = 'Umbraco.AI did not return any new tags.';
				return;
			}

			this.modalContext?.setValue({ tags });
			this.modalContext?.submit();
		} catch (error) {
			this._error = error instanceof Error ? error.message : 'Tag suggestion failed.';
		} finally {
			this._saving = false;
		}
	}

	#cancel() {
		this.modalContext?.reject();
	}

	override render() {
		return html`
			<umb-modal-layout headline="Create tags with AI">
				<form @submit=${this.#submit}>
					<uui-box>
						<umb-property-layout
							label="How many tags?"
							description="Umbraco.AI reads this item and adds the tags to the field. Save the content to keep them.">
							<uui-input
								slot="editor"
								type="number"
								min="1"
								max="20"
								.value=${String(this._count)}
								@input=${this.#onCountInput}
								label="Number of tags"
								required>
							</uui-input>
						</umb-property-layout>
						${this._error ? html`<p class="error">${this._error}</p>` : ''}
					</uui-box>
					<div slot="actions">
						<uui-button label="Cancel" look="secondary" @click=${this.#cancel} ?disabled=${this._saving}>
							Cancel
						</uui-button>
						<uui-button
							type="submit"
							look="primary"
							color="positive"
							label="Create"
							?disabled=${this._saving || this._count < 1 || this._count > 20}
							.state=${this._saving ? 'waiting' : undefined}>
							${this._saving ? 'Creating...' : 'Create'}
						</uui-button>
					</div>
				</form>
			</umb-modal-layout>
		`;
	}

	static styles = css`
		form {
			display: flex;
			flex-direction: column;
		}

		.error {
			margin: var(--uui-size-space-4) 0 0;
			color: var(--uui-color-danger);
		}

		[slot='actions'] {
			display: flex;
			justify-content: flex-end;
			gap: var(--uui-size-space-3);
		}
	`;
}

export default AiCreateTagsModalElement;
