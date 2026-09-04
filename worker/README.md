# Chat worker

Backs the "Ask about my experience" widget on karlkiser.com.

The site itself is static (Astro → GitHub Pages), so there is nowhere on it to
keep an API key or write a log. This Cloudflare Worker is that missing piece and
nothing more: it holds the Anthropic key, calls the model, caps spend, and
records conversations. It deploys separately; the site's deploy pipeline is
untouched.

```
Browser (AskWidget island) ──POST /chat──▶ Worker ──▶ Claude API (Haiku 4.5)
                                             │
                                             └──▶ D1 `turns` (logs + rate-limit counters)
```

## Beta: run it locally, no key, no cost

`MOCK=1` in `.dev.vars` returns canned replies without calling any model, so the
widget, transcript persistence, rate limiting and logging can all be exercised
for free.

```bash
cd worker && npm install
cp .dev.vars.example .dev.vars     # already MOCK=1
npx wrangler d1 execute chat-logs --local --file=./schema.sql
npm run dev                        # http://localhost:8787
```

Then, in the repo root, point the site at it and start Astro:

```bash
echo 'PUBLIC_CHAT_ENDPOINT=http://localhost:8787/chat' > .env
npm run dev                        # http://localhost:4321
```

To test real answers, set `MOCK=0` and paste a key into `.dev.vars`.
**Restart `wrangler dev` after editing `.dev.vars` — it is not hot-reloaded.**

Read the local log:

```bash
npm run logs:local
```

## Going live

1. **Set a monthly spend limit in the Anthropic Console before anything else.**
   It is the only cap that survives a bug in the code below.
2. `npx wrangler d1 create chat-logs`, then paste the printed `database_id` into
   `wrangler.toml`.
3. `npm run db:remote` to create the table.
4. `npx wrangler secret put ANTHROPIC_API_KEY` and `npx wrangler secret put IP_SALT`
   (any long random string for the salt).
5. `npm run deploy`, note the `*.workers.dev` URL.
6. Put that URL in `SITE.chatEndpoint` in `src/config/site.ts` and push. The
   widget and the privacy-page disclosure both appear only when that value is
   non-empty, so this one line is also the kill switch.

## Reading conversations

No admin endpoint exists on purpose — a public URL returning every conversation
would be the highest-value target on the system, and it would protect data that
is already readable from the command line.

```bash
npm run logs                       # recent conversations, newest first
npx wrangler d1 execute chat-logs --remote --command \
  "SELECT turn_index, user_text, reply_text FROM turns WHERE cid='...' ORDER BY turn_index"
```

`ip_hash` is `SHA-256(ip + IP_SALT)`. The raw address is never stored.

Retention is 90 days, per the privacy page. Until that runs on a schedule:

```bash
npx wrangler d1 execute chat-logs --remote --command \
  "DELETE FROM turns WHERE created_at < unixepoch()*1000 - 7776000000"
```

## Spend

Haiku 4.5 at $1/$5 per MTok. The system prompt is ~3,200 tokens, so a turn is
roughly $0.005 and a five-turn conversation about $0.03 — call it $1–9/month at
30–300 conversations.

Three layers cap it, in order of reliability: the Console spend limit; the
`GLOBAL_LIMIT` of 150 turns/day in `wrangler.toml` (~$0.75/day worst case); and
the per-IP limit, origin check, and honeypot, which filter casual abuse.

## Keeping the bot honest

`src/corpus.ts` is the only thing the model knows about Karl. Publications and
identity/status are **imported directly** from `src/data/publications.ts` and
`src/config/site.ts`, so they cannot go stale — `SITE.openTo` in particular.

The CV narrative and the patent are hand-authored in that file, written for the
bot rather than for display, including an explicit "what the record does not
show" section so it can decline honestly instead of guessing. **Update it when
`CvSection.astro` or `PatentsSection.astro` change.**

## Notes for future edits

- `output_config.effort` is rejected on Haiku 4.5 — do not add it.
- The prompt is under Haiku's 4,096-token minimum cacheable prefix, so a
  `cache_control` marker would never fire while still costing the write premium.
  Revisit only if the corpus grows past ~4k tokens.
- Check `stop_reason === 'refusal'` before reading `content[0]`; a refusal is an
  HTTP 200 with an empty content array.
- Rate limiting uses D1, not KV: the KV free tier allows 1,000 writes/day, which
  would make the limiter itself the first thing to break under abuse.
