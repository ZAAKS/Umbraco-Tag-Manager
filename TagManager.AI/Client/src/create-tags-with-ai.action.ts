import { UmbPropertyActionBase } from '@umbraco-cms/backoffice/property-action';
import { UMB_PROPERTY_CONTEXT, UMB_PROPERTY_DATASET_CONTEXT } from '@umbraco-cms/backoffice/property';
import { UMB_MODAL_MANAGER_CONTEXT } from '@umbraco-cms/backoffice/modal';
import { UMB_NOTIFICATION_CONTEXT } from '@umbraco-cms/backoffice/notification';
import { AI_CREATE_TAGS_MODAL_TOKEN } from './ai-create-tags-modal.token.js';

type PropertyEntry = { alias?: string; value?: unknown };

function textFromValue(value: unknown): string {
	if (typeof value === 'string') {
		return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
	}

	if (Array.isArray(value)) {
		return value.filter((item): item is string => typeof item === 'string').join(', ');
	}

	if (value && typeof value === 'object' && 'markup' in value) {
		const markup = (value as { markup?: unknown }).markup;
		return typeof markup === 'string' ? textFromValue(markup) : '';
	}

	return '';
}

function readTags(value: unknown): string[] {
	if (Array.isArray(value)) {
		return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
	}

	if (typeof value === 'string') {
		return value.split(',').map((tag) => tag.trim()).filter((tag) => tag.length > 0);
	}

	return [];
}

export class CreateTagsWithAiAction extends UmbPropertyActionBase {
	override async execute() {
		const propertyContext = await this.getContext(UMB_PROPERTY_CONTEXT);
		if (!propertyContext) return;

		const dataset = await this.getContext(UMB_PROPERTY_DATASET_CONTEXT);
		const alias = propertyContext.getAlias();
		const existing = readTags(propertyContext.getValue());
		const properties = ((await dataset?.getProperties()) ?? []) as PropertyEntry[];
		const contentText = properties
			.filter((property) => property.alias !== alias)
			.map((property) => textFromValue(property.value))
			.filter((text) => text.length > 0)
			.join('\n')
			.slice(0, 6000);

		const modalManager = await this.getContext(UMB_MODAL_MANAGER_CONTEXT);
		if (!modalManager) return;

		const modal = modalManager.open(this, AI_CREATE_TAGS_MODAL_TOKEN, {
			data: {
				contentName: dataset?.getName() ?? '',
				contentText,
				existingTags: existing,
			},
		});

		const result = await modal.onSubmit().catch(() => undefined);
		if (!result?.tags?.length) return;

		const seen = new Set(existing.map((tag) => tag.toLocaleLowerCase()));
		const merged = [...existing];
		for (const tag of result.tags) {
			if (seen.has(tag.toLocaleLowerCase())) continue;
			seen.add(tag.toLocaleLowerCase());
			merged.push(tag);
		}

		propertyContext.setValue(merged);

		const notification = await this.getContext(UMB_NOTIFICATION_CONTEXT);
		notification?.peek('positive', {
			data: {
				headline: 'Tags added',
				message: `${result.tags.length} tag${result.tags.length === 1 ? '' : 's'} added. Save to keep them.`,
			},
		});
	}
}

export { CreateTagsWithAiAction as api };
