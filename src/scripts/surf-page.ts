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
}

let selector: HTMLSelectElement;
let camContainer: HTMLElement;
let camIframe: HTMLIFrameElement;
let spotNameEl: HTMLElement;
let dateEl: HTMLElement;
let conditionsGrid: HTMLElement;
let hourlyTable: HTMLTableElement;
let forecastTable: HTMLTableElement;

function $(id: string): HTMLElement {
  return document.getElementById(id)!;
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
  conditionsGrid.innerHTML = '<p style="opacity:0.4;" class="animate-pulse text-sm">Loading conditions...</p>';
  hourlyTable.innerHTML = '<tbody><tr><td style="opacity:0.4;padding:12px 0;" class="animate-pulse text-sm">Loading hourly data...</td></tr></tbody>';
  forecastTable.innerHTML = '<tbody><tr><td style="opacity:0.4;padding:12px 0;" class="animate-pulse text-sm">Loading forecast...</td></tr></tbody>';
}

function showError(msg: string): void {
  conditionsGrid.innerHTML = `<p style="opacity:0.5;" class="text-sm">${msg}</p>`;
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

function renderConditions(spot: SurfSpot, data: FetchedData): void {
  const md = data.marineDaily?.daily;
  const wd = data.weatherDaily?.daily;
  const tides = data.tides?.predictions;

  if (!md) {
    conditionsGrid.innerHTML = '<p style="opacity:0.5;" class="text-sm">Marine data unavailable.</p>';
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

  let tideStr = '—';
  if (tides && tides.length > 0) {
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayTides = tides.filter((t: any) => t.t.startsWith(todayStr));
    if (todayTides.length > 0) {
      tideStr = todayTides
        .map((t: any) => `${t.type === 'H' ? 'High' : 'Low'} ${formatTideTime(t.t)}`)
        .join(' · ');
    }
  }

  const wtColor = wt ? WIND_COLORS[wt] : 'inherit';
  const wtCheck = wt === 'Offshore' ? ' ✓' : '';

  const row = (label: string, value: string) =>
    `<div style="display:flex;gap:12px;align-items:baseline;">
      <span style="min-width:80px;opacity:0.4;font-size:13px;flex-shrink:0;">${label}</span>
      <span style="font-size:14px;">${value}</span>
    </div>`;

  conditionsGrid.innerHTML = [
    row('Surf', `<strong>${heightLo}–${heightHi} ft</strong> <span style="opacity:0.5;">(${swellCompass} swell @ ${Math.round(period)}s)</span>`),
    row('Wind', wt
      ? `${windCompass} ${Math.round(windSpeed!)} mph — <span style="color:${wtColor};">${wt}${wtCheck}</span>`
      : '—'),
    row('Tide', tideStr),
    row('Conditions', `<em>${verdict.summary}</em>`),
  ].join('');
}

function renderHourly(spot: SurfSpot, data: FetchedData): void {
  const mh = data.marineHourly?.hourly;
  const wh = data.weatherHourly?.hourly;

  if (!mh || !wh) {
    hourlyTable.innerHTML = '<tbody><tr><td style="opacity:0.4;padding:8px 0;" class="text-sm">Hourly data unavailable.</td></tr></tbody>';
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

  const headerStyle = 'padding:4px 10px;opacity:0.35;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;text-align:left;white-space:nowrap;';
  const cellStyle = 'padding:7px 10px;font-size:13px;white-space:nowrap;';

  let html = `<thead><tr>
    <th style="${headerStyle}">Time</th>
    <th style="${headerStyle}">Height</th>
    <th style="${headerStyle}">Wind</th>
    <th style="${headerStyle}">Type</th>
  </tr></thead><tbody>`;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const isBest = i === bestIdx;
    const bg = isBest ? 'background:rgba(255,255,255,0.05);' : '';
    const timeStr = `${r.hour > 12 ? r.hour - 12 : r.hour} ${r.hour >= 12 ? 'PM' : 'AM'}`;
    const typeColor = WIND_COLORS[r.windType];
    const marker = isBest ? '<span style="opacity:0.4;margin-left:6px;font-size:11px;">← best</span>' : '';

    html += `<tr style="${bg}">
      <td style="${cellStyle}opacity:0.5;">${timeStr}</td>
      <td style="${cellStyle}font-weight:600;">${r.waveFt.toFixed(1)} ft</td>
      <td style="${cellStyle}opacity:0.5;">${r.windDir} ${Math.round(r.windMph)} mph</td>
      <td style="${cellStyle}"><span style="color:${typeColor};">${r.windType}</span>${marker}</td>
    </tr>`;
  }

  html += '</tbody>';
  hourlyTable.innerHTML = html;
}

function renderForecast(spot: SurfSpot, data: FetchedData): void {
  const md = data.marineDaily?.daily;
  const wd = data.weatherDaily?.daily;

  if (!md) {
    forecastTable.innerHTML = '<tbody><tr><td style="opacity:0.4;padding:8px 0;" class="text-sm">Forecast data unavailable.</td></tr></tbody>';
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

  const headerStyle = 'padding:4px 10px;opacity:0.35;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;text-align:left;white-space:nowrap;';
  const cellStyle = 'padding:7px 10px;font-size:13px;white-space:nowrap;';

  let html = `<thead><tr>
    <th style="${headerStyle}">Day</th>
    <th style="${headerStyle}">Surf</th>
    <th style="${headerStyle}">Dir</th>
    <th style="${headerStyle}">Period</th>
    <th style="${headerStyle}">Wind</th>
    <th style="${headerStyle}">Type</th>
  </tr></thead><tbody>`;

  for (const d of days) {
    const isBest = bestDates.has(d.date);
    const bg = isBest ? 'background:rgba(255,255,255,0.05);' : '';
    const star = isBest ? ' <span style="color:#facc15;">★</span>' : '';
    const typeColor = WIND_COLORS[d.windType];

    html += `<tr style="${bg}">
      <td style="${cellStyle}">${shortDay(d.date)}${star}</td>
      <td style="${cellStyle}font-weight:600;">${d.lo}–${d.hi} ft</td>
      <td style="${cellStyle}opacity:0.5;">${d.swellDir}</td>
      <td style="${cellStyle}opacity:0.5;">${d.period}s</td>
      <td style="${cellStyle}opacity:0.5;">${d.windDir} ${d.windMph != null ? d.windMph + ' mph' : '—'}</td>
      <td style="${cellStyle}"><span style="color:${typeColor};">${d.windType}</span></td>
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

  if (spot.camUrl) {
    camContainer.classList.remove('hidden');
    camIframe.src = spot.camUrl;
  } else {
    camContainer.classList.add('hidden');
    camIframe.removeAttribute('src');
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
  camContainer = $('cam-container');
  camIframe = $('cam-iframe') as HTMLIFrameElement;
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
