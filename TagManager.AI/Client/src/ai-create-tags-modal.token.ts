import { UmbModalToken } from '@umbraco-cms/backoffice/modal';

export interface AiCreateTagsModalData {
	contentName: string;
	contentText: string;
	existingTags: string[];
}

export interface AiCreateTagsModalValue {
	tags: string[];
}

export const AI_CREATE_TAGS_MODAL_TOKEN = new UmbModalToken<AiCreateTagsModalData, AiCreateTagsModalValue>(
	'TagManager.Modal.AiCreateTags',
	{
		modal: {
			type: 'dialog',
			size: 'small',
		},
	},
);
