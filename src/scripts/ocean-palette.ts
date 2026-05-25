import type { OceanData } from './ocean-data';

export interface OceanVisuals {
  skyColor: string;
  horizonColor: string;
  waterColor: string;
  accentColor: string;
  waveAmplitude: number;
  waveSpeed: number;
  waveComplexity: number;
  smoothness: number;
  horizonPosition: number;
  textColor: string;
  textShadow: string;
}

interface HSL {
  h: number;
  s: number;
  l: number;
}

interface PaletteAnchor {
  hour: number;
  sky: HSL;
  horizon: HSL;
  water: HSL;
  accent: HSL;
}

function hexToHSL(hex: string): HSL {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) return { h: 0, s: 0, l };

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;

  return { h, s, l };
}

function hslToCSS(hsl: HSL): string {
  const { h, s, l } = hsl;
  const hDeg = Math.round(h * 360);
  const sPct = Math.round(s * 100);
  const lPct = Math.round(l * 100);
  return `hsl(${hDeg}, ${sPct}%, ${lPct}%)`;
}

function lerpHSL(a: HSL, b: HSL, t: number): HSL {
  let dh = b.h - a.h;
  if (dh > 0.5) dh -= 1;
  if (dh < -0.5) dh += 1;

  return {
    h: ((a.h + dh * t) % 1 + 1) % 1,
    s: a.s + (b.s - a.s) * t,
    l: a.l + (b.l - a.l) * t,
  };
}

function cosineInterpolate(t: number): number {
  return (1 - Math.cos(t * Math.PI)) / 2;
}

const ANCHORS: PaletteAnchor[] = [
  { hour: 2, sky: hexToHSL('#080e1a'), horizon: hexToHSL('#121e2e'), water: hexToHSL('#060a12'), accent: hexToHSL('#1a2a40') },
  { hour: 5, sky: hexToHSL('#1a1a2e'), horizon: hexToHSL('#2d2b55'), water: hexToHSL('#0f0f23'), accent: hexToHSL('#4a4a8a') },
  { hour: 6.5, sky: hexToHSL('#ff9a76'), horizon: hexToHSL('#ffc4a3'), water: hexToHSL('#2e4057'), accent: hexToHSL('#ffcdb2') },
  { hour: 8, sky: hexToHSL('#87ceeb'), horizon: hexToHSL('#b8e6f0'), water: hexToHSL('#2c5f7c'), accent: hexToHSL('#e0f4ff') },
  { hour: 12, sky: hexToHSL('#5ba3d9'), horizon: hexToHSL('#8ec8e8'), water: hexToHSL('#1a4a6e'), accent: hexToHSL('#d4eeff') },
  { hour: 16, sky: hexToHSL('#6db3e8'), horizon: hexToHSL('#a8d4f0'), water: hexToHSL('#1e5478'), accent: hexToHSL('#c8e4ff') },
  { hour: 18.5, sky: hexToHSL('#ff8c42'), horizon: hexToHSL('#ffa570'), water: hexToHSL('#2a3f5f'), accent: hexToHSL('#ffd4a8') },
  { hour: 20, sky: hexToHSL('#4a2c5e'), horizon: hexToHSL('#6b3a7a'), water: hexToHSL('#1a1a3e'), accent: hexToHSL('#9b6bb0') },
  { hour: 22, sky: hexToHSL('#0d1b2a'), horizon: hexToHSL('#1b2838'), water: hexToHSL('#0a0f1a'), accent: hexToHSL('#2a4060') },
];

function getTimeAsFloat(now: Date): number {
  const eastern = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  return eastern.getHours() + eastern.getMinutes() / 60;
}

