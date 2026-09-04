import { type Env, num } from './env';

const DAY_MS = 24 * 60 * 60 * 1000;

export type LimitVerdict = { ok: true } | { ok: false; scope: 'ip' | 'global' };

/**
 * Rate limiting reads the same `turns` table the logs live in — two indexed
 * COUNT(*) queries, no extra schema.
 *
 * Deliberately NOT Workers KV: the free tier allows 1,000 writes/day, so a
 * per-request counter would make the limiter itself the first thing to break
 * under abuse. D1's free tier allows 100,000 row writes/day.
 *
 * With no D1 binding (a bare `wrangler dev` before `npm run db:local`) this
 * returns ok so the widget still works; the caller surfaces that as a header.
 */
export async function checkLimits(env: Env): Promise<LimitVerdict> {
  if (!env.DB) return { ok: true };

  const since = Date.now() - DAY_MS;

  const global = await env.DB.prepare('SELECT COUNT(*) AS n FROM turns WHERE created_at > ?1')
    .bind(since)
    .first<{ n: number }>();
  if ((global?.n ?? 0) >= num(env.GLOBAL_LIMIT, 150)) return { ok: false, scope: 'global' };

  return { ok: true };
}

export async function checkIpLimit(env: Env, ipHash: string): Promise<LimitVerdict> {
  if (!env.DB) return { ok: true };

  const since = Date.now() - DAY_MS;

  const perIp = await env.DB.prepare(
    'SELECT COUNT(*) AS n FROM turns WHERE ip_hash = ?1 AND created_at > ?2'
  )
    .bind(ipHash, since)
    .first<{ n: number }>();
  if ((perIp?.n ?? 0) >= num(env.PER_IP_LIMIT, 20)) return { ok: false, scope: 'ip' };

  return { ok: true };
}
