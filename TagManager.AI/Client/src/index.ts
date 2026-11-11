import { UmbEntryPointOnInit } from '@umbraco-cms/backoffice/extension-api';
import { manifests } from './manifest.js';

export const onInit: UmbEntryPointOnInit = (_host, extensionRegistry) => {
	extensionRegistry.registerMany(manifests);
};
