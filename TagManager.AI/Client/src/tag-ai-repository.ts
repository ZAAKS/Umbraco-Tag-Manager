import { UmbControllerBase } from '@umbraco-cms/backoffice/class-api';
import { UMB_AUTH_CONTEXT } from '@umbraco-cms/backoffice/auth';
import type { UmbControllerHost } from '@umbraco-cms/backoffice/controller-api';

const API_BASE = '/umbraco/TagManager/api/v1/TagAi';

export interface SuggestTagsRequest {
	count: number;
	contentName: string;
	contentText: string;
	existingTags: string[];
}

export class TagAiRepository extends UmbControllerBase {
	constructor(host: UmbControllerHost) {
		super(host);
	}

	async suggest(request: SuggestTagsRequest): Promise<string[]> {
		const headers = await this.#headers();
		const response = await fetch(`${API_BASE}/suggest`, {
			method: 'POST',
			headers,
			credentials: 'include',
			body: JSON.stringify(request),
		});

		const body = await response.json().catch(() => null) as { tags?: string[]; message?: string } | null;
		if (!response.ok) {
			throw new Error(body?.message || 'Tag suggestion failed.');
		}

		return Array.isArray(body?.tags) ? body.tags.filter((tag) => typeof tag === 'string' && tag.trim().length > 0) : [];
	}

	async #headers(): Promise<HeadersInit> {
		const authContext = await this.getContext(UMB_AUTH_CONTEXT);
		const token = await authContext?.getLatestToken();
		return {
			'Content-Type': 'application/json',
			...(token ? { Authorization: `Bearer ${token}` } : {}),
		};
	}
}
