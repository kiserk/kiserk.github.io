# Mycelium easter egg

A site-wide, ignorable easter egg: a lo-fi, borderless mycelium growth simulation
that lives quietly on top of the page and "wakes up" on interaction. It is
**decorative only** (`aria-hidden`), so it has zero effect on content, layout,
SEO, crawlers, or keyboard/AT users who don't opt in.

This doc is the source of truth for the subsystem. Read it before changing any of
the mycelium files; the simulation is intentionally tuned and small behavioural
changes interact (growth, branching, vigor, nutrients, performance).

---

## TL;DR for the next person

- **What the user sees:** hold the mouse still anywhere (not over a link/button)
  → the cursor morphs into a little mycelium tip and a faint colony begins to
  creep out from that point. Press-and-hold briefly → the page dissolves into a
  full-screen growth sim. Move the mouse to lure/feed the colony, click to drop
  nutrients, arrow keys to bias drift, **ESC** to dissolve back to the site.
- **Where it's wired:** `BaseLayout.astro` renders `<MyceliumEasterEgg />` once,
  so it's on every page.
- **Where to tune look/feel:** the live preview page `/mycelium-preview` (dev
  only) with a slider panel, backed by `window.__myc`.
- **The three moving parts:** an interaction controller (Astro component), a
  growth/render engine (`MyceliumRenderer`), and tunable morphologies
  (`SPECIES`).

---

## File map

| File | Role |
| --- | --- |
| `src/components/MyceliumEasterEgg.astro` | Markup (cursor SVG, overlay, two canvases, hint), scoped styles, and the **interaction controller** (dwell → seed → active → exit state machine, event gating, `window.__myc` debug handle). |
| `src/scripts/mycelium-renderer.ts` | `MyceliumRenderer` — the **simulation + rendering engine**. Neighbour-Sensing growth, density field, nutrients, mouse-as-nutrient, vigor/phase transitions, uptake pulses, lifecycle (`start/stop/resize/destroy`), and tuning setters. |
| `src/scripts/mycelium-growth.ts` | `Species` interface + `SPECIES` presets (`airy`, `dense`, `fan`) and helpers (`speciesByName`, `nextSpecies`). Tunable growth morphologies the renderer reads every frame. |
| `src/pages/mycelium-preview.astro` | **Dev-only** preview + tuning panel. Mounts the component over sample content/links and drives the renderer via `window.__myc`. Not linked in nav. (See "Preview page / going to production".) |
| `src/layouts/BaseLayout.astro` | Mounts `<MyceliumEasterEgg />` after `<slot />`, site-wide. |

The lifecycle/DPR pattern intentionally mirrors `src/scripts/ocean-renderer.ts`.

---

## Interaction model (the state machine)

States live in `MyceliumEasterEgg.astro` as `mode: 'idle' | 'seed' | 'active'`,
plus `overlay.dataset.state` (drives CSS) and the `body.myc-dwell` /
`body.myc-active` classes.

```
idle ──(mouse still DWELL_MS, over non-interactive)──► seed
seed ──(press-hold HOLD_MS)──────────────────────────► active
seed ──(move > SEED_ABANDON, or blur)────────────────► idle  (abandon)
active ──(ESC / pagehide)─────────────────────────────► idle  (exit)
```

- **idle:** nothing visible. A `pointermove` over a non-interactive target arms a
  `DWELL_MS` timer.
- **seed (the "teaser"):** the cursor morphs (`body.myc-dwell` shows the SVG tip)
  and a colony quietly starts growing **over the live page** (the overlay is
  transparent in this state — the dark backdrop has not dissolved in yet). It
  grows at `SEED_INIT_SPEED` for `SEED_SLOW_AFTER` ms, then drops to
  `SEED_SLOW_SPEED` so it "creeps really slowly" if you keep hovering. Small
  pointer jitter is tolerated; moving past `SEED_ABANDON` px abandons it.
- **active (the game):** committing reuses the *same* renderer (the seed growth
  continues seamlessly), the dark backdrop dissolves in, the overlay captures
  pointer events, and the real cursor is hidden (the mouse is drawn as a
  nutrient blob instead).

### Timing/threshold constants (top of the component script)

