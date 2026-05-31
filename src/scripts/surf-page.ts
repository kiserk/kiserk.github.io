import { SPOTS, getDefaultSpot, getSpotById, getWindType, type SurfSpot } from './surf-spots';

const M_TO_FT = 3.281;
const KMH_TO_MPH = 1 / 1.609;
const COMPASS = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
const WIND_COLORS: Record<string, string> = { Offshore: '#4ade80', Onshore: '#f87171', Cross: 'inherit' };

function metersToFeet(m: number | null): number {
  return m != null ? m * M_TO_FT : 0;
}

function kmhToMph(kmh: number | null): number {
  return kmh != null ? kmh * KMH_TO_MPH : 0;
}

function degreesToCompass(deg: number | null): string {
  if (deg == null) return '—';
  return COMPASS[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16];
}

function formatTideTime(tStr: string): string {
  const d = new Date(tStr.replace(' ', 'T'));
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function yyyymmdd(offset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

function shortDay(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
}

function surfVerdict(
  heightM: number,
  windDir: number | null,
  periodS: number,
  beachFacing: number,
): { label: string; summary: string } {
  const ft = metersToFeet(heightM);
  const lo = Math.max(1, Math.floor(ft));
  const hi = Math.max(1, Math.ceil(ft + 0.3));
  const range = `${lo}-${hi}ft`;
  const wt = windDir != null ? getWindType(windDir, beachFacing) : 'Cross';

  if (heightM < 0.3) return { label: 'Flat', summary: 'Flat. Rest day.' };
  if (wt === 'Offshore' && periodS > 10 && heightM > 0.6)
    return { label: 'Clean', summary: `Clean ${range} on long-period swell. Get out there.` };
  if (wt === 'Offshore')
    return { label: 'Clean', summary: `Clean ${range} but short period. Worth a paddle.` };
  if (wt === 'Cross' && heightM > 0.3)
    return { label: 'Decent', summary: `${range} with light winds. Decent session.` };
  if (wt === 'Onshore')
    return { label: 'Choppy', summary: `${range} but choppy with onshore winds. Manage expectations.` };
  return { label: 'Mixed', summary: `${range}. Mixed conditions.` };
}

interface FetchedData {
  marineDaily?: any;
  marineHourly?: any;
  weatherDaily?: any;
  weatherHourly?: any;
  tides?: any;
  surfline?: any;
}

const SURFLINE_MAX_AGE_MS = 12 * 60 * 60 * 1000;
const NY_TZ = 'America/New_York';

// Surfline snapshots are bathymetry-adjusted face height; prefer them when fresh.
function freshSurfline(data: FetchedData): any | null {
  const s = data.surfline;
  if (!s || !s.current || !s.fetchedAt) return null;
  if (Date.now() - new Date(s.fetchedAt).getTime() > SURFLINE_MAX_AGE_MS) return null;
  return s;
}

function relativeTime(iso: string): string {
  const diffMin = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 60) return `${Math.max(1, diffMin)}m ago`;
  return `${Math.round(diffMin / 60)}h ago`;
}

function formatTodayTides(data: FetchedData): string {
  const tides = data.tides?.predictions;
  if (!tides || tides.length === 0) return '—';
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayTides = tides.filter((t: any) => t.t.startsWith(todayStr));
  if (todayTides.length === 0) return '—';
  return todayTides
    .map((t: any) => `${t.type === 'H' ? 'High' : 'Low'} ${formatTideTime(t.t)}`)
    .join(' · ');
}

function sourceNote(label: string): string {
  return `<div style="margin-top:12px;font-size:12px;color:var(--ink-faint);">${label}</div>`;
}

let selector: HTMLSelectElement;
let windyMap: HTMLIFrameElement;
let camLink: HTMLAnchorElement;
let spotNameEl: HTMLElement;
let dateEl: HTMLElement;
let conditionsGrid: HTMLElement;
let hourlyTable: HTMLTableElement;
let forecastTable: HTMLTableElement;

function $(id: string): HTMLElement {
  return document.getElementById(id)!;
}

function buildWindyUrl(lat: number, lon: number): string {
  return `https://embed.windy.com/embed.html?type=map&location=coordinates&metricWind=mph&metricTemp=%C2%B0F&zoom=10&overlay=waves&product=ecmwf&level=surface&lat=${lat}&lon=${lon}&marker=true&calendar=now&message=true&pressure=false`;
}

function populateSelector(): void {
  selector = $(  'spot-selector') as HTMLSelectElement;
  selector.innerHTML = '';

  const regions = new Map<string, SurfSpot[]>();
  for (const spot of SPOTS) {
    if (!regions.has(spot.region)) regions.set(spot.region, []);
    regions.get(spot.region)!.push(spot);
  }

  for (const [region, spots] of regions) {
    const group = document.createElement('optgroup');
    group.label = region;
    for (const spot of spots) {
      const opt = document.createElement('option');
      opt.value = spot.id;
      opt.textContent = spot.name;
      group.appendChild(opt);
    }
    selector.appendChild(group);
  }
}

function showLoading(): void {
  conditionsGrid.innerHTML = '<p style="color:var(--ink-faint);" class="animate-pulse text-base">Loading conditions...</p>';
  hourlyTable.innerHTML = '<tbody><tr><td style="color:var(--ink-faint);padding:12px 0;" class="animate-pulse text-base">Loading hourly data...</td></tr></tbody>';
  forecastTable.innerHTML = '<tbody><tr><td style="color:var(--ink-faint);padding:12px 0;" class="animate-pulse text-base">Loading forecast...</td></tr></tbody>';
}

function showError(msg: string): void {
  conditionsGrid.innerHTML = `<p style="color:var(--ink-muted);" class="text-base">${msg}</p>`;
  hourlyTable.innerHTML = '';
  forecastTable.innerHTML = '';
}

async function fetchSpotData(spot: SurfSpot): Promise<FetchedData> {
  const { lat, lon, tidesStation } = spot;
  const today = yyyymmdd(0);
  const tomorrow = yyyymmdd(1);

  const urls: Record<string, string> = {
    marineDaily: `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}&daily=wave_height_max,swell_wave_height_max,wave_period_max,wave_direction_dominant,swell_wave_direction_dominant&models=ncep_gfswave016&timezone=America%2FNew_York&forecast_days=8`,
    marineHourly: `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}&hourly=wave_height,swell_wave_height,wave_period,wave_direction&models=ncep_gfswave016&timezone=America%2FNew_York&forecast_days=1`,
    weatherDaily: `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=wind_speed_10m_max,wind_direction_10m_dominant,temperature_2m_max,temperature_2m_min&timezone=America%2FNew_York&forecast_days=8`,
    weatherHourly: `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=wind_speed_10m,wind_direction_10m&timezone=America%2FNew_York&forecast_days=1`,
    tides: `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?station=${tidesStation}&product=predictions&begin_date=${today}&end_date=${tomorrow}&datum=MLLW&time_zone=lst_ldt&units=english&interval=hilo&application=KarlKiserSurf&format=json`,
  };

  // Static Surfline snapshot (face height) — same-origin, no CORS/Cloudflare for visitors.
  if (spot.surflineSpotId) {
    urls.surfline = `${import.meta.env.BASE_URL}data/surfline/${spot.surflineSpotId}.json`;
  }

  const entries = Object.entries(urls);
  const results = await Promise.allSettled(
    entries.map(async ([key, url]) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return [key, await res.json()] as [string, any];
    }),
  );

  const data: FetchedData = {};
  for (const r of results) {
    if (r.status === 'fulfilled') {
      const [key, val] = r.value;
      (data as any)[key] = val;
    }
  }
  return data;
}

