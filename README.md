# Karl Kiser — Personal Website

A personal website and job-search landing site for Karl Kiser, hosted free on GitHub Pages. It pairs a minimal, design-forward landing page with an ambient looping water background, full CV/Publications/Patents/Projects content, and an interactive live surf conditions page. A companion GitHub Action emails a daily Rockaway Beach surf report.

**Live site:** https://karlkiser.com (custom domain, GitHub Pages — deploys from `main`)

> For a fast, skimmable snapshot of current state, decisions, and open TODOs, read [`memory.md`](memory.md) first. This README is the deeper reference.

---

## Purpose of this README

This file exists to give **context continuity between chats / sessions**. If you are an AI assistant or a developer picking this project up cold, read this top-to-bottom first. It captures the architecture, the key design decisions (and *why* they were made), the gotchas, and the current state so you don't have to re-derive everything.

---

## Tech stack

| Concern | Choice | Notes |
|---|---|---|
| Framework | [Astro](https://astro.build) v6 (static output) | `output: 'static'`, ships zero JS except small client islands |
| Styling | Tailwind CSS v4 | Via `@tailwindcss/vite` plugin (not the old PostCSS integration) |
| Language | TypeScript | Client scripts in `src/scripts/` |
| Hosting | GitHub Pages | Free; custom domain **karlkiser.com** is live (see `public/CNAME`) |
| SEO | JSON-LD + `@astrojs/sitemap` + robots.txt | Person/WebSite/ScholarlyArticle/patent schema; AI crawlers allowed |
| Analytics | GoatCounter | Free, cookieless; custom click events via `data-goatcounter-click` |
| Deploy CI | GitHub Actions | `.github/workflows/deploy.yml` |
| Background | Looping `<video>` + still frame | No canvas, no data, no timers |
| Email | [Resend](https://resend.com) free tier | Surf report only; needs `RESEND_API_KEY` secret |
| Data APIs | Open-Meteo (Marine + Weather), NOAA CO-OPS Tides | All free, no API key required |
| Surf face height | Surfline (free forecast JSON, snapshotted) | Via Playwright; see "Surfline snapshots" below |
| Headless browser | Playwright (Chromium) | Dev dependency; only used by the snapshot script/CI |
| Fonts | Space Grotesk (headings), DM Sans (body) | Variable fonts via Fontsource CDN |

**Node:** requires `>=22.12.0` (see `package.json` `engines`).

---

## Quick start

```bash
npm install        # install deps
npm run dev        # local dev server (http://localhost:4321)
npm run build      # production build into dist/
npm run preview    # preview the built site

# Preview the surf report email locally (prints HTML/text to stdout if no API key):
node scripts/surf-report.mjs

# Snapshot Surfline face-height data into public/data/surfline/ (needs Chromium):
npx playwright install chromium   # one-time
npm run surfline:snapshot
npm run surfline:discover -- "rockaway"   # find a spot's Surfline ID
```

Deployment is automatic: **push to `main`** and the GitHub Action builds and publishes to Pages. Do not hand-edit `dist/` (gitignored, build artifact).

---

## Project structure

```
personal_website/
├── astro.config.mjs            # site URL, static output, Tailwind plugin
├── package.json                # name: karl-kiser-site
├── public/
│   ├── favicon.svg             # "KK" monogram
│   ├── og-image.png            # 1200x630 social/link-preview card
│   └── robots.txt              # allows all + AI crawlers; points to sitemap
├── src/
│   ├── config/
│   │   └── site.ts              # SINGLE SOURCE OF TRUTH: identity, SEO, profiles, analytics code
│   ├── layouts/
│   │   └── BaseLayout.astro     # HTML shell + full SEO meta, JSON-LD, GoatCounter, global CSS
│   ├── components/
│   │   ├── Header.astro         # nav (Projects, CV, Publications, Patents, Swell, Contact) + mycelium glyph + mobile menu
│   │   ├── Footer.astro         # minimal footer (ambient conditions link + Privacy)
│   │   ├── OceanBackground.astro# looping water clip + still-frame fallback + scrim
│   │   └── MyceliumEasterEgg.astro # stumble-upon growth sim (dwell to seed, hold to enter)
│   ├── pages/
│   │   ├── index.astro          # landing: name, tagline, open-to, contact + profile links
│   │   ├── cv.astro             # professional summary, experience, skills, education
│   │   ├── publications.astro   # journal articles + conference abstracts (DOIs) + ScholarlyArticle JSON-LD
│   │   ├── patents.astro        # aerial mycelium patent + patent JSON-LD
│   │   ├── projects.astro       # project cards
│   │   ├── swell.astro          # interactive surf conditions page
│   │   ├── _golden-hour.astro   # SHELVED live sunset/sunrise beach cam (underscore = not routed)
│   │   ├── _mycelium-preview.astro # offline tuning bench for the easter egg (not routed)
│   │   ├── privacy.astro        # analytics privacy note
│   │   └── 404.astro            # static 404 (noindex)
│   ├── scripts/
│   │   ├── mycelium-growth.ts   # species/morphology presets for the easter egg
│   │   ├── mycelium-renderer.ts # Neighbour-Sensing growth sim (Canvas 2D)
│   │   ├── surf-spots.ts        # 16 surf spot defs + offshore-wind logic (+ surflineSpotId)
│   │   └── surf-page.ts         # /swell client island: fetch + render (Surfline-preferred)
│   └── styles/
│       └── global.css           # Tailwind import, @font-face, theme tokens
├── public/
│   └── data/surfline/<id>.json  # committed Surfline snapshots (face height)
├── scripts/
│   ├── surf-report.mjs          # standalone Node script → Resend email
│   └── surfline-snapshot.mjs    # Playwright snapshot of Surfline → public/data/surfline/
├── .github/workflows/
│   ├── deploy.yml               # build + deploy to Pages on push to main
│   ├── surf-report.yml          # daily cron (09:00 UTC) → runs surf-report.mjs
│   └── surfline-snapshot.yml    # cron → snapshot Surfline, commit, rebuild Pages
├── Career/                      # PRIVATE source docs (gitignored) — see below
└── scraper_reference/           # UNRELATED local project, untracked (see below)
```

### Directories that are NOT part of the deployed site
- **`Career/`** — ChatGPT-generated career research reports (`deep-research-report (1).md`, `(2).md`). These were the **source material** for the CV/Publications/Patents/Projects page content. Gitignored for privacy — never commit these to the public repo.
- **`scraper_reference/`** — A separate local project (`Kubota_search`, `listings_search` with a Python venv). It is **untracked and unrelated** to the website. It is *not* in `.gitignore`, so be careful not to `git add` it accidentally. Consider adding it to `.gitignore` if it should stay local.

---

## The ambient water background

The signature visual element: one looping, desaturated water clip
(`public/water/IMG_5047_twilight_mono.*`) behind every page, under a fixed
top-and-bottom gradient scrim that keeps text legible.

`OceanBackground.astro` is deliberately dumb — no canvas, no live data, no
timers. The still frame (`.jpg`) is a CSS `background-image` on the wrapper, and
an opaque `#0a0d12` sits behind *that*, so every failure mode degrades to the
same image with nothing to flash through:

| Condition | Result |
| --- | --- |
| Autoplay blocked (iOS low-power) | `poster` frame shows |
| Codec unsupported / decode hiccup | wrapper's background image shows |
| `prefers-reduced-motion: reduce` | video hidden via CSS, still frame shows |
| `navigator.connection.saveData` | `<video>` removed, still frame shows |

Text over it uses the static `--text-color` / `--text-shadow` tokens from
`global.css`.

> **History:** this used to be a Canvas engine whose palette and motion tracked
> live Rockaway swell/tide/wind data (`ocean-data.ts`, `ocean-palette.ts`,
> `ocean-renderer.ts`). It was removed in favour of the clip — the live surf data
> now lives only on `/swell` and in the daily email, which is where it reads as
> information rather than decoration.

---

## The `/swell` page

Interactive surf conditions for any of **16 spots** (NY, NJ, New England, Southeast, California, Hawaii). Pure client-side island — no server.

- **`surf-spots.ts`** — `SurfSpot` interface (`id, name, lat, lon, beachFacing, tidesStation, region, camUrl?`) plus:
  - `getWindType(windDir, beachFacing)` — generic offshore/onshore/cross via angle diff vs. the beach-facing direction (offshore when wind blows from land, i.e. ~opposite the facing direction).
  - `getDefaultSpot()` (Rockaway), `getSpotById(id)`, and the `SPOTS` array (sorted by region, then name).
  - Only Rockaway has a `camUrl` currently.
- **`surf.astro`** — static structure: spot `<select>` (grouped by region), an embedded **Windy.com** live wave/wind map iframe, current-conditions card, hourly breakdown (5–11 AM), 7-day forecast table, and a wave-height annotation footnote. Loading states render before data arrives.
- **`surf-page.ts`** — `initSurfPage()` populates the selector, honors `?spot=xxx` URL params (updates via `history.replaceState`), repositions the Windy map per spot, fetches the 5 endpoints with `Promise.allSettled`, and renders conditions/hourly/forecast with colored wind types (green offshore / red onshore), a highlighted "best window" row, and starred best days.

### Why Windy.com instead of a live cam
This was iterated on several times:
1. Tried embedding a Coastal Camera Network iframe → blocked (domain-restricted embed codes).
2. Tried their public snapshot JPEG with auto-refresh → the Rockaway endpoint returns **empty/0-byte** responses even in daylight; the camera appears decommissioned.
3. **Current solution:** embed an official, always-working **Windy.com** wave/wind map iframe (`buildWindyUrl(lat, lon)` in `surf-page.ts`) that re-centers on the selected spot. A "Watch surf cam ↗" link to nybeachcams.com is shown only for spots that have a `camUrl`.

If you want to add a real cam later, look for a provider with an **embeddable player URL** or a **public, CORS-enabled snapshot image** (`access-control-allow-origin: *`).

---

## Daily surf report email

`scripts/surf-report.mjs` is a **standalone Node script** (not part of the Astro build). It fetches 7-day marine/weather/tide data for Rockaway (`LAT 40.58`, `LON -73.82`, NOAA `8531680`), builds a styled HTML email (today's conditions, dawn-to-noon hourly breakdown with a "best window," and a 7-day look-ahead with starred best days), and sends via Resend.

- **Schedule:** `.github/workflows/surf-report.yml`, cron `0 9 * * *` (09:00 UTC ≈ 5 AM EDT). For EST you'd bump to `10 UTC`. Also manually runnable via `workflow_dispatch`.
- **Recipient / sender:** `to: karl.j.kiser@gmail.com`, `from: Rockaway Report <onboarding@resend.dev>`.
- **Secret:** requires `RESEND_API_KEY` in GitHub repo secrets. Without it, running locally just prints the email to stdout (handy for previewing).

### Wave height: Surfline face height (primary) → GFS Hs (fallback)
The user noticed Open-Meteo heights run higher than Surfline. Open-Meteo reports **significant wave height (Hs)** from the GFS Wave model (average of the tallest third of open-ocean waves), which reads ~20–35% higher than Surfline's bathymetry-adjusted **face height** for beachbreaks.

The fix is **Surfline-preferred with graceful fallback** (see "Surfline snapshots" below):
- When a fresh Surfline snapshot exists (`< 12 h` old), today's/near-term surf shows Surfline's breaking **face height** + plain-English `humanRelation` ("Thigh to waist") + AM/PM rating. This is closer to the real experience at the break.
- When no snapshot is available, it falls back to GFS Hs with the existing annotation.
- The **7-day look-ahead always uses GFS** (Surfline's free horizon is only ~3 days).

Both the email footer and the `/swell` footnote state which source is in use. Do not silently apply a correction factor to GFS — prefer the real Surfline number or label it honestly.

## Surfline snapshots

`scripts/surfline-snapshot.mjs` captures Surfline's **free** forecast data (face height, swells, wind, tides, weather, AM/PM rating) into `public/data/surfline/<spotId>.json`, which the `/swell` page and email read as a same-origin static asset.

**Why a snapshot (not a live fetch):** Surfline's API sits behind **Cloudflare bot protection** and serves **no cross-origin CORS headers**. So the browser can't fetch it from `/swell`, and even a server-side `fetch()` / hand-crafted request to `services.surfline.com` is WAF-blocked (HTTP 403) *even with a `cf_clearance` cookie*. The reliable path: drive a real **Chromium (Playwright)** to a public surf-report page and **intercept the forecast XHRs the Surfline app itself makes** (those are legitimate, first-party, and succeed). The script normalizes those payloads.

- **Spot IDs** live in `src/scripts/surf-spots.ts` as `surflineSpotId` (the single source of truth, shared with the browser). The ID is the trailing segment of any `surfline.com/surf-report/<slug>/<id>` URL — the slug is cosmetic, only the ID matters. Rockaway (NY) is `5842041f4e65fad6a7708852`. Find others with `npm run surfline:discover -- "<name>"`.
- **Units:** Surfline returns face height in FT and wind in **knots**; the script converts wind to MPH and collapses Surfline's verbose `directionType` to Offshore/Onshore/Cross.
- **Schedule:** `.github/workflows/surfline-snapshot.yml` (08:30 / 14:00 / 20:00 UTC). Because a commit made with the default `GITHUB_TOKEN` does **not** trigger the deploy workflow, this workflow is **self-contained**: it snapshots, commits the JSON, then builds and deploys Pages itself (shares the `pages` concurrency group with `deploy.yml`).
- **Cloudflare caveat / local fallback:** GitHub Actions runs on datacenter IPs that Cloudflare *may* challenge. The snapshot step is non-fatal (the site falls back to Open-Meteo if it fails). The most reliable path — and the one the user's other scrapers use — is to run it **locally on a residential connection** and push:
  ```bash
  npm run surfline:snapshot && git add public/data/surfline && git commit -m "refresh surfline" && git push
  ```
  Use `HEADED=1 npm run surfline:snapshot` to watch the browser while debugging.
- **ToS note:** scraping Surfline is against their terms; keep volume low (a few spots, a few times/day) for personal use.

---

## Conventions & gotchas

- **Deploy = push to `main`.** There is no separate publish step. The GitHub default "pages-build-deployment" check may show as failed/skipped — that's a harmless conflict with the custom Action; the `Deploy to GitHub Pages` workflow is the source of truth.
- **`site` in `astro.config.mjs`** is `https://karlkiser.com` (the live custom domain). Keep this correct or canonical/sitemap/OG URLs break.
- **Identity/SEO/analytics config** lives in `src/config/site.ts` — edit copy, profile links (`sameAs`), keywords, and the GoatCounter code there, not scattered across pages.
- **Tailwind v4** uses the Vite plugin + `@import "tailwindcss"` in `global.css` and a `@theme { ... }` block for tokens — not a `tailwind.config.js`.
- **Text legibility over the canvas** relies on the `--text-color` / `--text-shadow` vars set by `OceanBackground.astro`. New pages placed over the background should use `var(--text-color, ...)`.
- **Don't commit `Career/` or `scraper_reference/`.** The former is gitignored; the latter is not — watch out.
- **Surf data paths:** `scripts/surf-report.mjs` (Node, email) reads live Open-Meteo/NOAA. A second path — `scripts/surfline-snapshot.mjs` (Playwright, CI/local) — writes static Surfline JSON that both `surf-page.ts` and `surf-report.mjs` *prefer* when fresh. Keep the snapshot's normalized schema in sync with the consumers if you change it.
- **No comments that just narrate code** — keep them for intent/trade-offs only (existing house style).
- **Chat corpus is a third copy of the CV.** `worker/src/corpus.ts` hand-authors the CV narrative and the patent for the bot; update it alongside `CvSection.astro` and `cv/Karl-Kiser-CV.md`. Publications and `SITE.openTo` are imported from the real data modules and don't need syncing.

---

## "Ask about my experience" chat

A floating chat widget (`src/components/AskWidget.astro`, mounted from `BaseLayout`) lets visitors ask about Karl's background instead of reading every page. Because the site is static, the model call and the conversation log live in a separate Cloudflare Worker under `worker/` — see [`worker/README.md`](worker/README.md) for running it locally in free mock mode, deploying, reading logs, and the cost caps.

**One switch controls everything:** `SITE.chatEndpoint` in `src/config/site.ts`. Empty (the default) and the widget, its JavaScript, and the chat paragraph on `/privacy` are all absent from the build. Set `PUBLIC_CHAT_ENDPOINT` in a gitignored `.env` to point at a local worker without committing anything.

---

## Roadmap / ideas

- Optional: compress `og-image.png`, self-host fonts.
- (Settled) GoatCounter registered as `karlkiser`; ORCID/Scholar intentionally left blank in `src/config/site.ts`.
- More surf spots and/or a real embeddable live cam if a good source appears.

### Downloadable CV PDF
`public/Karl-Kiser-CV.pdf` is generated from `cv/Karl-Kiser-CV.md` (the PDF source) and linked from the homepage and `/cv`. The web CV (`src/pages/cv.astro`) and the markdown source are **separate** — keep them in sync. Regenerate the PDF after edits:
```bash
python3 /Users/karlkiser/Documents/Vehicles/_tools/md_to_pdf.py "cv/Karl-Kiser-CV.md" --output "public/Karl-Kiser-CV.pdf"
```
- Optionally let the surf report cover the user's currently selected spot rather than hardcoded Rockaway.

---

## Commit history landmarks

```
eccc8d3  Improve surf page readability — stronger contrast, larger text
50cc4a7  Replace broken surf cam with Windy.com live wave/wind map
def05b1  Add live snapshot surf cam with auto-refresh
3b2a60e  Replace iframe surf cam with external link card
21589ff  Add interactive surf conditions page with spot selector and live cam
5b8b31b  Add site navigation and daily surf report system
83ea156  Add CV, Publications, Patents, and Projects pages
0ba07e5  Remove header and footer from landing page for now
96c9f4b  Fix site URL to match GitHub username
ee77973  Initial personal website with ambient ocean background
```