| Const | Default | Meaning |
| --- | --- | --- |
| `DWELL_MS` | 700 | mouse-still time before the cursor morphs + seed starts |
| `HOLD_MS` | 260 | press-hold duration to commit into the full game |
| `MOVE_TOL` | 6 | drag (px) beyond which a pending hold is cancelled |
| `SEED_ABANDON` | 14 | move (px) from the seed point that abandons the teaser |
| `SEED_INIT_SPEED` | 0.28 | growth speed for the initial seed burst |
| `SEED_SLOW_SPEED` | 0.045 | "really slow" creep once the seed is established |
| `SEED_SLOW_AFTER` | 2800 | ms of initial growth before slowing the creep |
| `GAME_SPEED` | 0.26 | growth speed once the game is active |

### Gating (so it never fights the real site)

- `armDwell`/`pointerdown` bail if the target matches
  `a, button, input, textarea, select, label, summary, [role="button"], [contenteditable]`
  (`isInteractive`) or if there's a text selection (`hasSelection`). So clicking
  links, buttons, form fields, or selecting text never triggers the game.
- `prefers-reduced-motion`: the whole dwell/seed path is disabled, the morph
  cursor is `display:none`, and if the game is force-started the renderer runs in
  reduced-motion mode (slower, calmer Brownian wiggle).
- `blur`/`pagehide` abandon seed / exit so nothing runs in the background.

### In-game controls (active mode)

- **Move mouse:** sets the "oxygen" bias point and the live mouse-nutrient (see
  below). The colony forages toward and feeds on the cursor.
- **Left-click:** `dropNutrient(x, y)` — drops a permanent nutrient (hard cap 48).
- **Arrow keys:** `nudge()` — bias the global drift direction (±1 clamped).
- **ESC:** exit (dissolve back to the page).

---

## Rendering architecture

Two stacked full-viewport canvases inside `#myc-overlay`:

- `#myc-canvas` — **persistent** hyphae. Lines accumulate here frame over frame
  (it is *not* cleared each frame). Optional `fade` can slowly dim history.
- `#myc-fx` — **dynamic** layer, **cleared every frame**. Holds the wiggling
  nutrient blobs, the mouse-nutrient, and the uptake pulses. This split exists
  because drawing wobbling outlines on the persistent canvas smears them into
  filled blobs — the fx layer keeps them crisp.

Both are sized with `devicePixelRatio` (capped to 1.5 on touch devices for
perf) and use `setTransform(dpr,...)` so all drawing is in logical px. `resize()`
rebuilds canvases + the density grid on viewport changes.

`#myc-overlay` sits at `z-index: 60` (cursor SVG at 70), above the page but the
backdrop only becomes opaque in `active`, so `seed` growth overlays live content.

---

## Growth model — Neighbour-Sensing

Based on the **Neighbour-Sensing model** (Meskauskas, Fricker & Moore, 2004).
Each hyphal **tip** advances by a growth vector adjusted by tropisms read from a
coarse hyphal **density field** (`density: Float32Array` on a `cellSize=12` grid;
`deposit()` on each step, `densAt()` to read).

`nextDir(tip)` builds a steering vector from four contributions, then clamps the
turn per step (`maxTurn`) and adds small Gaussian heading wobble (`angleJitter`,
species-level):

1. **Persistence** (`persistence`, default 1.8) — keep the current heading
   (gives straight, organic runs rather than random walks).
2. **Negative autotropism** (`autotropism`, 1.1) — steer *down* the local density
   gradient, i.e. away from existing hyphae, so tips colonise empty space and the
   colony keeps an even advancing margin.
3. **Chemotropism** (`chemotropism`, 0.6; `chemoRange` 200px) — gentle,
   distance-weighted attraction toward the nearest nutrient.
4. **Oxygen tropism** (`oxygen`, 0.34) — gentle attraction toward the mouse bias
   point, plus arrow-key `drift`.

`stepTip()` then:

- draws the segment on the persistent canvas, deposits density, advances the tip;
- checks nutrient catch (consume) and mouse-nutrient catch (feed);
- **density-gated branching:** branch only where `local < branchThreshold`
  (margin), so it forks at the frontier, not the crowded interior. The fork
  half-angle is the species' `branchAngle`.