const condRow = (label: string, value: string) =>
  `<div style="display:flex;gap:16px;align-items:baseline;padding:5px 0;">
      <span style="min-width:90px;color:var(--ink-faint);font-size:15px;flex-shrink:0;font-weight:400;text-transform:uppercase;letter-spacing:0.06em;">${label}</span>
      <span style="font-size:16px;line-height:1.5;color:var(--ink);">${value}</span>
    </div>`;

function renderConditions(spot: SurfSpot, data: FetchedData): void {
  const sl = freshSurfline(data);
  if (sl) {
    const c = sl.current;
    const swellCompass = degreesToCompass(c.swell?.direction ?? null);
    const wt = c.windType as ReturnType<typeof getWindType> | null;
    const wtColor = wt ? WIND_COLORS[wt] : 'inherit';
    const wtCheck = wt === 'Offshore' ? ' ✓' : '';
    const windStr =
      c.windSpeed != null
        ? `${degreesToCompass(c.windDirection)} ${Math.round(c.windSpeed)} mph${
            wt ? ` — <span style="color:${wtColor};font-weight:600;">${wt}${wtCheck}</span>` : ''
          }`
        : '—';
    const swellStr = c.swell
      ? `${swellCompass} @ ${c.swell.period}s${c.swell.height != null ? ` · ${c.swell.height} ft` : ''}`
      : '—';

    conditionsGrid.innerHTML =
      [
        condRow(
          'Surf',
          `<strong style="font-size:18px;">${c.surfMin}–${c.surfMax} ft</strong>${
            c.humanRelation
              ? ` <span style="color:var(--ink-muted);font-size:15px;margin-left:4px;">${c.humanRelation}</span>`
              : ''
          }`,
        ),
        condRow('Swell', swellStr),
        condRow('Wind', windStr),
        condRow('Tide', formatTodayTides(data)),
        condRow('Rating', c.rating ? `<em style="color:var(--ink-muted);">${c.rating}</em>` : '—'),
      ].join('') + sourceNote(`via Surfline · face height · updated ${relativeTime(sl.fetchedAt)}`);
    return;
  }

  const md = data.marineDaily?.daily;
  const wd = data.weatherDaily?.daily;

  if (!md) {
    conditionsGrid.innerHTML = '<p style="color:var(--ink-muted);" class="text-base">Marine data unavailable.</p>';
    return;
  }

  const waveH = md.wave_height_max[0];
  const period = md.wave_period_max[0];
  const swellDir = md.swell_wave_direction_dominant[0];
  const windSpeed = wd ? kmhToMph(wd.wind_speed_10m_max[0]) : null;
  const windDir = wd ? wd.wind_direction_10m_dominant[0] : null;

  const heightFt = metersToFeet(waveH);
  const heightLo = Math.max(1, Math.floor(heightFt));
  const heightHi = Math.max(1, Math.ceil(heightFt + 0.3));
  const swellCompass = degreesToCompass(swellDir);
  const windCompass = degreesToCompass(windDir);
  const wt = windDir != null ? getWindType(windDir, spot.beachFacing) : null;
  const verdict = surfVerdict(waveH, windDir, period, spot.beachFacing);

  const wtColor = wt ? WIND_COLORS[wt] : 'inherit';
  const wtCheck = wt === 'Offshore' ? ' ✓' : '';

  conditionsGrid.innerHTML =
    [
      condRow('Surf', `<strong style="font-size:18px;">${heightLo}–${heightHi} ft</strong> <span style="color:var(--ink-muted);font-size:15px;margin-left:4px;">${swellCompass} swell @ ${Math.round(period)}s</span>`),
      condRow('Wind', wt
        ? `${windCompass} ${Math.round(windSpeed!)} mph — <span style="color:${wtColor};font-weight:600;">${wt}${wtCheck}</span>`
        : '—'),
      condRow('Tide', formatTodayTides(data)),
      condRow('Conditions', `<em style="color:var(--ink-muted);">${verdict.summary}</em>`),
    ].join('') + sourceNote('GFS significant wave height (Hs) · open-ocean estimate');
}

