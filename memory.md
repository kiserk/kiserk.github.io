# memory.md — fast context refresh

Cheat sheet for whoever (human or agent) picks this up next. Read this first; deep prose is in `README.md`. Keep this current (see `.cursor/rules/memory.mdc`).

## What this is
Karl Kiser's personal / job-search site. Purpose: present credibly to employers **and** be highly machine-readable so recruiting/AI agents can parse and flag it.

## Live + deploy
- Live: **https://karlkiser.com** (custom domain; `public/CNAME`).
- Host: GitHub Pages. **Deploy = push to `main`** (`.github/workflows/deploy.yml`). No manual publish step.
- `astro.config.mjs` `site` must stay `https://karlkiser.com` or SEO/sitemap/OG URLs break.

## Stack
- Astro v6 (static output) + Tailwind v4 (via `@tailwindcss/vite`, no `tailwind.config.js`; tokens in `@theme` in `src/styles/global.css`).
- `@astrojs/sitemap` integration → `sitemap-index.xml` at build.
- Node >= 22.12. `npm run dev | build | preview`.

## Key files
- `src/config/site.ts` — **single source of truth** for identity, tagline, bio, profile links (`sameAs`), `knowsAbout` keywords, OG image, and the GoatCounter code. Edit copy/links here.
- `src/layouts/BaseLayout.astro` — all SEO: title/description, canonical, OG + Twitter, JSON-LD (Person + WebSite always; pages pass extra via `jsonLd` prop), font preconnect, GoatCounter snippet. Accepts `{ title, description, path, ogImage, jsonLd, noindex }`.
- `src/pages/*` — each page passes a unique `title`/`description`/`path`. `publications` emits `ScholarlyArticle` JSON-LD from its data array; `patents` emits a patent `CreativeWork`.
- `src/components/OceanBackground.astro` + `src/scripts/ocean-*.ts` — signature animated canvas (see README).

## SEO / agent-readability (done)
- JSON-LD: `Person` (jobTitle, knowsAbout, alumniOf, address, sameAs, email) + `WebSite` on every page; `ScholarlyArticle` x4 on /publications; patent `CreativeWork` on /patents.
- `public/robots.txt` explicitly **allows** AI crawlers (GPTBot, ClaudeBot, PerplexityBot, Google-Extended, etc.) + points to sitemap.
- `og-image.png` (1200x630) referenced site-wide; per-page canonical + OG/Twitter.
- `src/pages/404.astro` (GitHub Pages needs a static 404) marked `noindex`.

## Analytics (GoatCounter — free, cookieless)
- Snippet injected by `BaseLayout` only when `SITE.goatCounterCode` is set (currently `"karlkiser"`).
- **ACTION NEEDED:** register that code at https://www.goatcounter.com or data won't record.
- "What's interesting" = custom click events via `data-goatcounter-click="..."` on: CV view/download, email, LinkedIn, ORCID/Scholar/GitHub, marathon link, each publication DOI (`pub:`/`doi:`), patent link. Dashboard shows visitors, country, referrer, top pages + these events.
- `/privacy` page explains the cookieless/anonymous setup; linked from footer.

## Accessibility / contrast (done)
- `--surface` darkened to `rgba(9,15,26,0.72)` and `--ink-faint` raised to `0.66` so cards hold AA over a bright midday ocean (text-over-ocean already handled by a scrim + always-light text in `ocean-palette.ts`).
- `:focus-visible` outline in `global.css`; canvas draws a single static frame under `prefers-reduced-motion` (`renderer.renderOnce()`); mobile menu toggles `aria-expanded`.

## Decisions / trade-offs
- Card contrast hardened via a **static** surface/ink bump (not palette-driven) — simpler, lower risk, AA across all states.
- AI crawlers **allowed** on purpose (goal is to be found by recruiting agents).
- OG image generated to match the ocean aesthetic; ~1.7 MB PNG (could be optimized later).

## CV PDF
- Downloadable PDF at `public/Karl-Kiser-CV.pdf`; linked (with `download`) from the homepage and the `/cv` page header (`data-goatcounter-click="cv-download"`).
- **Source:** `cv/Karl-Kiser-CV.md`. Regenerate after edits with the markdown→PDF tool:
  `python3 /Users/karlkiser/Documents/Vehicles/_tools/md_to_pdf.py "cv/Karl-Kiser-CV.md" --output "public/Karl-Kiser-CV.pdf"`
- **Dual-source gotcha:** `src/pages/cv.astro` (web) and `cv/Karl-Kiser-CV.md` (PDF) are separate; keep them in sync when CV content changes.

## Open TODOs / needs from Karl
- Confirm tagline / "open to" wording in `src/config/site.ts`.
- Optional: compress `og-image.png`; self-host fonts (only preconnect added so far).

## Settled (do not re-flag)
- **GoatCounter**: account registered for code `karlkiser` (dashboard at https://karlkiser.goatcounter.com). Snippet in `BaseLayout` already matches — no code change needed; data records once deployed.
- **ORCID / Google Scholar**: intentionally left blank in `SITE.profiles` per Karl's call. Blank values auto-hide on the homepage and in `sameAs`. Don't keep prompting to add them.

## Gotchas
- `scraper_reference/` is an unrelated local project; now gitignored — don't commit it.
- Don't commit `Career/` (private; gitignored).
- Don't hand-edit `dist/` (build artifact, gitignored).
- CV exists in two places (web page + markdown PDF source) — keep in sync (see CV PDF above).
