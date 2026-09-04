import Anthropic from '@anthropic-ai/sdk';
import { type Env, flag, hashIp, num } from './env';
import { SYSTEM_PROMPT } from './prompt';
import { checkIpLimit, checkLimits } from './limits';
import { logTurn } from './log';
import { NO_MATCH, matchFixture } from './fixtures';

/**
 * Haiku 4.5. Two API constraints worth knowing before editing the call below:
 *  - `output_config.effort` is rejected on this model. Don't add it.
 *  - The prompt is ~3.2k tokens, under Haiku's 4,096-token minimum cacheable
 *    prefix, so a `cache_control` marker would silently never fire while still
 *    charging the write premium. Revisit only if the corpus grows past ~4k.
 */
const MODEL = 'claude-haiku-4-5';
const MAX_TOKENS = 700;

const MAX_MESSAGE_CHARS = 1500;
const MAX_HISTORY = 24; // 12 exchanges
const MAX_BODY_BYTES = 20_000;

const EMAIL = 'karl.j.kiser@gmail.com';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

function allowedOrigins(env: Env): string[] {
  const origins = [env.ALLOWED_ORIGIN ?? 'https://karlkiser.com'];
  if (flag(env.DEV)) {
    origins.push('http://localhost:4321', 'http://127.0.0.1:4321');
  }
  return origins;
}

function corsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

function json(
  body: Record<string, unknown>,
  status: number,
  headers: Record<string, string>
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'content-type': 'application/json; charset=utf-8' },
  });
}

/**
 * Replies for MOCK=1, drawn from hand-written fixtures so the widget can be
 * judged on realistic content without an API key. The response carries
 * `mock: true` and the widget badges itself accordingly — the text reads real,
 * the UI stays honest about where it came from.
 */