const HOURLY_HEADER_STYLE = 'padding:6px 12px;color:var(--ink-faint);font-size:12px;text-transform:uppercase;letter-spacing:0.08em;text-align:left;white-space:nowrap;font-weight:500;';
const HOURLY_CELL_STYLE = 'padding:10px 12px;font-size:15px;white-space:nowrap;color:var(--ink);';

// Surfline hourly (face height) for today's dawn-to-noon window. Returns false
// if the snapshot has no rows for today, so the caller can fall back.
function renderHourlySurfline(sl: any): boolean {
  interface SLRow {
    hour: number;
    surfMin: number;
    surfMax: number;
    windMph: number | null;
    windDir: string;
    windType: ReturnType<typeof getWindType> | null;
    score: number;
  }

  const todayNY = new Date().toLocaleDateString('en-US', { timeZone: NY_TZ });
  const rows: SLRow[] = [];
  for (const e of sl.hourly ?? []) {
    const d = new Date(e.timestamp * 1000);
    if (d.toLocaleDateString('en-US', { timeZone: NY_TZ }) !== todayNY) continue;
    const hour = parseInt(d.toLocaleString('en-US', { timeZone: NY_TZ, hour: 'numeric', hour12: false }), 10);
    if (hour < 5 || hour > 11) continue;
    const wt = (e.windType ?? null) as ReturnType<typeof getWindType> | null;
    rows.push({
      hour,
      surfMin: e.surfMin,
      surfMax: e.surfMax,
      windMph: e.windSpeed,
      windDir: degreesToCompass(e.windDirection),
      windType: wt,
      score: (e.surfMax ?? 0) * (wt === 'Offshore' ? 1.5 : wt === 'Onshore' ? 0.7 : 1.0),
    });
  }
  if (rows.length === 0) return false;

  let bestIdx = 0;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].score > rows[bestIdx].score) bestIdx = i;
  }

  let html = `<thead><tr>
    <th style="${HOURLY_HEADER_STYLE}">Time</th>
    <th style="${HOURLY_HEADER_STYLE}">Height</th>
    <th style="${HOURLY_HEADER_STYLE}">Wind</th>
    <th style="${HOURLY_HEADER_STYLE}">Type</th>
  </tr></thead><tbody>`;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const isBest = i === bestIdx;
    const bg = isBest ? 'background:rgba(255,255,255,0.08);border-radius:8px;' : '';
    const timeStr = `${r.hour > 12 ? r.hour - 12 : r.hour} ${r.hour >= 12 ? 'PM' : 'AM'}`;
    const typeColor = r.windType ? WIND_COLORS[r.windType] : 'inherit';
    const marker = isBest ? '<span style="color:var(--ink-faint);margin-left:8px;font-size:12px;">← best</span>' : '';
    const windCell = r.windMph != null ? `${r.windDir} ${Math.round(r.windMph)} mph` : '—';
    const typeCell = r.windType
      ? `<span style="color:${typeColor};font-weight:600;">${r.windType}</span>`
      : '—';

    html += `<tr style="${bg}">
      <td style="${HOURLY_CELL_STYLE}color:var(--ink-muted);">${timeStr}</td>
      <td style="${HOURLY_CELL_STYLE}font-weight:600;">${r.surfMin}–${r.surfMax} ft</td>
      <td style="${HOURLY_CELL_STYLE}color:var(--ink-muted);">${windCell}</td>
      <td style="${HOURLY_CELL_STYLE}">${typeCell}${marker}</td>
    </tr>`;
  }

  html += '</tbody>';
  hourlyTable.innerHTML = html;
  return true;
}