- **apical senescence:** a tip dies with `dieProb`, or with extra probability
  (`crowdDeath`) when `local > crowdDensity`. This concentrates growth at the
  advancing margin and prevents the interior from over-filling.

A floor keeps the colony alive: if living tips drop below 3, it re-extends from
the frontier (or origin).

### Key growth parameters (renderer defaults)

| Param | Default | Effect |
| --- | --- | --- |
| `autotropism` | 1.1 | avoidance of existing hyphae (space-filling evenness) |
| `chemotropism` | 0.6 | pull toward nutrients |
| `chemoRange` | 200 | nutrient sensing radius (px) |
| `oxygen` | 0.34 | pull toward the mouse |
| `persistence` | 1.8 | straightness / heading inertia |
| `maxTurn` | 0.09 | max radians turned per step |
| `branchThreshold` | 5 | suppress branching above this local density |
| `crowdDensity` | 14 | density above which tips start senescing |
| `crowdDeath` | 0.05 | extra death prob in crowded cells |
| `speed` | 0.26 | per-frame probability each tip steps (overall pace) |

---

## Vigor, phase transitions & nutrient uptake (the "dramatic" bits)

**Vigor** (`0 .. maxVigor`, default cap **10**) is colony maturity. It rises one
step each time a nutrient is fully exhausted (and a little on mouse feeding).
Higher vigor scales:

- `effectiveBranchProb() = branchProb * (1 + vigor * 0.5)` — branching surges
  hard as the colony matures.
- `effectiveMaxTips() = maxTips * (1 + vigor * 0.22)` — the tip budget grows.

**Nutrient uptake (`consume`)** is deliberately punchy:

- On *contact*: a burst of **5–8** new foraging tips fan out from the nutrient,
  plus a soft expanding **pulse** ring on the fx layer.
- On *exhaustion* (energy ≤ 0) — a **phase transition**: `vigor += 1`, a bigger
  radial proliferation of **8–12** tips, a **strong** double-ring pulse (greenish,
  larger/brighter), and a **species switch** (`nextSpecies`, see below). This is
  the visible "the colony just levelled up" moment.

**Pulses** (`Pulse[]`, drawn in `drawPulses()`): transient ease-out expanding
rings on the fx layer. Normal uptake = small whitish ring; phase transition =
larger green ring + inner ring. Purely cosmetic feedback for uptake/maturation.

> Tuning these for more/less drama: burst counts and `addPulse(...)` sizes live
> in `consume()` / `burstTips()` / `addPulse()`; the vigor multipliers live in
> `effectiveBranchProb`/`effectiveMaxTips`; the cap is `maxVigor`.

---

## Nutrients

Three ways nutrients appear, all share the `Nutrient` shape and rendering:

1. **Spontaneous** (`spawnNutrient`, every `nutrientInterval` ≈ 2400ms, capped at
   `maxNutrients` = 5): spawned roughly *ahead of a foraging tip* so the colony
   grows into food rather than starving.
2. **Player-dropped** (`dropNutrient(x,y)`, on left-click; hard cap 48): permanent
   food at the clicked point.
3. **The mouse itself** (mobile, refilling): while active, the cursor is a live
   nutrient — hyphae forage toward it (via the oxygen tropism) and **feed** on it
   when a tip reaches it. Feeding is throttled (`mouseFeedCooldown` ≈ 130ms) so
   hovering can't spawn tips without bound; it never depletes, so you can graze it
   around the screen. It's drawn as a slightly larger/brighter blob at the cursor.

**Look:** small (r 4–6px) **hollow, cartoony, wobbling amorphous** outlines drawn
with quadratic curves through 8 per-vertex-phased points (`drawBlob`). They drift
with **Brownian motion** (`updateNutrients`: jitter accumulates, leashed to 3.5px
from a fixed anchor) and wobble via a per-nutrient `phase`.

---

## Species (morphologies)

`SPECIES` in `mycelium-growth.ts` are the tunable growth algorithms. The renderer
reads them every frame, so the preview panel can change them live. Exhausting a
nutrient rotates to the next species (`nextSpecies`), so a run visibly cycles
morphologies as it matures.

