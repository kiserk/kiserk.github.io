import { SPECIES, nextSpecies, speciesByName, type Species } from './mycelium-growth';

interface Tip {
  x: number;
  y: number;
  /** Heading in radians. */
  dir: number;
  alive: boolean;
}

interface Nutrient {
  /** Fixed anchor the blob wiggles around. */
  ax: number;
  ay: number;
  /** Current (Brownian-jittered) position. */
  x: number;
  y: number;
  /** Brownian offset from the anchor. */
  jx: number;
  jy: number;
  /** Base blob radius (logical px). */
  r: number;
  /** Remaining energy 0..1; depletes as hyphae consume it. */
  energy: number;
  /** Animation phase for the wobble. */
  phase: number;
  /** Per-vertex phase offsets giving the amorphous, cartoony outline. */
  verts: number[];
}

interface Point {
  x: number;
  y: number;
}

// Transient expanding ring drawn when a nutrient is taken up. A "strong" pulse
// marks a phase transition (nutrient exhausted -> colony matures a stage).
interface Pulse {
  x: number;
  y: number;
  age: number;
  life: number;
  maxR: number;
  strong: boolean;
}

// Standard normal via Box-Muller, for organic heading wobble.
function randn(): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function shortestAngle(from: number, to: number): number {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/**
 * Mycelial growth sim based on the Neighbour-Sensing model (Meskauskas, Fricker
 * & Moore, 2004). Each hyphal tip advances by a growth vector adjusted by
 * tropisms read from a hyphal *density field*:
 *   - negative autotropism: steer away from the density gradient, so tips avoid
 *     existing hyphae and colonise empty space (even, advancing radial margin);
 *   - persistence: direction changes are gradual (capped turn per step);
 *   - density-gated branching: branches form where local density is low (margin),
 *     the primary daughter keeping the parent vector and the secondary turning;
 *   - substrate/chemotropism: gentle attraction toward nutrients;
 *   - a faint "oxygen" tropism toward the mouse.
 * The colony densifies via "vigor" as nutrients are consumed; exhausting a
 * nutrient also mutates the active species. Lifecycle mirrors OceanRenderer.
 */
export class MyceliumRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  // Separate layer for dynamic elements (nutrients) so their animation does not
  // accumulate on the persistent hyphae canvas.
  private fxCanvas: HTMLCanvasElement;
  private fxCtx: CanvasRenderingContext2D;
  private animationId: number | null = null;

  private dpr: number;
  private logicalWidth = 0;
  private logicalHeight = 0;

  private origin: Point;
  private tips: Tip[] = [];
  private nutrients: Nutrient[] = [];
  private pulses: Pulse[] = [];

  private species: Species = SPECIES[0];
  private overrides: Partial<Species> = {};
  private vigor = 0;

  // Hyphal density field (coarse grid) for the autotropism + branching gate.
  private cellSize = 12;
  private cols = 0;
  private rows = 0;
  private density: Float32Array = new Float32Array(0);

  // Mouse "oxygen" gradient + arrow-key drift.
  private bias: Point | null = null;
  private drift: Point = { x: 0, y: 0 };

  // The mouse acts as a mobile, refilling nutrient: hyphae forage toward it and
  // feed on it (throttled), and it is drawn as a wiggly blob at the cursor.
  private mouseActive = false;
  private mouseVerts: number[] = [];
  private mousePhase = 0;
  private mouseFeedCooldown = 0; // ms remaining before the next feeding burst

  // Neighbour-Sensing tropism weights (tunable).
  private autotropism = 1.1;   // strength of negative autotropism (avoidance)
  private chemotropism = 0.6;  // attraction toward nutrients
  private oxygen = 0.34;       // attraction toward the mouse
  private chemoRange = 200;    // sensing radius for nutrients (logical px)
  private persistence = 1.8;   // weight of keeping the current heading
  private maxTurn = 0.09;      // max radians a tip can turn per step
  private branchThreshold = 5; // suppress branching above this local density

  // Pace.
  private speed = 0.26;
  private stepsPerFrame = 1;
  private fade = 0;
  private nutrientTimer = 0;
  private nutrientInterval = 2400;
  private maxNutrients = 5;

  private reducedMotion = false;
  private lastFrameTime = 0;

  constructor(canvas: HTMLCanvasElement, fxCanvas: HTMLCanvasElement, origin: Point) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    this.ctx = ctx;
    this.fxCanvas = fxCanvas;
    const fxCtx = fxCanvas.getContext('2d');
    if (!fxCtx) throw new Error('Canvas 2D context unavailable');
    this.fxCtx = fxCtx;
    const isMobile = navigator.maxTouchPoints > 0;
    this.dpr = isMobile ? Math.min(window.devicePixelRatio, 1.5) : window.devicePixelRatio || 1;
    this.origin = { ...origin };
    for (let i = 0; i < 8; i++) this.mouseVerts.push(Math.random() * Math.PI * 2);
    this.resize();
    this.seedFromOrigin(7);
  }

  // ---- param helpers -------------------------------------------------------

  private p<K extends keyof Species>(key: K): Species[K] {
    return (this.overrides[key] ?? this.species[key]) as Species[K];
  }

  // Vigor (colony maturity) is capped so densification plateaus instead of
  // running away and filling the viewport with noise. Each integer step is a
  // visible "phase" of the colony.
  private maxVigor = 10;
  // Above this local density, apical tips senesce (growth concentrates at the
  // advancing margin, as in a real colony) — prevents interior over-fill.
  private crowdDensity = 14;
  private crowdDeath = 0.05;

  private effectiveBranchProb(): number {
    // Branching ramps up dramatically as the colony gains nutrients (vigor).
    return this.p('branchProb') * (1 + this.vigor * 0.5);
  }

  private effectiveMaxTips(): number {
    return Math.round(this.p('maxTips') * (1 + this.vigor * 0.22));
  }

  // ---- density field -------------------------------------------------------

  private buildGrid(): void {
    this.cols = Math.ceil(this.logicalWidth / this.cellSize) + 1;
    this.rows = Math.ceil(this.logicalHeight / this.cellSize) + 1;
    this.density = new Float32Array(this.cols * this.rows);
  }

  private deposit(x: number, y: number, amt: number): void {
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    if (cx < 0 || cy < 0 || cx >= this.cols || cy >= this.rows) return;
    this.density[cy * this.cols + cx] += amt;
  }

  private densAt(x: number, y: number): number {
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    if (cx < 0 || cy < 0 || cx >= this.cols || cy >= this.rows) return 0;
    return this.density[cy * this.cols + cx];
  }

  // ---- lifecycle -----------------------------------------------------------

  start(): void {
    if (this.animationId !== null) return;
    this.lastFrameTime = performance.now();
    const frame = (now: number) => {
      const dt = now - this.lastFrameTime;
      this.lastFrameTime = now;
      this.tick(dt);
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
    for (const c of [this.canvas, this.fxCanvas]) {
      c.width = Math.floor(this.logicalWidth * this.dpr);
      c.height = Math.floor(this.logicalHeight * this.dpr);
      c.style.width = `${this.logicalWidth}px`;
      c.style.height = `${this.logicalHeight}px`;
    }
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.fxCtx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.buildGrid();
  }

  destroy(): void {
    this.stop();
    this.fxCtx.clearRect(0, 0, this.logicalWidth, this.logicalHeight);
    this.tips = [];
    this.nutrients = [];
    this.pulses = [];
    this.bias = null;
    this.density = new Float32Array(0);
  }

  // ---- public controls -----------------------------------------------------

  setBias(x: number, y: number): void {
    this.bias = { x, y };
    this.mouseActive = true;
  }
  clearBias(): void {
    this.bias = null;
    this.mouseActive = false;
  }

  nudge(dx: number, dy: number): void {
    this.drift.x = Math.max(-1, Math.min(1, this.drift.x + dx * 0.2));
    this.drift.y = Math.max(-1, Math.min(1, this.drift.y + dy * 0.2));
  }

  setReducedMotion(on: boolean): void {
    this.reducedMotion = on;
    if (on) this.speed = Math.min(this.speed, 0.22);
  }

  // Debug/tuning setters (driven by the preview panel).
  setStep(v: number): void { this.overrides.step = v; }
  setBranchProb(v: number): void { this.overrides.branchProb = v; }
  setAngleJitter(v: number): void { this.overrides.angleJitter = v; }
  setLineWidth(v: number): void { this.overrides.lineWidth = v; }
  setMaxTips(v: number): void { this.overrides.maxTips = v; }
  setOxygenPull(v: number): void { this.oxygen = v; }
  setAutotropism(v: number): void { this.autotropism = v; }
  setChemotropism(v: number): void { this.chemotropism = v; }
  setMaxTurn(v: number): void { this.maxTurn = Math.max(0.01, v); }
  setPersistence(v: number): void { this.persistence = v; }
  setSpeed(v: number): void { this.speed = Math.max(0.04, Math.min(1, v)); }
  setStepsPerFrame(v: number): void { this.stepsPerFrame = Math.max(1, Math.round(v)); }
  setFade(v: number): void { this.fade = Math.max(0, Math.min(0.2, v)); }

  forceSpecies(name: string): void {
    const s = speciesByName(name);
    if (s) {
      this.species = s;
      this.overrides = {};
    }
  }

  reset(origin?: Point): void {
    if (origin) this.origin = { ...origin };
    this.ctx.clearRect(0, 0, this.logicalWidth, this.logicalHeight);
    this.fxCtx.clearRect(0, 0, this.logicalWidth, this.logicalHeight);
    this.tips = [];
    this.nutrients = [];
    this.pulses = [];
    this.drift = { x: 0, y: 0 };
    this.vigor = 0;
    this.species = SPECIES[0];
    this.overrides = {};
    this.buildGrid();
    this.seedFromOrigin(7);
  }

  getStats(): { tips: number; nutrients: number; species: string; vigor: number } {
    return {
      tips: this.tips.length,
      nutrients: this.nutrients.length,
      species: this.species.name,
      vigor: Math.round(this.vigor),
    };
  }

  // ---- internals -----------------------------------------------------------

  private seedFromOrigin(count: number): void {
    for (let i = 0; i < count; i++) {
      const dir = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      this.tips.push({ x: this.origin.x, y: this.origin.y, dir, alive: true });
    }
  }

  private makeNutrient(ax: number, ay: number): Nutrient {
    const verts: number[] = [];
    for (let i = 0; i < 8; i++) verts.push(Math.random() * Math.PI * 2);
    return {
      ax,
      ay,
      x: ax,
      y: ay,
      jx: 0,
      jy: 0,
      r: 4 + Math.random() * 2,
      energy: 1,
      phase: Math.random() * Math.PI * 2,
      verts,
    };
  }

  private spawnNutrient(): void {
    if (this.nutrients.length >= this.maxNutrients) return;
    // Spawn roughly ahead of a foraging tip so the colony grows into it.
    const tip = this.tips.length ? this.tips[(Math.random() * this.tips.length) | 0] : null;
    const angle = tip ? tip.dir + (Math.random() - 0.5) * 1.3 : Math.random() * Math.PI * 2;
    const dist = 55 + Math.random() * 120;
    const fromX = tip ? tip.x : this.origin.x;
    const fromY = tip ? tip.y : this.origin.y;
    const ax = Math.max(28, Math.min(this.logicalWidth - 28, fromX + Math.cos(angle) * dist));
    const ay = Math.max(28, Math.min(this.logicalHeight - 28, fromY + Math.sin(angle) * dist));
    this.nutrients.push(this.makeNutrient(ax, ay));
  }

  /** Player-dropped nutrient at an explicit point (in addition to auto-spawns). */
  dropNutrient(x: number, y: number): void {
    const hardCap = 48;
    if (this.nutrients.length >= hardCap) return;
    const ax = Math.max(12, Math.min(this.logicalWidth - 12, x));
    const ay = Math.max(12, Math.min(this.logicalHeight - 12, y));
    this.nutrients.push(this.makeNutrient(ax, ay));
  }

  private nearestNutrient(x: number, y: number, maxDist: number): Nutrient | null {
    let best: Nutrient | null = null;
    let bestD = maxDist * maxDist;
    for (const n of this.nutrients) {
      if (n.energy <= 0) continue;
      const dx = n.x - x;
      const dy = n.y - y;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = n;
      }
    }
    return best;
  }

  private addPulse(x: number, y: number, strong: boolean): void {
    this.pulses.push({
      x,
      y,
      age: 0,
      life: strong ? 760 : 420,
      maxR: strong ? 40 : 16,
      strong,
    });
  }

  /** Spawn a radial fan of foraging tips from a point. */
  private burstTips(x: number, y: number, count: number): void {
    const maxTips = this.effectiveMaxTips();
    for (let i = 0; i < count && this.tips.length < maxTips; i++) {
      const dir = (i / count) * Math.PI * 2 + Math.random() * 0.6;
      this.tips.push({ x, y, dir, alive: true });
    }
  }

  private consume(n: Nutrient): void {
    n.energy -= 0.5;
    // A vigorous burst of new foraging tips on contact — branching surges with food.
    this.burstTips(n.x, n.y, 5 + ((Math.random() * 4) | 0));
    this.addPulse(n.x, n.y, false);
    if (n.energy <= 0) {
      // Phase transition: the colony matures a stage. Strong visible pulse, a
      // big radial proliferation, a step up in vigor, and a morphology switch.
      this.vigor = Math.min(this.maxVigor, this.vigor + 1);
      this.burstTips(n.x, n.y, 8 + ((Math.random() * 5) | 0));
      this.addPulse(n.x, n.y, true);
      this.species = nextSpecies(this.species);
      this.overrides = {};
    }
  }

  /** Neighbour-Sensing growth vector: persistence + tropisms, then clamp turn. */
  private nextDir(tip: Tip): number {
    const cs = this.cellSize;
    // Steering vector starts with directional persistence.
    let sx = Math.cos(tip.dir) * this.persistence;
    let sy = Math.sin(tip.dir) * this.persistence;

    // Negative autotropism: steer down the hyphal-density gradient.
    const gx = this.densAt(tip.x + cs, tip.y) - this.densAt(tip.x - cs, tip.y);
    const gy = this.densAt(tip.x, tip.y + cs) - this.densAt(tip.x, tip.y - cs);
    const gm = Math.hypot(gx, gy);
    if (gm > 0) {
      sx += (-gx / gm) * this.autotropism;
      sy += (-gy / gm) * this.autotropism;
    }

    // Chemotropism toward the nearest nutrient (gentle, distance-weighted).
    if (this.chemotropism > 0) {
      const n = this.nearestNutrient(tip.x, tip.y, this.chemoRange);
      if (n) {
        const dx = n.x - tip.x;
        const dy = n.y - tip.y;
        const m = Math.hypot(dx, dy) || 1;
        const w = this.chemotropism * (1 - m / this.chemoRange);
        sx += (dx / m) * w;
        sy += (dy / m) * w;
      }
    }

    // Oxygen tropism toward the mouse + arrow drift (gentle).
    if (this.oxygen > 0) {
      let ox = 0;
      let oy = 0;
      if (this.bias) {
        const dx = this.bias.x - tip.x;
        const dy = this.bias.y - tip.y;
        const m = Math.hypot(dx, dy) || 1;
        ox += dx / m;
        oy += dy / m;
      }
      ox += this.drift.x;
      oy += this.drift.y;
      const om = Math.hypot(ox, oy);
      if (om > 0) {
        sx += (ox / om) * this.oxygen;
        sy += (oy / om) * this.oxygen;
      }
    }

    const desired = Math.atan2(sy, sx);
    let turn = shortestAngle(tip.dir, desired);
    if (turn > this.maxTurn) turn = this.maxTurn;
    else if (turn < -this.maxTurn) turn = -this.maxTurn;
    return tip.dir + turn + randn() * this.p('angleJitter');
  }

  private stepTip(tip: Tip, step: number, lineWidth: number, branchProb: number, maxTips: number): void {
    const dieProb = this.p('dieProb');
    const branchAngle = this.p('branchAngle');

    let dir = this.nextDir(tip);
    const nx = tip.x + Math.cos(dir) * step;
    const ny = tip.y + Math.sin(dir) * step;

    // Soft containment near edges (curve back in); hard stop only off-screen.
    const margin = 40;
    if (nx < margin || nx > this.logicalWidth - margin || ny < margin || ny > this.logicalHeight - margin) {
      const toCenter = Math.atan2(this.logicalHeight / 2 - tip.y, this.logicalWidth / 2 - tip.x);
      dir += shortestAngle(dir, toCenter) * 0.05;
    }
    if (nx < -20 || nx > this.logicalWidth + 20 || ny < -20 || ny > this.logicalHeight + 20) {
      tip.alive = false;
      return;
    }

    this.ctx.strokeStyle = this.strokeColor();
    this.ctx.lineWidth = lineWidth;
    this.ctx.beginPath();
    this.ctx.moveTo(tip.x, tip.y);
    this.ctx.lineTo(nx, ny);
    this.ctx.stroke();

    this.deposit(nx, ny, 1);

    tip.x = nx;
    tip.y = ny;
    tip.dir = dir;

    for (const n of this.nutrients) {
      if (n.energy > 0) {
        const dx = n.x - nx;
        const dy = n.y - ny;
        const catchR = n.r + 7;
        if (dx * dx + dy * dy < catchR * catchR) {
          this.consume(n);
          break;
        }
      }
    }

    // Feed on the mouse (a mobile, refilling nutrient) — throttled so hovering
    // can't spawn tips without bound.
    if (this.mouseActive && this.bias && this.mouseFeedCooldown <= 0) {
      const dx = this.bias.x - nx;
      const dy = this.bias.y - ny;
      if (dx * dx + dy * dy < 13 * 13) {
        this.burstTips(this.bias.x, this.bias.y, 3 + ((Math.random() * 3) | 0));
        this.addPulse(this.bias.x, this.bias.y, false);
        this.vigor = Math.min(this.maxVigor, this.vigor + 1);
        this.mouseFeedCooldown = 130;
      }
    }

    const local = this.densAt(nx, ny);
    // Density-gated branching: branch only where it's not already crowded.
    if (local < this.branchThreshold && Math.random() < branchProb && this.tips.length < maxTips) {
      // Primary daughter keeps the parent vector (this tip); secondary turns off.
      const side = Math.random() < 0.5 ? 1 : -1;
      this.tips.push({ x: nx, y: ny, dir: dir + side * branchAngle, alive: true });
    }
    // Apical senescence: tips in already-dense interior stop, so growth stays
    // concentrated at the advancing colony margin.
    if (Math.random() < dieProb || (local > this.crowdDensity && Math.random() < this.crowdDeath)) {
      tip.alive = false;
    }
  }

  private strokeColor(): string {
    const tint =
      this.species.name === 'dense'
        ? '210, 220, 214'
        : this.species.name === 'fan'
          ? '220, 219, 210'
          : '214, 224, 220';
    return `rgba(${tint}, 0.5)`;
  }

  /** Draw a hollow, smooth (cartoony), wobbling amorphous blob outline. */
  private drawBlob(x: number, y: number, base: number, verts: number[], phase: number, alpha: number): void {
    const ctx = this.fxCtx;
    const N = verts.length;
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < N; i++) {
      const ang = (i / N) * Math.PI * 2;
      const wob = 1 + 0.42 * Math.sin(phase * 2 + verts[i]);
      const rr = base * wob;
      pts.push({ x: x + Math.cos(ang) * rr, y: y + Math.sin(ang) * rr });
    }
    ctx.strokeStyle = `rgba(228, 234, 230, ${alpha})`;
    ctx.lineWidth = 1;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    let mx = (pts[N - 1].x + pts[0].x) / 2;
    let my = (pts[N - 1].y + pts[0].y) / 2;
    ctx.moveTo(mx, my);
    for (let i = 0; i < N; i++) {
      const cur = pts[i];
      const nxt = pts[(i + 1) % N];
      mx = (cur.x + nxt.x) / 2;
      my = (cur.y + nxt.y) / 2;
      ctx.quadraticCurveTo(cur.x, cur.y, mx, my);
    }
    ctx.closePath();
    ctx.stroke();
  }

  private drawNutrients(): void {
    this.fxCtx.clearRect(0, 0, this.logicalWidth, this.logicalHeight);
    for (const n of this.nutrients) {
      this.drawBlob(n.x, n.y, n.r * (0.6 + 0.4 * n.energy), n.verts, n.phase, 0.6 * n.energy);
    }
    // The mouse, as a slightly larger/brighter living nutrient.
    if (this.mouseActive && this.bias) {
      this.drawBlob(this.bias.x, this.bias.y, 6.5, this.mouseVerts, this.mousePhase, 0.85);
    }
    this.drawPulses();
  }

  private drawPulses(): void {
    const ctx = this.fxCtx;
    for (const p of this.pulses) {
      const t = p.age / p.life; // 0..1
      const r = p.maxR * (1 - (1 - t) * (1 - t)); // ease-out expansion
      const alpha = (1 - t) * (p.strong ? 0.34 : 0.2);
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.strokeStyle = p.strong
        ? `rgba(150, 226, 198, ${alpha})`
        : `rgba(214, 234, 226, ${alpha})`;
      ctx.lineWidth = p.strong ? 1 : 0.8;
      ctx.stroke();
    }
  }

  private updateNutrients(dt: number): void {
    const wiggle = this.reducedMotion ? 0.15 : 0.4;
    const leash = 3.5;
    for (const n of this.nutrients) {
      n.jx += randn() * wiggle;
      n.jy += randn() * wiggle;
      const m = Math.hypot(n.jx, n.jy);
      if (m > leash) {
        n.jx = (n.jx / m) * leash;
        n.jy = (n.jy / m) * leash;
      }
      n.x = n.ax + n.jx;
      n.y = n.ay + n.jy;
      n.phase += dt * 0.005;
    }
    this.mousePhase += dt * 0.005;
    for (const p of this.pulses) p.age += dt;
    this.pulses = this.pulses.filter((p) => p.age < p.life);
  }

  private tick(dt: number): void {
    if (this.mouseFeedCooldown > 0) this.mouseFeedCooldown -= dt;

    if (this.fade > 0) {
      this.ctx.fillStyle = `rgba(5, 8, 13, ${this.fade})`;
      this.ctx.fillRect(0, 0, this.logicalWidth, this.logicalHeight);
    }

    const step = this.p('step');
    const lineWidth = this.p('lineWidth');
    const branchProb = this.effectiveBranchProb();
    const maxTips = this.effectiveMaxTips();

    this.ctx.lineCap = 'round';
    for (let s = 0; s < this.stepsPerFrame; s++) {
      for (const tip of this.tips) {
        if (tip.alive && Math.random() < this.speed) {
          this.stepTip(tip, step, lineWidth, branchProb, maxTips);
        }
      }
    }

    this.tips = this.tips.filter((t) => t.alive);
    // Keep the colony alive and foraging: re-extend from the frontier (or the
    // origin) if it has dwindled, rather than letting it die out.
    if (this.tips.length < 3) {
      const a = this.tips.length ? this.tips[(Math.random() * this.tips.length) | 0] : this.origin;
      for (let i = 0; i < 3; i++) {
        this.tips.push({ x: a.x, y: a.y, dir: Math.random() * Math.PI * 2, alive: true });
      }
    }

    this.nutrients = this.nutrients.filter((n) => n.energy > 0);
    this.updateNutrients(dt);

    this.nutrientTimer += dt;
    if (this.nutrientTimer >= this.nutrientInterval) {
      this.nutrientTimer = 0;
      this.spawnNutrient();
    }

    this.drawNutrients();
  }
}
