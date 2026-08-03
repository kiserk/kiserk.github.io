import { SITE } from './site';

/**
 * Single source of truth for whether the "Ask about my experience" widget is
 * live, used by BaseLayout (whether to render it), AskWidget itself, and the
 * privacy page (whether to show the chat-logging disclosure).
 *
 * Kept out of site.ts on purpose: the chat Worker imports site.ts directly, and
 * `import.meta.env` does not exist in the Workers runtime.
 *
 * Set PUBLIC_CHAT_ENDPOINT in a gitignored .env for local development;
 * production reads SITE.chatEndpoint.
 */
export const CHAT_ENDPOINT: string = import.meta.env.PUBLIC_CHAT_ENDPOINT || SITE.chatEndpoint;

export const CHAT_ENABLED: boolean = CHAT_ENDPOINT.length > 0;
