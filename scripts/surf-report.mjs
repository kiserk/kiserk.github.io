#!/usr/bin/env node

const LAT = 40.58;
const LON = -73.82;
const NOAA_STATION = '8531680';
const M_TO_FT = 3.281;
const KMH_TO_MPH = 1 / 1.609;

const COMPASS_POINTS = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];

function degreesToCompass(deg) {
  if (deg == null) return '—';
  const idx = Math.round(((deg % 360) + 360) % 360 / 22.5) % 16;
  return COMPASS_POINTS[idx];
}

function metersToFeet(m) {
  if (m == null) return 0;
  return m * M_TO_FT;
}

function kmhToMph(kmh) {
  if (kmh == null) return 0;
  return kmh * KMH_TO_MPH;
}

// Rockaway faces south: offshore = wind from N quadrants (270-360, 0-90)
function windType(deg) {
  if (deg == null) return 'Unknown';
  const d = ((deg % 360) + 360) % 360;
  if ((d >= 270 && d <= 360) || (d >= 0 && d <= 90)) return 'Offshore';
  if (d >= 135 && d <= 225) return 'Onshore';
  return 'Cross';
}

function surfVerdict(heightM, windDeg, periodS) {
  const ft = metersToFeet(heightM);
  const lo = Math.floor(ft);
  const hi = Math.ceil(ft + 0.3);
  const range = `${Math.max(1, lo)}-${Math.max(1, hi)}ft`;
  const wt = windType(windDeg);

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

function sizeLabel(heightM) {
  if (heightM < 0.3) return 'Flat';
  if (heightM < 0.6) return 'Small';
  if (heightM < 1.2) return 'Fun size';
  if (heightM < 2.0) return 'Solid';
  if (heightM < 3.0) return 'Pumping';
  return 'XXL';
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function shortDay(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
}

function pad(str, len) {
  return String(str).padEnd(len);
}

function formatTideTime(t) {
  const d = new Date(t.replace(' ', 'T'));
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function yyyymmdd(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

async function main() {
  const today = yyyymmdd(0);
  const tomorrow = yyyymmdd(1);

  const urls = {
    marineDaily: `https://marine-api.open-meteo.com/v1/marine?latitude=${LAT}&longitude=${LON}&daily=wave_height_max,swell_wave_height_max,wave_period_max,wave_direction_dominant,swell_wave_direction_dominant&models=ncep_gfswave016&timezone=America%2FNew_York&forecast_days=8`,
    marineHourly: `https://marine-api.open-meteo.com/v1/marine?latitude=${LAT}&longitude=${LON}&hourly=wave_height,swell_wave_height,wave_period,wave_direction,swell_wave_direction&models=ncep_gfswave016&timezone=America%2FNew_York&forecast_days=1`,
    weatherDaily: `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&daily=wind_speed_10m_max,wind_direction_10m_dominant,temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=America%2FNew_York&forecast_days=8`,
    weatherHourly: `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&hourly=wind_speed_10m,wind_direction_10m&timezone=America%2FNew_York&forecast_days=1`,
    tides: `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?station=${NOAA_STATION}&product=predictions&begin_date=${today}&end_date=${tomorrow}&datum=MLLW&time_zone=lst_ldt&units=english&interval=hilo&application=KarlKiserSurf&format=json`,
  };

  const results = await Promise.allSettled(
    Object.entries(urls).map(async ([key, url]) => [key, await fetchJSON(url)])
  );

  const data = {};
  const errors = [];
  for (const r of results) {
    if (r.status === 'fulfilled') {
      const [key, val] = r.value;
      data[key] = val;
    } else {
      errors.push(r.reason.message);
    }
  }

  if (!data.marineDaily || !data.marineHourly) {
    console.error('Marine data unavailable — skipping report.', errors);
    process.exit(1);
  }

  const md = data.marineDaily.daily;
  const mh = data.marineHourly.hourly;
  const wd = data.weatherDaily?.daily;
  const wh = data.weatherHourly?.hourly;
  const tides = data.tides?.predictions;

  // Today's conditions from daily data (index 0)
  const todayWaveHeight = md.wave_height_max[0];
  const todaySwellHeight = md.swell_wave_height_max[0];
  const todayPeriod = md.wave_period_max[0];
  const todaySwellDir = md.swell_wave_direction_dominant[0];
  const todayWindSpeed = wd ? kmhToMph(wd.wind_speed_10m_max[0]) : null;
  const todayWindDir = wd ? wd.wind_direction_10m_dominant[0] : null;

  const heightFt = metersToFeet(todayWaveHeight);
  const verdict = surfVerdict(todayWaveHeight, todayWindDir, todayPeriod);
  const swellCompass = degreesToCompass(todaySwellDir);
  const windCompass = degreesToCompass(todayWindDir);
  const wt = windType(todayWindDir);
  const wtSymbol = wt === 'Offshore' ? ' ✓' : '';

  const heightLo = Math.max(1, Math.floor(heightFt));
  const heightHi = Math.max(1, Math.ceil(heightFt + 0.3));

  // Tides formatting
  let tideStr = '—';
  if (tides && tides.length > 0) {
    const todayDateStr = new Date().toISOString().slice(0, 10);
    const todayTides = tides.filter(t => t.t.startsWith(todayDateStr));
    tideStr = todayTides
      .map(t => `${t.type === 'H' ? 'High' : 'Low'} ${formatTideTime(t.t)}`)
      .join(' · ') || '—';
  }

  // Hourly breakdown (5 AM to noon)
  let hourlyRows = [];
  if (mh && wh) {
    for (let h = 5; h <= 11; h++) {
      const idx = h;
      const waveH = metersToFeet(mh.wave_height[idx]);
      const windS = kmhToMph(wh.wind_speed_10m[idx]);
      const windD = wh.wind_direction_10m[idx];
      const wType = windType(windD);
      hourlyRows.push({
        hour: h,
        waveFt: waveH,
        windMph: windS,
        windDir: degreesToCompass(windD),
        windType: wType,
        score: waveH * (wType === 'Offshore' ? 1.5 : wType === 'Cross' ? 1.0 : 0.7),
      });
    }
  }

  // Mark best window
  let bestIdx = -1;
  let bestScore = -1;
  for (let i = 0; i < hourlyRows.length; i++) {
    if (hourlyRows[i].score > bestScore) {
      bestScore = hourlyRows[i].score;
      bestIdx = i;
    }
  }

  // 7-day forecast (skip today = index 0, use 1-7)
  let forecastDays = [];
  for (let i = 1; i < md.time.length && i <= 7; i++) {
    const waveH = md.wave_height_max[i];
    const swellDir = md.swell_wave_direction_dominant[i];
    const period = md.wave_period_max[i];
    const windSpd = wd ? kmhToMph(wd.wind_speed_10m_max[i]) : null;
    const windDir = wd ? wd.wind_direction_10m_dominant[i] : null;
    const ft = metersToFeet(waveH);
    forecastDays.push({
      date: md.time[i],
      lo: Math.max(1, Math.floor(ft - 0.3)),
      hi: Math.max(1, Math.ceil(ft + 0.3)),
      swellDir: degreesToCompass(swellDir),
      period: Math.round(period),
      windMph: windSpd != null ? Math.round(windSpd) : null,
      windDir: degreesToCompass(windDir),
      windType: windType(windDir),
      score: ft * (windType(windDir) === 'Offshore' ? 1.5 : windType(windDir) === 'Cross' ? 1.0 : 0.7) + (period || 0) * 0.3,
    });
  }

  // Mark best days (top 2 by score)
  const sortedScores = [...forecastDays].sort((a, b) => b.score - a.score);
  const bestDays = new Set(sortedScores.slice(0, 2).filter(d => d.score > 3).map(d => d.date));

  // Build subject line
  const subject = `🌊 Rockaway ${verdict.label} — ${heightLo}-${heightHi}ft ${swellCompass} @ ${Math.round(todayPeriod)}s`;

  // Build HTML email
  const html = buildEmail({
    date: formatDate(md.time[0]),
    heightLo, heightHi, swellCompass, todayPeriod,
    windCompass, todayWindSpeed, wt, wtSymbol,
    tideStr, verdict,
    hourlyRows, bestIdx,
    forecastDays, bestDays,
    errors,
  });

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log('No RESEND_API_KEY set — printing email to stdout.\n');
    console.log(`Subject: ${subject}\n`);
    console.log(html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&#8226;/g, '•'));
    process.exit(0);
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Rockaway Report <onboarding@resend.dev>',
      to: ['karl.j.kiser@gmail.com'],
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`Resend API error: ${res.status}`, body);
    process.exit(1);
  }

  const result = await res.json();
  console.log(`✓ Surf report sent. ID: ${result.id}`);
  console.log(`  Subject: ${subject}`);
  console.log(`  Wave: ${heightLo}-${heightHi}ft ${swellCompass} @ ${Math.round(todayPeriod)}s`);
  console.log(`  Wind: ${windCompass} ${Math.round(todayWindSpeed)}mph (${wt})`);
  if (errors.length) console.log(`  ⚠ Partial data — errors: ${errors.join('; ')}`);
}

function buildEmail({ date, heightLo, heightHi, swellCompass, todayPeriod, windCompass, todayWindSpeed, wt, wtSymbol, tideStr, verdict, hourlyRows, bestIdx, forecastDays, bestDays, errors }) {
  const bg = '#0d1b2a';
  const text = '#e8e4df';
  const accent = '#5ba3d9';
  const dimText = '#8a9bb0';
  const bestBg = '#122a40';
  const font = "system-ui, -apple-system, 'Segoe UI', sans-serif";

  const divider = `<tr><td style="padding:16px 0;"><div style="border-top:1px solid #1e3a5f;"></div></td></tr>`;

  const hourlyHtml = hourlyRows.length > 0 ? hourlyRows.map((r, i) => {
    const isBest = i === bestIdx;
    const timeStr = `${r.hour > 12 ? r.hour - 12 : r.hour} ${r.hour >= 12 ? 'PM' : 'AM'}`;
    const rowBg = isBest ? bestBg : 'transparent';
    const marker = isBest ? `<span style="color:${accent};"> ← Best window</span>` : '';
    const typeColor = r.windType === 'Offshore' ? '#4ade80' : r.windType === 'Onshore' ? '#f87171' : dimText;
    return `<tr style="background:${rowBg};">
      <td style="padding:6px 12px;color:${dimText};font-size:14px;white-space:nowrap;">${timeStr}</td>
      <td style="padding:6px 12px;color:${text};font-size:14px;font-weight:600;">${r.waveFt.toFixed(1)}ft</td>
      <td style="padding:6px 12px;color:${dimText};font-size:14px;">${r.windDir} ${Math.round(r.windMph)}mph</td>
      <td style="padding:6px 12px;font-size:14px;"><span style="color:${typeColor};">${r.windType}</span>${marker}</td>
    </tr>`;
  }).join('') : `<tr><td style="padding:12px;color:${dimText};">Hourly data unavailable</td></tr>`;

  const forecastHtml = forecastDays.map(d => {
    const isBest = bestDays.has(d.date);
    const rowBg = isBest ? bestBg : 'transparent';
    const star = isBest ? `<span style="color:#facc15;"> ★</span>` : '';
    const typeColor = d.windType === 'Offshore' ? '#4ade80' : d.windType === 'Onshore' ? '#f87171' : dimText;
    return `<tr style="background:${rowBg};">
      <td style="padding:8px 12px;color:${text};font-size:14px;white-space:nowrap;">${shortDay(d.date)}${star}</td>
      <td style="padding:8px 12px;color:${text};font-size:14px;font-weight:600;">${d.lo}-${d.hi}ft</td>
      <td style="padding:8px 12px;color:${dimText};font-size:14px;">${d.swellDir}</td>
      <td style="padding:8px 12px;color:${dimText};font-size:14px;">${d.period}s</td>
      <td style="padding:8px 12px;color:${dimText};font-size:14px;">${d.windDir} ${d.windMph != null ? d.windMph + 'mph' : '—'}</td>
      <td style="padding:8px 12px;font-size:14px;"><span style="color:${typeColor};">${d.windType}</span></td>
    </tr>`;
  }).join('');

  const errorNote = errors.length > 0
    ? `<tr><td style="padding:12px 0;color:#f59e0b;font-size:12px;">⚠ Some data sources unavailable: ${errors.join(', ')}</td></tr>`
    : '';

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:${bg};font-family:${font};">
<table width="100%" cellpadding="0" cellspacing="0" style="background:${bg};padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

<!-- Header -->
<tr><td style="padding:0 0 8px 0;">
  <h1 style="margin:0;font-size:13px;font-weight:600;letter-spacing:3px;color:${dimText};text-transform:uppercase;">Rockaway Beach — Surf Report</h1>
</td></tr>
<tr><td style="padding:0 0 24px 0;">
  <span style="font-size:15px;color:${dimText};">${date}</span>
</td></tr>

${divider}

<!-- Today's Conditions -->
<tr><td style="padding:20px 0 8px 0;">
  <h2 style="margin:0;font-size:12px;font-weight:600;letter-spacing:2px;color:${accent};text-transform:uppercase;">Today's Conditions</h2>
</td></tr>
<tr><td style="padding:8px 0;">
  <table cellpadding="0" cellspacing="0" style="width:100%;">
    <tr>
      <td style="padding:6px 0;color:${dimText};font-size:14px;width:100px;vertical-align:top;">Surf</td>
      <td style="padding:6px 0;color:${text};font-size:14px;font-weight:600;">${heightLo}-${heightHi} ft <span style="color:${dimText};font-weight:400;">(${swellCompass} swell @ ${Math.round(todayPeriod)}s)</span></td>
    </tr>
    <tr>
      <td style="padding:6px 0;color:${dimText};font-size:14px;vertical-align:top;">Wind</td>
      <td style="padding:6px 0;color:${text};font-size:14px;">${windCompass} ${todayWindSpeed != null ? Math.round(todayWindSpeed) : '—'} mph — <span style="color:${wt === 'Offshore' ? '#4ade80' : wt === 'Onshore' ? '#f87171' : dimText};">${wt}${wtSymbol}</span></td>
    </tr>
    <tr>
      <td style="padding:6px 0;color:${dimText};font-size:14px;vertical-align:top;">Tide</td>
      <td style="padding:6px 0;color:${text};font-size:14px;">${tideStr}</td>
    </tr>
    <tr>
      <td style="padding:6px 0;color:${dimText};font-size:14px;vertical-align:top;">Conditions</td>
      <td style="padding:6px 0;color:${text};font-size:14px;font-style:italic;">${verdict.summary}</td>
    </tr>
  </table>
</td></tr>

${divider}

<!-- Hourly Breakdown -->
<tr><td style="padding:20px 0 8px 0;">
  <h2 style="margin:0;font-size:12px;font-weight:600;letter-spacing:2px;color:${accent};text-transform:uppercase;">Hourly Breakdown <span style="color:${dimText};font-weight:400;letter-spacing:0;">(Dawn–Noon)</span></h2>
</td></tr>
<tr><td style="padding:8px 0;">
  <table cellpadding="0" cellspacing="0" style="width:100%;">
    ${hourlyHtml}
  </table>
</td></tr>

${divider}

<!-- 7-Day Forecast -->
<tr><td style="padding:20px 0 8px 0;">
  <h2 style="margin:0;font-size:12px;font-weight:600;letter-spacing:2px;color:${accent};text-transform:uppercase;">7-Day Look-Ahead</h2>
</td></tr>
<tr><td style="padding:8px 0;">
  <table cellpadding="0" cellspacing="0" style="width:100%;">
    <tr>
      <td style="padding:4px 12px;color:${dimText};font-size:11px;text-transform:uppercase;letter-spacing:1px;">Day</td>
      <td style="padding:4px 12px;color:${dimText};font-size:11px;text-transform:uppercase;letter-spacing:1px;">Surf</td>
      <td style="padding:4px 12px;color:${dimText};font-size:11px;text-transform:uppercase;letter-spacing:1px;">Dir</td>
      <td style="padding:4px 12px;color:${dimText};font-size:11px;text-transform:uppercase;letter-spacing:1px;">Per</td>
      <td style="padding:4px 12px;color:${dimText};font-size:11px;text-transform:uppercase;letter-spacing:1px;">Wind</td>
      <td style="padding:4px 12px;color:${dimText};font-size:11px;text-transform:uppercase;letter-spacing:1px;">Type</td>
    </tr>
    ${forecastHtml}
  </table>
</td></tr>
<tr><td style="padding:8px 0 0 12px;color:${dimText};font-size:12px;">★ = Best days this week</td></tr>

${divider}

<!-- Footer -->
${errorNote}
<tr><td style="padding:16px 0 0 0;">
  <p style="margin:0;font-size:12px;color:${dimText};">Data: Open-Meteo Marine (GFS Wave) · NOAA Tides</p>
  <p style="margin:4px 0 0 0;font-size:12px;color:${dimText};">Spot: Rockaway Beach, NY (40.58°N, 73.82°W)</p>
  <p style="margin:8px 0 0 0;font-size:11px;color:#6b7f96;line-height:1.5;">Note: Heights are significant wave height (Hs) — the average of the tallest third of open-ocean waves. Surfline reports face height adjusted for local bathymetry, which typically reads 20-35% lower for beachbreaks.</p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
