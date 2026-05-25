import type { OceanVisuals } from './ocean-palette';

interface HSL {
  h: number;
  s: number;
  l: number;
}

interface ShimmerPatch {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  phaseX: number;
  phaseY: number;
  speedX: number;
  speedY: number;
}

function parseHSL(css: string): HSL {
  const hsl = css.match(/hsl\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*\)/);
  if (hsl) {
    return { h: parseFloat(hsl[1]), s: parseFloat(hsl[2]), l: parseFloat(hsl[3]) };
  }

  const hex = css.match(/^#([0-9a-f]{3,8})$/i);
  if (hex) {
    let r: number, g: number, b: number;
    const v = hex[1];
    if (v.length === 3) {
      r = parseInt(v[0] + v[0], 16) / 255;
      g = parseInt(v[1] + v[1], 16) / 255;
      b = parseInt(v[2] + v[2], 16) / 255;
    } else {
      r = parseInt(v.slice(0, 2), 16) / 255;
      g = parseInt(v.slice(2, 4), 16) / 255;
      b = parseInt(v.slice(4, 6), 16) / 255;
    }
    return rgbToHSL(r, g, b);
  }

  const rgb = css.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
  if (rgb) {
    return rgbToHSL(
      parseInt(rgb[1]) / 255,
      parseInt(rgb[2]) / 255,
      parseInt(rgb[3]) / 255,
    );
  }

  return { h: 210, s: 40, l: 50 };
}

function rgbToHSL(r: number, g: number, b: number): HSL {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: l * 100 };

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;

  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToCSS(c: HSL): string {
  return `hsl(${c.h.toFixed(1)}, ${c.s.toFixed(1)}%, ${c.l.toFixed(1)}%)`;
}