function mockReply(userText: string): string {
  return matchFixture(userText) ?? NO_MATCH;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const origin = request.headers.get('Origin') ?? '';
    const permitted = allowedOrigins(env);

    // 1. Preflight. A cross-origin POST with content-type: application/json
    // always triggers this — without a handler, nothing else here ever runs.
    if (request.method === 'OPTIONS') {
      if (!permitted.includes(origin)) return new Response(null, { status: 403 });
      return new Response(null, {
        status: 204,
        headers: { ...corsHeaders(origin), 'Access-Control-Max-Age': '86400' },
      });
    }

    if (request.method !== 'POST') {
      return new Response('method not allowed', { status: 405 });
    }

    // 2. Origin check. This is a speed bump, not security — a browser sends
    // Origin honestly, curl sends whatever it likes. It stops the widget being
    // embedded on someone else's page; the counters below are what cap spend.
    if (!permitted.includes(origin)) {
      return new Response('forbidden', { status: 403 });
    }
    const cors = corsHeaders(origin);

    const url = new URL(request.url);
    if (url.pathname !== '/chat') {
      return json({ error: 'not_found' }, 404, cors);
    }

    // 3. Body size and shape.
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) {
      return json({ error: 'too_large', reply: 'That message is too long to send.' }, 413, cors);
    }

    let payload: { cid?: unknown; messages?: unknown; botcheck?: unknown };
    try {
      payload = JSON.parse(raw);
    } catch {
      return json({ error: 'bad_request' }, 400, cors);
    }

    const cid =
      typeof payload.cid === 'string' && payload.cid.length > 0 && payload.cid.length <= 64
        ? payload.cid
        : crypto.randomUUID();

    if (!Array.isArray(payload.messages) || payload.messages.length === 0) {
      return json({ error: 'bad_request' }, 400, cors);
    }

    const messages: ChatMessage[] = [];
    for (const entry of payload.messages) {
      if (!entry || typeof entry !== 'object') continue;
      const { role, content } = entry as { role?: unknown; content?: unknown };
      if ((role !== 'user' && role !== 'assistant') || typeof content !== 'string') continue;
      const text = content.trim();
      if (!text) continue;
      messages.push({ role, content: text.slice(0, MAX_MESSAGE_CHARS) });
    }

    const last = messages[messages.length - 1];
    if (!last || last.role !== 'user') {
      return json({ error: 'bad_request' }, 400, cors);
    }

    // 4. Honeypot. Answer politely, call nothing, cost nothing.
    if (typeof payload.botcheck === 'string' && payload.botcheck.length > 0) {
      return json({ cid, reply: 'Thanks for the message.' }, 200, cors);
    }

    const history = messages.slice(-MAX_HISTORY);
    const userTurns = history.filter((m) => m.role === 'user').length;
    const turnIndex = Math.max(0, userTurns - 1);

    if (userTurns > num(env.MAX_TURNS, 12)) {
      return json(
        {
          cid,
          error: 'too_many_turns',
          reply: `We've covered a lot in this conversation — start a new one, or email Karl directly at ${EMAIL}.`,
        },
        429,
        cors
      );
    }

    const ip = request.headers.get('CF-Connecting-IP') ?? '0.0.0.0';
    const ipHash = await hashIp(ip, env.IP_SALT ?? 'unsalted-dev');
    const country = (request as { cf?: { country?: string } }).cf?.country ?? null;
    const userAgent = request.headers.get('User-Agent')?.slice(0, 300) ?? null;

    const baseRecord = {
      cid,
      turnIndex,
      userText: last.content,
      ipHash,
      country,
      userAgent,
    };

    // 5. Rate limits. Global first — it is the cost ceiling.
    const globalVerdict = await checkLimits(env);
    const ipVerdict = globalVerdict.ok ? await checkIpLimit(env, ipHash) : globalVerdict;
    if (!ipVerdict.ok) {
      const reply =
        ipVerdict.scope === 'global'
          ? `The chat has hit its daily limit. Email Karl at ${EMAIL} and he'll answer directly.`
          : `You've reached the message limit for today. Email Karl at ${EMAIL} and he'll answer directly.`;
      ctx.waitUntil(
        logTurn(env, {
          ...baseRecord,
          replyText: null,
          status: 'rate_limited',
          inTokens: null,
          outTokens: null,
        })
      );
      return json({ cid, error: 'rate_limited', reply }, 429, cors);
    }

    const storageHeader = { 'x-chat-storage': env.DB ? 'd1' : 'none' };

    // 6. Mock mode: no model call at all. This is what beta runs on.
    if (flag(env.MOCK) || !env.ANTHROPIC_API_KEY) {
      const reply = mockReply(last.content);
      ctx.waitUntil(
        logTurn(env, {
          ...baseRecord,
          replyText: reply,
          status: 'mock',
          inTokens: null,
          outTokens: null,
        })
      );
      return json({ cid, reply, mock: true }, 200, { ...cors, ...storageHeader });
    }

    // 7. The actual call.
    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

    try {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        temperature: 0.2,
        system: SYSTEM_PROMPT,
        messages: history,
      });

      // Guard before touching content: a refusal returns HTTP 200 with an
      // empty content array, so content[0].text would throw.
      if (response.stop_reason === 'refusal') {
        const reply = `I can't help with that one. Ask me about Karl's work, or email him at ${EMAIL}.`;
        ctx.waitUntil(
          logTurn(env, {
            ...baseRecord,
            replyText: reply,
            status: 'refusal',
            inTokens: response.usage.input_tokens,
            outTokens: response.usage.output_tokens,
          })
        );
        return json({ cid, reply }, 200, { ...cors, ...storageHeader });
      }

      const reply = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('\n')
        .trim();

      if (!reply) {
        throw new Error(`empty reply, stop_reason=${response.stop_reason}`);
      }

      ctx.waitUntil(
        logTurn(env, {
          ...baseRecord,
          replyText: reply,
          status: 'ok',
          inTokens: response.usage.input_tokens,
          outTokens: response.usage.output_tokens,
        })
      );

      return json({ cid, reply }, 200, { ...cors, ...storageHeader });
    } catch (err) {
      console.error('anthropic call failed', err);

      const retryable =
        err instanceof Anthropic.RateLimitError || err instanceof Anthropic.APIConnectionError;
      const reply = retryable
        ? 'That request timed out on my end. Try again in a moment.'
        : `Something went wrong answering that. Try again, or email Karl at ${EMAIL}.`;

      ctx.waitUntil(
        logTurn(env, {
          ...baseRecord,
          replyText: null,
          status: 'error',
          inTokens: null,
          outTokens: null,
        })
      );

      return json({ cid, error: 'upstream', reply }, 503, { ...cors, ...storageHeader });
    }
  },
} satisfies ExportedHandler<Env>;
