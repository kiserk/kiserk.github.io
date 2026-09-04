export interface Env {
  DB?: D1Database;

  // Secrets — `wrangler secret put NAME` in production, .dev.vars locally.
  ANTHROPIC_API_KEY?: string;
  IP_SALT?: string;

  // Vars from wrangler.toml, overridable in .dev.vars. All strings.
  DEV?: string;
  MOCK?: string;
  ALLOWED_ORIGIN?: string;
  PER_IP_LIMIT?: string;
  GLOBAL_LIMIT?: string;
  MAX_TURNS?: string;
}

export function num(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function flag(value: string | undefined): boolean {
  return value === '1' || value === 'true';
}

/**
 * SHA-256(ip + salt). Keeps the rate-limit key and the "same visitor?" signal
 * while making sure a database dump never exposes a visitor's address.
 */
export async function hashIp(ip: string, salt: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${ip}:${salt}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