function renderHourly(spot: SurfSpot, data: FetchedData): void {
  const sl = freshSurfline(data);
  if (sl && renderHourlySurfline(sl)) return;

  const mh = data.marineHourly?.hourly;
  const wh = data.weatherHourly?.hourly;

  if (!mh || !wh) {
    hourlyTable.innerHTML = '<tbody><tr><td style="color:var(--ink-faint);padding:12px 0;" class="text-base">Hourly data unavailable.</td></tr></tbody>';
    return;
  }

  interface HourRow {
    hour: number;
    waveFt: number;
    windMph: number;
    windDir: string;
    windType: ReturnType<typeof getWindType>;
    score: number;
  }

  const rows: HourRow[] = [];
  for (let h = 5; h <= 11; h++) {
    const waveH = metersToFeet(mh.wave_height[h]);
    const windS = kmhToMph(wh.wind_speed_10m[h]);
    const windD = wh.wind_direction_10m[h];
    const wType = getWindType(windD, spot.beachFacing);
    rows.push({
      hour: h,
      waveFt: waveH,
      windMph: windS,
      windDir: degreesToCompass(windD),
      windType: wType,
      score: waveH * (wType === 'Offshore' ? 1.5 : wType === 'Cross' ? 1.0 : 0.7),
    });
  }

  let bestIdx = 0;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].score > rows[bestIdx].score) bestIdx = i;
  }

  const headerStyle = 'padding:6px 12px;color:var(--ink-faint);font-size:12px;text-transform:uppercase;letter-spacing:0.08em;text-align:left;white-space:nowrap;font-weight:500;';
  const cellStyle = 'padding:10px 12px;font-size:15px;white-space:nowrap;color:var(--ink);';

  let html = `<thead><tr>
    <th style="${headerStyle}">Time</th>
    <th style="${headerStyle}">Height</th>
    <th style="${headerStyle}">Wind</th>
    <th style="${headerStyle}">Type</th>
  </tr></thead><tbody>`;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const isBest = i === bestIdx;
    const bg = isBest ? 'background:rgba(255,255,255,0.08);border-radius:8px;' : '';
    const timeStr = `${r.hour > 12 ? r.hour - 12 : r.hour} ${r.hour >= 12 ? 'PM' : 'AM'}`;
    const typeColor = WIND_COLORS[r.windType];
    const marker = isBest ? '<span style="color:var(--ink-faint);margin-left:8px;font-size:12px;">← best</span>' : '';

    html += `<tr style="${bg}">
      <td style="${cellStyle}color:var(--ink-muted);">${timeStr}</td>
      <td style="${cellStyle}font-weight:600;">${r.waveFt.toFixed(1)} ft</td>
      <td style="${cellStyle}color:var(--ink-muted);">${r.windDir} ${Math.round(r.windMph)} mph</td>
      <td style="${cellStyle}"><span style="color:${typeColor};font-weight:600;">${r.windType}</span>${marker}</td>
    </tr>`;
  }

  html += '</tbody>';
  hourlyTable.innerHTML = html;
}

