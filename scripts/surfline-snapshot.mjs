#!/usr/bin/env node

// Snapshots Surfline's free forecast data to static files the site can read.
//
// Surfline sits behind Cloudflare bot protection and its API serves no
// cross-origin CORS headers, so neither the /surf page nor a plain fetch() can
// reach it, and hand-crafted requests to services.surfline.com get WAF-blocked
// even with a cf_clearance cookie. The reliable path is to drive a real Chromium
// to a public surf-report page and intercept the forecast XHRs the Surfline app
// itself makes (those are legitimate, first-party, and succeed). We normalize
// the captured payloads to public/data/surfline/<spotId>.json.
//
// Usage:
//   node scripts/surfline-snapshot.mjs                # snapshot all mapped spots
//   node scripts/surfline-snapshot.mjs --discover "rockaway"   # find spot IDs
//   HEADED=1 node scripts/surfline-snapshot.mjs       # show the browser (debug)
//
// Spot IDs live in src/scripts/surf-spots.ts (the surflineSpotId field) so that
// file stays the single source of truth shared with the browser consumer. The
// spot ID is also visible in any Surfline report URL:
//   surfline.com/surf-report/<slug>/<THIS-IS-THE-ID>

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SPOTS_TS = join(ROOT, 'src', 'scripts', 'surf-spots.ts');
const OUT_DIR = join(ROOT, 'public', 'data', 'surfline');

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const KTS_TO_MPH = 1.150779;
const KMH_TO_MPH = 0.621371;
const CAPTURE_TIMEOUT_MS = 20000;

function readMappedSpotIds() {
  let src = '';
  try {
    src = readFileSync(SPOTS_TS, 'utf8');
  } catch {
    return [];
  }
  const ids = new Set();
  const re = /surflineSpotId\s*:\s*['"]([a-f0-9]{16,})['"]/gi;
  let m;
  while ((m = re.exec(src))) ids.add(m[1]);
  return [...ids];
}

async function launch() {
  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    console.error(
      'Playwright is not installed. Run:\n  npm install -D playwright\n  npx playwright install chromium',
    );
    process.exit(1);
  }
  const browser = await chromium.launch({
    headless: process.env.HEADED ? false : true,
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
  });
  const context = await browser.newContext({
    userAgent: USER_AGENT,
    viewport: { width: 1280, height: 800 },
    locale: 'en-US',
    timezoneId: 'America/New_York',
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });
  return { browser, context };
}

