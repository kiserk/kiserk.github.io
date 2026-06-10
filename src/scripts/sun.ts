// Self-contained solar position math (no dependencies).
//
// Given a latitude/longitude and a moment in time, compute the sun's elevation
// above the horizon and whether it is in the morning (rising) or afternoon
// (setting) half of the day. Used to pick whichever curated cam is currently
// closest to its sunset or sunrise.
//
// Accuracy is well within a degree, which is far more than enough to decide
// which beach on Earth is at golden hour right now.

const RAD = Math.PI / 180;

export interface SolarPosition {
  /** Sun elevation above the horizon, in degrees (negative = below horizon). */
  elevation: number;
  /** Hour angle in degrees: < 0 before solar noon (morning), > 0 after (afternoon). */
  hourAngle: number;
  /** Sun declination in degrees. */
  declination: number;
}

export function solarPosition(lat: number, lon: number, date: Date): SolarPosition {
  // Days since the J2000.0 epoch.
  const n = date.getTime() / 86400000 + 2440587.5 - 2451545.0;

  // Mean longitude and mean anomaly of the sun (degrees).
  const L = norm360(280.46 + 0.9856474 * n);
  const g = norm360(357.528 + 0.9856003 * n);

  // Ecliptic longitude (degrees) and obliquity of the ecliptic.
  const lambda = norm360(L + 1.915 * Math.sin(g * RAD) + 0.02 * Math.sin(2 * g * RAD));
  const epsilon = 23.439 - 0.0000004 * n;

  // Declination and right ascension of the sun.
  const declination = Math.asin(Math.sin(epsilon * RAD) * Math.sin(lambda * RAD)) / RAD;
  const ra =
    Math.atan2(
      Math.cos(epsilon * RAD) * Math.sin(lambda * RAD),
      Math.cos(lambda * RAD),
    ) / RAD;

  // Local hour angle = local sidereal time - right ascension.
  const gmst = norm360(280.46061837 + 360.98564736629 * n);
  const lst = norm360(gmst + lon);
  const hourAngle = norm180(lst - ra);

  const elevation =
    Math.asin(
      Math.sin(lat * RAD) * Math.sin(declination * RAD) +
        Math.cos(lat * RAD) * Math.cos(declination * RAD) * Math.cos(hourAngle * RAD),
    ) / RAD;

  return { elevation, hourAngle, declination };
}

export type GoldenHourMode = 'sunset' | 'sunrise';

// Sweet spot of golden hour: a touch above the horizon.
const GOLDEN_TARGET_DEG = 1;
// Penalty applied when the sun is on the wrong side of solar noon for the mode.
const WRONG_DIRECTION_PENALTY = 1000;

/**
 * Lower is better. Scores how close a location currently is to the requested
 * golden hour: near the horizon AND on the correct side of solar noon (rising
 * for sunrise, setting for sunset).
 */
export function scoreCam(
  position: Pick<SolarPosition, 'elevation' | 'hourAngle'>,
  mode: GoldenHourMode,
): number {
  const isAfternoon = position.hourAngle > 0;
  const directionOk = mode === 'sunset' ? isAfternoon : !isAfternoon;
  let score = Math.abs(position.elevation - GOLDEN_TARGET_DEG);
  if (!directionOk) score += WRONG_DIRECTION_PENALTY;
  return score;
}

function norm360(deg: number): number {
  const d = deg % 360;
  return d < 0 ? d + 360 : d;
}

function norm180(deg: number): number {
  let d = norm360(deg);
  if (d > 180) d -= 360;
  return d;
}