function renderForecast(spot: SurfSpot, data: FetchedData): void {
  const md = data.marineDaily?.daily;
  const wd = data.weatherDaily?.daily;

  if (!md) {
    forecastTable.innerHTML = '<tbody><tr><td style="color:var(--ink-faint);padding:12px 0;" class="text-base">Forecast data unavailable.</td></tr></tbody>';
    return;
  }

  interface DayRow {
    date: string;
    lo: number;
    hi: number;
    swellDir: string;
    period: number;
    windMph: number | null;
    windDir: string;
    windType: ReturnType<typeof getWindType>;
    score: number;
  }

  const days: DayRow[] = [];
  for (let i = 1; i < md.time.length && i <= 7; i++) {
    const waveH = md.wave_height_max[i];
    const ft = metersToFeet(waveH);
    const windDirDeg = wd ? wd.wind_direction_10m_dominant[i] : null;
    const windSpd = wd ? kmhToMph(wd.wind_speed_10m_max[i]) : null;
    const period = md.wave_period_max[i];
    const wType = windDirDeg != null ? getWindType(windDirDeg, spot.beachFacing) : 'Cross';

    days.push({
      date: md.time[i],
      lo: Math.max(1, Math.floor(ft - 0.3)),
      hi: Math.max(1, Math.ceil(ft + 0.3)),
      swellDir: degreesToCompass(md.swell_wave_direction_dominant[i]),
      period: Math.round(period),
      windMph: windSpd != null ? Math.round(windSpd) : null,
      windDir: degreesToCompass(windDirDeg),
      windType: wType,
      score: ft * (wType === 'Offshore' ? 1.5 : wType === 'Cross' ? 1.0 : 0.7) + (period || 0) * 0.3,
    });
  }

  const sorted = [...days].sort((a, b) => b.score - a.score);
  const bestDates = new Set(sorted.slice(0, 2).filter(d => d.score > 3).map(d => d.date));

  const fHeaderStyle = 'padding:6px 12px;color:var(--ink-faint);font-size:12px;text-transform:uppercase;letter-spacing:0.08em;text-align:left;white-space:nowrap;font-weight:500;';
  const fCellStyle = 'padding:10px 12px;font-size:15px;white-space:nowrap;color:var(--ink);';

  let html = `<thead><tr>
    <th style="${fHeaderStyle}">Day</th>
    <th style="${fHeaderStyle}">Surf</th>
    <th style="${fHeaderStyle}">Dir</th>
    <th style="${fHeaderStyle}">Period</th>
    <th style="${fHeaderStyle}">Wind</th>
    <th style="${fHeaderStyle}">Type</th>
  </tr></thead><tbody>`;

  for (const d of days) {
    const isBest = bestDates.has(d.date);
    const bg = isBest ? 'background:rgba(255,255,255,0.08);border-radius:8px;' : '';
    const star = isBest ? ' <span style="color:#facc15;">★</span>' : '';
    const typeColor = WIND_COLORS[d.windType];

    html += `<tr style="${bg}">
      <td style="${fCellStyle}">${shortDay(d.date)}${star}</td>
      <td style="${fCellStyle}font-weight:600;">${d.lo}–${d.hi} ft</td>
      <td style="${fCellStyle}color:var(--ink-muted);">${d.swellDir}</td>
      <td style="${fCellStyle}color:var(--ink-muted);">${d.period}s</td>
      <td style="${fCellStyle}color:var(--ink-muted);">${d.windDir} ${d.windMph != null ? d.windMph + ' mph' : '—'}</td>
      <td style="${fCellStyle}"><span style="color:${typeColor};font-weight:600;">${d.windType}</span></td>
    </tr>`;
  }

  html += '</tbody>';
  forecastTable.innerHTML = html;
}