// Navigate to a spot's report page and collect the forecast XHRs it fires.
async function captureSpot(context, spotId) {
  const page = await context.newPage();
  const captured = {};
  let resolveEssential;
  const essential = new Promise((r) => (resolveEssential = r));

  page.on('response', async (res) => {
    const match = res.url().match(/kbyg\/spots\/forecasts\/([a-z]+)/i);
    if (!match) return;
    try {
      captured[match[1]] = await res.json();
    } catch {
      return;
    }
    if (captured.surf && captured.wind) resolveEssential();
  });

  try {
    await page.goto(`https://www.surfline.com/surf-report/x/${spotId}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await Promise.race([
      essential,
      page.waitForTimeout(CAPTURE_TIMEOUT_MS),
    ]);
    // Give secondary feeds (swells/rating/tides/weather) a moment to arrive.
    await page.waitForTimeout(2500);
    return captured;
  } finally {
    await page.close();
  }
}

function windToMph(speed, unit) {
  if (speed == null) return null;
  if (/kts|knot/i.test(unit || '')) return round1(speed * KTS_TO_MPH);
  if (/kmh|kph/i.test(unit || '')) return round1(speed * KMH_TO_MPH);
  return round1(speed);
}

function round1(n) {
  return n == null ? null : Math.round(n * 10) / 10;
}

// Surfline directionType is verbose ("Cross-shore/onshore"); collapse to the
// three buckets the site already color-codes.
function normalizeWindType(directionType) {
  if (!directionType) return null;
  const d = directionType.toLowerCase();
  if (d.includes('offshore')) return 'Offshore';
  if (d.includes('onshore')) return 'Onshore';
  return 'Cross';
}

function ratingLabel(key) {
  if (!key) return null;
  return key
    .toLowerCase()
    .split('_')
    .map((w) => (w === 'to' ? 'to' : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

function primarySwell(entry) {
  const swells = entry?.swells;
  if (!Array.isArray(swells)) return null;
  const best = swells
    .filter((s) => s && s.height > 0)
    .sort((a, b) => (b.power || b.height || 0) - (a.power || a.height || 0))[0];
  if (!best) return null;
  return {
    height: round1(best.height),
    period: Math.round(best.period ?? 0),
    direction: Math.round(best.direction ?? 0),
  };
}

function nearestNowIndex(timestamps) {
  const now = Date.now() / 1000;
  let best = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < timestamps.length; i++) {
    const diff = Math.abs(timestamps[i] - now);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = i;
    }
  }
  return best;
}

function normalize(spotId, cap) {
  const surfArr = cap.surf?.data?.surf ?? [];
  const windArr = cap.wind?.data?.wind ?? [];
  const swellArr = cap.swells?.data?.swells ?? [];
  const ratingArr = cap.rating?.data?.rating ?? [];
  const tideArr = cap.tides?.data?.tides ?? [];
  const weatherArr = cap.weather?.data?.weather ?? [];

  const windUnit = cap.wind?.associated?.units?.windSpeed;
  const location = cap.surf?.associated?.location ?? cap.wind?.associated?.location ?? null;

  const byTs = (arr) => {
    const m = new Map();
    for (const e of arr) m.set(e.timestamp, e);
    return m;
  };
  const windMap = byTs(windArr);
  const swellMap = byTs(swellArr);
  const ratingMap = byTs(ratingArr);
  const weatherMap = byTs(weatherArr);

  const hourly = surfArr.map((s) => {
    const wind = windMap.get(s.timestamp);
    const swell = primarySwell(swellMap.get(s.timestamp));
    const rating = ratingMap.get(s.timestamp)?.rating;
    const weather = weatherMap.get(s.timestamp);
    return {
      timestamp: s.timestamp,
      utcOffset: s.utcOffset,
      surfMin: round1(s.surf?.min),
      surfMax: round1(s.surf?.max),
      humanRelation: s.surf?.humanRelation ?? null,
      windSpeed: windToMph(wind?.speed, windUnit),
      windDirection: wind?.direction != null ? Math.round(wind.direction) : null,
      windType: normalizeWindType(wind?.directionType),
      swell,
      ratingKey: rating?.key ?? null,
      airTemp: weather?.temperature != null ? Math.round(weather.temperature) : null,
    };
  });

  const idx = surfArr.length ? nearestNowIndex(surfArr.map((s) => s.timestamp)) : 0;
  const current = hourly[idx] ?? null;
  const currentRating = current ? ratingMap.get(current.timestamp)?.rating : null;

  const tides = tideArr
    .filter((t) => t.type === 'HIGH' || t.type === 'LOW')
    .map((t) => ({ timestamp: t.timestamp, type: t.type, height: round1(t.height) }));

  return {
    fetchedAt: new Date().toISOString(),
    spotId,
    source: 'surfline',
    location,
    units: { height: 'FT', wind: 'MPH', temp: 'F' },
    current: current
      ? { ...current, rating: ratingLabel(currentRating?.key), ratingValue: currentRating?.value ?? null }
      : null,
    hourly,
    tides,
  };
}

async function snapshot() {
  const spotIds = readMappedSpotIds();
  if (spotIds.length === 0) {
    console.error(
      'No surflineSpotId values found in src/scripts/surf-spots.ts.\n' +
        'Add one (find IDs via --discover "<name>", or copy from a Surfline report URL).',
    );
    process.exit(1);
  }

  mkdirSync(OUT_DIR, { recursive: true });
  const { browser, context } = await launch();
  let ok = 0;

  try {
    for (const spotId of spotIds) {
      try {
        const cap = await captureSpot(context, spotId);
        if (!cap.surf || !cap.wind) {
          console.warn(`  ! ${spotId}: essential feeds missing (likely a Cloudflare block)`);
          continue;
        }
        const normalized = normalize(spotId, cap);
        writeFileSync(join(OUT_DIR, `${spotId}.json`), JSON.stringify(normalized, null, 2));
        const c = normalized.current;
        console.log(
          `  \u2713 ${spotId}: ${c ? `${c.surfMin}-${c.surfMax}ft, ${c.humanRelation ?? '—'}` : 'written'}` +
            `${c?.rating ? ` (${c.rating})` : ''}`,
        );
        ok++;
      } catch (err) {
        console.warn(`  ! ${spotId}: ${err.message}`);
      }
    }
  } finally {
    await browser.close();
  }

  console.log(`\nSnapshot complete: ${ok}/${spotIds.length} spots written to public/data/surfline/`);
  if (ok === 0) process.exit(2);
}

async function discover(query) {
  const { browser, context } = await launch();
  const page = await context.newPage();
  let searchJson = null;
  page.on('response', async (res) => {
    if (res.url().includes('/search/site')) {
      try {
        searchJson = await res.json();
      } catch {
        /* ignore */
      }
    }
  });

  try {
    await page.goto('https://www.surfline.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(3000);
    const triggers = [
      'button[aria-label*="search" i]',
      '[data-testid*="search" i] button',
      'button:has(svg[aria-label*="search" i])',
    ];
    for (const t of triggers) {
      const el = await page.$(t);
      if (el) {
        await el.click().catch(() => {});
        break;
      }
    }
    const inputs = ['input[type=search]', 'input[placeholder*="Search" i]', 'input[name*="search" i]'];
    let typed = false;
    for (const s of inputs) {
      const el = await page.$(s);
      if (el) {
        await el.click();
        await el.type(query, { delay: 90 });
        typed = true;
        break;
      }
    }
    if (typed) await page.waitForTimeout(5000);

    const hits = [];
    for (const block of Array.isArray(searchJson) ? searchJson : []) {
      for (const h of block?.hits?.hits ?? []) {
        const s = h._source ?? {};
        if (h._type === 'spot' || s.type === 'spot' || s.breadCrumbs) {
          hits.push({ id: h._id, name: s.name ?? '(unknown)', bc: (s.breadCrumbs ?? []).join(' > ') });
        }
      }
    }

    if (hits.length) {
      console.log(`\nMatches for "${query}":\n`);
      for (const h of hits) console.log(`  ${h.id}   ${h.name}${h.bc ? `  (${h.bc})` : ''}`);
      console.log('\nAdd the chosen id as surflineSpotId in src/scripts/surf-spots.ts.');
    } else {
      console.log(
        `\nCould not capture search results automatically.\n` +
          `Manual method: search "${query}" on surfline.com, open the spot, and copy the ID\n` +
          `from the report URL: surfline.com/surf-report/<slug>/<THIS-IS-THE-ID>`,
      );
    }
  } finally {
    await browser.close();
  }
}

const args = process.argv.slice(2);
const discoverIdx = args.indexOf('--discover');

if (discoverIdx !== -1) {
  const query = args[discoverIdx + 1];
  if (!query) {
    console.error('Usage: node scripts/surfline-snapshot.mjs --discover "<spot name>"');
    process.exit(1);
  }
  discover(query).catch((err) => {
    console.error('Discover failed:', err.message);
    process.exit(1);
  });
} else {
  snapshot().catch((err) => {
    console.error('Snapshot failed:', err.message);
    process.exit(1);
  });
}