| Species | Character | Notable params |
| --- | --- | --- |
| `airy` | open radial colony, long straight runs, occasional lateral branches | `step 1.0`, `branchProb 0.02`, `angleJitter 0.06`, `maxTips 70` |
| `dense` | exploitative thickening, shorter steps, frequent wide branches | `step 0.85`, `branchProb 0.05`, `angleJitter 0.12`, `maxTips 130` |
| `fan` | directed advance, straightest runs, narrow cord-like branches | `step 1.2`, `branchProb 0.03`, `angleJitter 0.035`, `maxTips 90` |

Per-species fields: `step`, `branchProb`, `dieProb`, `angleJitter`, `branchAngle`,
`lineWidth`, `oxygenPull`, `maxTips` (see the interface JSDoc).

---

## Public API / debug handle

The component exposes `window.__myc` (used by the preview page and handy in the
console):

| Member | Purpose |
| --- | --- |
| `__myc.start(x?, y?)` | force-commit into the game at a point (defaults to center) |
| `__myc.stop()` | exit |
| `__myc.isActive()` / `__myc.getMode()` | state introspection |
| `__myc.getRenderer()` | the live `MyceliumRenderer` (or `null`) |

`MyceliumRenderer` tuning setters (mostly write to `overrides` so they layer over
the active species): `setStep`, `setBranchProb`, `setAngleJitter`, `setLineWidth`,
`setMaxTips`, `setOxygenPull`, `setAutotropism`, `setChemotropism`, `setMaxTurn`,
`setPersistence`, `setSpeed`, `setStepsPerFrame`, `setFade`, `forceSpecies`,
`reset`, `getStats` (`{ tips, nutrients, species, vigor }`).

---

## Accessibility & performance

- `aria-hidden` on cursor + overlay; decorative only, never in tab order.
- Full `prefers-reduced-motion` path (no dwell/seed; calmer sim if forced).
- Touch DPR capped at 1.5; tips capped via `maxTips`/`effectiveMaxTips`; nutrients
  capped; pulses are short-lived and filtered out.
- Single `requestAnimationFrame` loop; `destroy()` cancels it and frees arrays.
  `blur`/`pagehide` tear down so nothing runs unattended.

---

## Preview page / going to production

`src/pages/mycelium-preview.astro` is a **developer** page (slider panel + sample
content) for tuning offline, driven via `window.__myc`. It is **kept local-only
(untracked / not committed)** so it never ships to production — Astro otherwise
builds/serves/sitemaps any non-`_`-prefixed page under `src/pages/`.

To resume tuning: the file lives on disk locally; `npm run dev` serves it at
`/mycelium-preview`. If you ever want it in the repo without shipping it, commit
it as `src/pages/_mycelium-preview.astro` (Astro skips `_`-prefixed files — same
trick as `_golden-hour.astro`), and drop the `_` while iterating.

---

## Tuning cheat sheet — "I want to change X"

| Goal | Where |
| --- | --- |
| Faster/slower to trigger | `DWELL_MS`, `HOLD_MS` in the component |
| Seed creep behaviour | `SEED_*` consts in the component |
| Overall growth pace | `speed` (renderer) / `GAME_SPEED` (component) |
| More/less branching | species `branchProb` + `effectiveBranchProb` vigor mult |
| Bigger uptake/level-up effect | burst counts in `consume`, `addPulse` sizes, `maxVigor` |
| Mouse attraction strength | `oxygen` (renderer) |
| Nutrient attraction/sensing | `chemotropism`, `chemoRange` |
| Space-filling evenness | `autotropism`, `crowdDensity`, `crowdDeath` |
| Straightness | `persistence`, `maxTurn`, species `angleJitter` |
| Nutrient size/look/wiggle | `makeNutrient` (`r`), `drawBlob`, `updateNutrients` |
| New morphology | add to `SPECIES` in `mycelium-growth.ts` |
| Backdrop/contrast | `#myc-overlay::before` (game) + `OceanBackground.astro` overlay (site) |

---

## Known limitations / future ideas

- Growth is unbounded in time (kept in check by senescence + caps, not a hard
  generation limit); very long sessions stay bounded but dense.
- No sound, no scoring — intentionally ambient/ignorable.
- Possible future: per-species nutrient effects, touch-friendly trigger, a subtle
  "you found it" affordance, persisting a colony across navigation.
