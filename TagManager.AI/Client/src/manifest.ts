export const manifests = [
	{
		type: 'propertyAction',
		kind: 'default',
		alias: 'TagManager.PropertyAction.CreateTagsWithAi',
		name: 'Create tags with AI',
		forPropertyEditorUis: ['Umb.PropertyEditorUi.Tags'],
		api: () => import('./create-tags-with-ai.action.js'),
		weight: 100,
		meta: {
			icon: 'icon-wand',
			label: 'Create with AI',
		},
	},
	{
		type: 'modal',
		alias: 'TagManager.Modal.AiCreateTags',
		name: 'Create Tags With AI Modal',
		js: () => import('./ai-create-tags-modal.element.js'),
	},
];