function interpolatePalette(hour: number): { sky: HSL; horizon: HSL; water: HSL; accent: HSL } {
  const anchors = ANCHORS;
  const len = anchors.length;

  let before = anchors[len - 1];
  let after = anchors[0];

  for (let i = 0; i < len; i++) {
    const next = (i + 1) % len;
    const curr = anchors[i];
    const nxt = anchors[next];

    const currHour = curr.hour;
    let nxtHour = nxt.hour;
    if (nxtHour <= currHour) nxtHour += 24;

    let testHour = hour;
    if (testHour < currHour) testHour += 24;

    if (testHour >= currHour && testHour < nxtHour) {
      before = curr;
      after = nxt;
      break;
    }
  }

  let bh = before.hour;
  let ah = after.hour;
  let h = hour;

  if (ah <= bh) ah += 24;
  if (h < bh) h += 24;

  const rawT = (h - bh) / (ah - bh);
  const t = cosineInterpolate(Math.max(0, Math.min(1, rawT)));

  return {
    sky: lerpHSL(before.sky, after.sky, t),
    horizon: lerpHSL(before.horizon, after.horizon, t),
    water: lerpHSL(before.water, after.water, t),
    accent: lerpHSL(before.accent, after.accent, t),
  };
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function smoothStep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function mapWaveAmplitude(height: number): number {
  const points: [number, number][] = [
    [0, 0.05],
    [0.5, 0.15],
    [1, 0.3],
    [1.5, 0.5],
    [2.5, 0.75],
    [4, 1.0],
  ];
  return piecewiseLerp(points, height);
}

function mapWaveSpeed(period: number): number {
  const points: [number, number][] = [
    [4, 0.9],
    [8, 0.5],
    [12, 0.3],
    [16, 0.15],
  ];
  return piecewiseLerp(points, period);
}

function piecewiseLerp(points: [number, number][], x: number): number {
  if (x <= points[0][0]) return points[0][1];
  if (x >= points[points.length - 1][0]) return points[points.length - 1][1];

  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    if (x >= x0 && x <= x1) {
      const t = smoothStep(x0, x1, x);
      return y0 + (y1 - y0) * t;
    }
  }
  return points[points.length - 1][1];
}

function mapWindToSmoothness(speed: number, isOffshore: boolean): number {
  if (isOffshore) return 0.8 + smoothStep(0, 20, speed) * 0.2;
  if (speed < 10) return 0.7;
  if (speed < 25) return 0.7 - smoothStep(10, 25, speed) * 0.3;
  return 0.2;
}

function mapWindToComplexity(speed: number, isOffshore: boolean): number {
  if (isOffshore) return 0.2;
  if (speed < 10) return 0.3;
  if (speed < 25) return 0.3 + smoothStep(10, 25, speed) * 0.3;
  return 0.9;
}

function mapTideToHorizon(tide: number): number {
  return 0.55 - (0.55 - 0.42) * tide;
}

function desaturate(color: HSL, amount: number): HSL {
  const gray: HSL = { h: color.h, s: 0, l: color.l };
  return lerpHSL(color, gray, amount);
}

function applyCloudCover(palette: { sky: HSL; horizon: HSL; water: HSL; accent: HSL }, cloudCover: number): { sky: HSL; horizon: HSL; water: HSL; accent: HSL } {
  const factor = cloudCover / 100;
  const desatAmount = factor * 0.5;
  return {
    sky: desaturate(palette.sky, desatAmount),
    horizon: desaturate(palette.horizon, desatAmount),
    water: desaturate(palette.water, desatAmount),
    accent: desaturate(palette.accent, desatAmount * 1.2),
  };
}

export function computeVisuals(data: OceanData | null, now?: Date): OceanVisuals {
  const time = now ?? new Date();
  const hour = getTimeAsFloat(time);
  let palette = interpolatePalette(hour);

  let waveAmplitude = 0.2;
  let waveSpeed = 0.4;
  let waveComplexity = 0.4;
  let smoothness = 0.6;
  let horizonPosition = 0.48;

  if (data) {
    waveAmplitude = mapWaveAmplitude(data.wave.height);
    waveSpeed = mapWaveSpeed(data.wave.period);
    smoothness = mapWindToSmoothness(data.wind.speed, data.wind.isOffshore);
    waveComplexity = mapWindToComplexity(data.wind.speed, data.wind.isOffshore);
    horizonPosition = mapTideToHorizon(data.tide.current);
    palette = applyCloudCover(palette, data.sky.cloudCover);
  }

  const avgLuminance = (palette.sky.l + palette.horizon.l + palette.water.l) / 3;

  const textColor = avgLuminance > 0.5
    ? 'rgba(15, 15, 35, 0.9)'
    : 'rgba(245, 240, 235, 0.92)';

  const textShadow = avgLuminance > 0.5
    ? '0 1px 3px rgba(255,255,255,0.3)'
    : '0 1px 8px rgba(0,0,0,0.5)';

  return {
    skyColor: hslToCSS(palette.sky),
    horizonColor: hslToCSS(palette.horizon),
    waterColor: hslToCSS(palette.water),
    accentColor: hslToCSS(palette.accent),
    waveAmplitude,
    waveSpeed,
    waveComplexity,
    smoothness,
    horizonPosition,
    textColor,
    textShadow,
  };
}