function lerpHSL(a: HSL, b: HSL, t: number): HSL {
  let dh = b.h - a.h;
  if (dh > 180) dh -= 360;
  if (dh < -180) dh += 360;

  return {
    h: ((a.h + dh * t) % 360 + 360) % 360,
    s: a.s + (b.s - a.s) * t,
    l: a.l + (b.l - a.l) * t,
  };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

interface ResolvedVisuals {
  skyColor: HSL;
  horizonColor: HSL;
  waterColor: HSL;
  horizonPosition: number;
  waveAmplitude: number;
  waveSpeed: number;
  waveComplexity: number;
  smoothness: number;
}

function resolveVisuals(v: OceanVisuals): ResolvedVisuals {
  return {
    skyColor: parseHSL(v.skyColor),
    horizonColor: parseHSL(v.horizonColor),
    waterColor: parseHSL(v.waterColor),
    horizonPosition: v.horizonPosition,
    waveAmplitude: v.waveAmplitude,
    waveSpeed: v.waveSpeed,
    waveComplexity: v.waveComplexity,
    smoothness: v.smoothness,
  };
}

function lerpVisuals(a: ResolvedVisuals, b: ResolvedVisuals, t: number): ResolvedVisuals {
  return {
    skyColor: lerpHSL(a.skyColor, b.skyColor, t),
    horizonColor: lerpHSL(a.horizonColor, b.horizonColor, t),
    waterColor: lerpHSL(a.waterColor, b.waterColor, t),
    horizonPosition: lerp(a.horizonPosition, b.horizonPosition, t),
    waveAmplitude: lerp(a.waveAmplitude, b.waveAmplitude, t),
    waveSpeed: lerp(a.waveSpeed, b.waveSpeed, t),
    waveComplexity: lerp(a.waveComplexity, b.waveComplexity, t),
    smoothness: lerp(a.smoothness, b.smoothness, t),
  };
}

const TRANSITION_DURATION = 3000;

const SHIMMER_PATCHES: ShimmerPatch[] = [
  { cx: 0.25, cy: 0.7, rx: 0.18, ry: 0.08, phaseX: 0, phaseY: 0.5, speedX: 0.03, speedY: 0.02 },
  { cx: 0.6, cy: 0.8, rx: 0.22, ry: 0.06, phaseX: 2.1, phaseY: 1.3, speedX: 0.025, speedY: 0.015 },
  { cx: 0.8, cy: 0.65, rx: 0.15, ry: 0.07, phaseX: 4.0, phaseY: 3.2, speedX: 0.02, speedY: 0.025 },
];

export class OceanRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private animationId: number | null = null;
  private time = 0;
  private lastFrameTime = 0;

  private current: ResolvedVisuals | null = null;
  private target: ResolvedVisuals | null = null;
  private transitionStart = 0;
  private transitionFrom: ResolvedVisuals | null = null;

  private isMobile: boolean;
  private dpr: number;
  private logicalWidth = 0;
  private logicalHeight = 0;

  private cachedSkyGradient: CanvasGradient | null = null;
  private cachedWaterGradient: CanvasGradient | null = null;
  private lastSkyKey = '';
  private lastWaterKey = '';

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    this.ctx = ctx;
    this.isMobile = navigator.maxTouchPoints > 0;
    this.dpr = this.isMobile ? Math.min(window.devicePixelRatio, 1.5) : window.devicePixelRatio;
    this.resize();
  }

  updateVisuals(visuals: OceanVisuals): void {
    const resolved = resolveVisuals(visuals);
    if (!this.current) {
      this.current = resolved;
      this.target = resolved;
      return;
    }
    this.transitionFrom = { ...this.getInterpolatedVisuals() };
    this.target = resolved;
    this.transitionStart = this.time;
  }

  start(): void {
    if (this.animationId !== null) return;
    this.lastFrameTime = performance.now();
    const frame = (now: number) => {
      const dt = now - this.lastFrameTime;
      this.lastFrameTime = now;
      this.time += dt;
      this.render(dt);
      this.animationId = requestAnimationFrame(frame);
    };
    this.animationId = requestAnimationFrame(frame);
  }

  stop(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  resize(): void {
    this.logicalWidth = window.innerWidth;
    this.logicalHeight = window.innerHeight;
    this.canvas.width = this.logicalWidth * this.dpr;
    this.canvas.height = this.logicalHeight * this.dpr;
    this.canvas.style.width = `${this.logicalWidth}px`;
    this.canvas.style.height = `${this.logicalHeight}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.invalidateGradientCache();
  }

  destroy(): void {
    this.stop();
    this.current = null;
    this.target = null;
    this.transitionFrom = null;
    this.cachedSkyGradient = null;
    this.cachedWaterGradient = null;
  }

  private getInterpolatedVisuals(): ResolvedVisuals | null {
    if (!this.current || !this.target) {
      return this.current ?? this.target;
    }
    if (!this.transitionFrom) return this.target;

    const elapsed = this.time - this.transitionStart;
    if (elapsed >= TRANSITION_DURATION) {
      this.current = this.target;
      this.transitionFrom = null;
      return this.target;
    }

    const t = elapsed / TRANSITION_DURATION;
    const eased = t * t * (3 - 2 * t); // smoothstep
    return lerpVisuals(this.transitionFrom, this.target, eased);
  }

  private invalidateGradientCache(): void {
    this.lastSkyKey = '';
    this.lastWaterKey = '';
    this.cachedSkyGradient = null;
    this.cachedWaterGradient = null;
  }

  private colorKey(c: HSL): string {
    return `${c.h.toFixed(1)},${c.s.toFixed(1)},${c.l.toFixed(1)}`;
  }

  private getSkyGradient(v: ResolvedVisuals, horizonY: number): CanvasGradient {
    const key = `${this.colorKey(v.skyColor)}|${this.colorKey(v.horizonColor)}|${horizonY.toFixed(0)}`;
    if (key === this.lastSkyKey && this.cachedSkyGradient) return this.cachedSkyGradient;

    const grad = this.ctx.createLinearGradient(0, 0, 0, horizonY);
    grad.addColorStop(0, hslToCSS(v.skyColor));
    grad.addColorStop(1, hslToCSS(v.horizonColor));
    this.cachedSkyGradient = grad;
    this.lastSkyKey = key;
    return grad;
  }

  private getWaterGradient(v: ResolvedVisuals, horizonY: number): CanvasGradient {
    const key = `${this.colorKey(v.horizonColor)}|${this.colorKey(v.waterColor)}|${horizonY.toFixed(0)}`;
    if (key === this.lastWaterKey && this.cachedWaterGradient) return this.cachedWaterGradient;

    const grad = this.ctx.createLinearGradient(0, horizonY, 0, this.logicalHeight);
    grad.addColorStop(0, hslToCSS(v.horizonColor));
    grad.addColorStop(1, hslToCSS(v.waterColor));
    this.cachedWaterGradient = grad;
    this.lastWaterKey = key;
    return grad;
  }

  private render(frameDt: number): void {
    const v = this.getInterpolatedVisuals();
    if (!v) return;

    const w = this.logicalWidth;
    const h = this.logicalHeight;
    const ctx = this.ctx;
    const horizonY = v.horizonPosition * h;

    ctx.clearRect(0, 0, w, h);

    // Layer 1: Sky gradient
    ctx.fillStyle = this.getSkyGradient(v, horizonY);
    ctx.fillRect(0, 0, w, horizonY + 40);

    // Layer 2: Water gradient
    ctx.fillStyle = this.getWaterGradient(v, horizonY);
    ctx.fillRect(0, horizonY - 40, w, h - horizonY + 40);

    // Layer 3: Horizon undulation
    this.drawHorizonWaves(v, w, h, horizonY);

    // Layer 4: Gradient blend at horizon
    this.drawHorizonBlend(v, w, horizonY);

    // Layer 5: Depth shimmer (skip if frame is slow)
    if (frameDt < 20 && v.smoothness > 0.1) {
      this.drawShimmer(v, w, h, horizonY);
    }
  }

  /**
   * Horizon undulation: sum of sine waves with varying frequency, amplitude, and phase.
   * waveComplexity controls how many harmonic layers contribute.
   * Primary wave cycle time: ~8s at waveSpeed=0.5, scaling inversely.
   */
  private computeWaveY(x: number, v: ResolvedVisuals, w: number): number {
    const baseFreq = (Math.PI * 2) / w;
    const amp = v.waveAmplitude * 40;
    const cycleMs = 4000 / Math.max(v.waveSpeed, 0.01);
    const phase = (this.time / cycleMs) * Math.PI * 2;

    let y = Math.sin(x * baseFreq + phase) * amp;
    y += Math.sin(x * baseFreq * 2.3 + phase * 1.3 + 1.7) * amp * 0.4;

    if (v.waveComplexity > 0) {
      y += Math.sin(x * baseFreq * 5.7 + phase * 2.1 + 3.2) * amp * 0.15 * Math.min(v.waveComplexity * 2, 1);
    }
    if (v.waveComplexity > 0.5) {
      const factor = (v.waveComplexity - 0.5) * 2;
      y += Math.sin(x * baseFreq * 11 + phase * 1.7 + 5.1) * amp * 0.05 * factor;
    }
    if (v.waveComplexity > 0.7) {
      const factor = (v.waveComplexity - 0.7) / 0.3;
      y += Math.sin(x * baseFreq * 23 + phase * 2.9 + 7.8) * amp * 0.02 * factor;
    }

    return y;
  }

  private drawHorizonWaves(v: ResolvedVisuals, w: number, h: number, horizonY: number): void {
    const ctx = this.ctx;
    const step = this.isMobile ? 4 : 2;

    // Sky region: fill above the wave curve with sky gradient
    ctx.beginPath();
    ctx.moveTo(0, 0);
    for (let x = 0; x <= w; x += step) {
      ctx.lineTo(x, horizonY + this.computeWaveY(x, v, w));
    }
    ctx.lineTo(w, 0);
    ctx.closePath();
    ctx.fillStyle = this.getSkyGradient(v, horizonY);
    ctx.fill();

    // Water region: fill below the wave curve with water gradient
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += step) {
      ctx.lineTo(x, horizonY + this.computeWaveY(x, v, w));
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fillStyle = this.getWaterGradient(v, horizonY);
    ctx.fill();
  }

  private drawHorizonBlend(v: ResolvedVisuals, w: number, horizonY: number): void {
    const ctx = this.ctx;
    const blendRadius = 30 * v.smoothness;
    if (blendRadius < 1) return;

    const grad = ctx.createLinearGradient(0, horizonY - blendRadius, 0, horizonY + blendRadius);
    const horizonCSS = hslToCSS(v.horizonColor);

    grad.addColorStop(0, withAlpha(horizonCSS, 0));
    grad.addColorStop(0.4, withAlpha(horizonCSS, 0.3 * v.smoothness));
    grad.addColorStop(0.5, withAlpha(horizonCSS, 0.5 * v.smoothness));
    grad.addColorStop(0.6, withAlpha(horizonCSS, 0.3 * v.smoothness));
    grad.addColorStop(1, withAlpha(horizonCSS, 0));

    ctx.fillStyle = grad;
    ctx.fillRect(0, horizonY - blendRadius, w, blendRadius * 2);
  }

  private drawShimmer(v: ResolvedVisuals, w: number, h: number, horizonY: number): void {
    const ctx = this.ctx;
    const opacity = 0.04 * v.smoothness;
    if (opacity < 0.005) return;

    const seconds = this.time / 1000;

    for (const patch of SHIMMER_PATCHES) {
      const cx = (patch.cx + Math.sin(seconds * patch.speedX + patch.phaseX) * 0.06) * w;
      const cy = horizonY + (patch.cy - 0.5) * (h - horizonY) * 2
        + Math.sin(seconds * patch.speedY + patch.phaseY) * 20;

      if (cy < horizonY) continue;

      const rx = patch.rx * w;
      const ry = patch.ry * h;

      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry));
      const light = hslToCSS({ h: v.horizonColor.h, s: v.horizonColor.s * 0.5, l: Math.min(v.horizonColor.l + 15, 100) });
      grad.addColorStop(0, withAlpha(light, opacity));
      grad.addColorStop(0.6, withAlpha(light, opacity * 0.3));
      grad.addColorStop(1, withAlpha(light, 0));

      ctx.save();
      ctx.transform(1, 0, 0, ry / rx, 0, cy * (1 - ry / rx));
      ctx.fillStyle = grad;
      ctx.fillRect(cx - rx, cy - rx, rx * 2, rx * 2);
      ctx.restore();
    }
  }
}

function withAlpha(cssColor: string, alpha: number): string {
  const hsl = cssColor.match(/hsl\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*\)/);
  if (hsl) {
    return `hsla(${hsl[1]}, ${hsl[2]}%, ${hsl[3]}%, ${alpha.toFixed(3)})`;
  }
  return `rgba(128, 128, 128, ${alpha.toFixed(3)})`;
}
