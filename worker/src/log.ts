import type { Env } from './env';

export interface TurnRecord {
  cid: string;
  turnIndex: number;
  userText: string;
  replyText: string | null;
  status: 'ok' | 'refusal' | 'rate_limited' | 'error' | 'mock';
  ipHash: string;
  country: string | null;
  userAgent: string | null;
  inTokens: number | null;
  outTokens: number | null;
}

/**
 * Called inside ctx.waitUntil, so a logging failure can never add latency to a
 * reply or turn a good answer into an error response.
 */
export async function logTurn(env: Env, turn: TurnRecord): Promise<void> {
  if (!env.DB) return;

  try {
    await env.DB.prepare(
      `INSERT INTO turns
         (cid, turn_index, created_at, user_text, reply_text, status,
          ip_hash, country, user_agent, in_tokens, out_tokens)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`
    )
      .bind(
        turn.cid,
        turn.turnIndex,
        Date.now(),
        turn.userText,
        turn.replyText,
        turn.status,
        turn.ipHash,
        turn.country,
        turn.userAgent,
        turn.inTokens,
        turn.outTokens
      )
      .run();
  } catch (err) {
    console.error('log write failed', err);
  }
}