async function loadSpot(spot: SurfSpot): Promise<void> {
  spotNameEl.textContent = spot.name;
  dateEl.textContent = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  windyMap.src = buildWindyUrl(spot.lat, spot.lon);

  if (spot.camUrl) {
    camLink.href = spot.camUrl;
    camLink.classList.remove('hidden');
  } else {
    camLink.classList.add('hidden');
  }

  showLoading();

  try {
    const data = await fetchSpotData(spot);
    if (!data.marineDaily && !data.weatherDaily && !data.tides) {
      showError('Unable to load conditions. Please try again.');
      return;
    }
    renderConditions(spot, data);
    renderHourly(spot, data);
    renderForecast(spot, data);
  } catch {
    showError('Unable to load conditions. Please try again.');
  }
}

export function initSurfPage(): void {
  windyMap = $('windy-map') as HTMLIFrameElement;
  camLink = $('cam-link') as HTMLAnchorElement;
  spotNameEl = $('spot-name');
  dateEl = $('current-date');
  conditionsGrid = $('conditions-grid');
  hourlyTable = $('hourly-table') as HTMLTableElement;
  forecastTable = $('forecast-table') as HTMLTableElement;

  populateSelector();

  const params = new URLSearchParams(window.location.search);
  const spotParam = params.get('spot');
  const initialSpot = (spotParam && getSpotById(spotParam)) || getDefaultSpot();

  selector.value = initialSpot.id;
  loadSpot(initialSpot);

  selector.addEventListener('change', () => {
    const spot = getSpotById(selector.value);
    if (!spot) return;
    const url = new URL(window.location.href);
    url.searchParams.set('spot', spot.id);
    history.replaceState(null, '', url.toString());
    loadSpot(spot);
  });
}
