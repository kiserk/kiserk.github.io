export interface OceanData {
  wave: {
    height: number;
    period: number;
    direction: number;
    swellHeight: number;
    windWaveHeight: number;
  };
  wind: {
    speed: number;
    direction: number;
    isOffshore: boolean;
  };
  tide: {
    current: number;
    rising: boolean;
  };
  sky: {
    cloudCover: number;
    temperature: number;
  };
  timestamp: number;
}

interface MarineHourly {
  time: string[];
  wave_height: (number | null)[];
  wave_period: (number | null)[];
  wave_direction: (number | null)[];
  wind_wave_height: (number | null)[];
  swell_wave_height: (number | null)[];
  swell_wave_period: (number | null)[];
}

interface MarineResponse {
  hourly: MarineHourly;
}

interface WeatherCurrent {
  wind_speed_10m: number;
  wind_direction_10m: number;
  cloud_cover: number;
  temperature_2m: number;
}

interface WeatherResponse {
  current: WeatherCurrent;
}

interface TidePrediction {
  t: string;
  v: string;
  type: "H" | "L";
}

interface TideResponse {
  predictions: TidePrediction[];
}

interface CacheEntry {
  marine: MarineResponse | null;
  weather: WeatherResponse | null;
  tides: TideResponse | null;
  timestamp: number;
}

const CACHE_KEY = "ocean-data-cache";
const CACHE_TTL = 30 * 60 * 1000;

const DEFAULTS: OceanData = {
  wave: { height: 0.6, period: 8, direction: 180, swellHeight: 0.4, windWaveHeight: 0.2 },
  wind: { speed: 16, direction: 225, isOffshore: false },
  tide: { current: 0.5, rising: true },
  sky: { cloudCover: 50, temperature: 20 },
  timestamp: Date.now(),
};

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function readCache(): CacheEntry | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CacheEntry;
  } catch {
    return null;
  }
}

function writeCache(entry: CacheEntry): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    // storage full or unavailable
  }
}

async function fetchMarine(): Promise<MarineResponse> {
  const url =
    "https://marine-api.open-meteo.com/v1/marine?latitude=40.58&longitude=-73.82&hourly=wave_height,wave_period,wave_direction,wind_wave_height,swell_wave_height,swell_wave_period&models=ncep_gfswave016&timezone=America%2FNew_York&forecast_days=1";
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Marine API ${res.status}`);
  return res.json();
}

async function fetchWeather(): Promise<WeatherResponse> {
  const url =
    "https://api.open-meteo.com/v1/forecast?latitude=40.58&longitude=-73.82&current=wind_speed_10m,wind_direction_10m,cloud_cover,temperature_2m&timezone=America%2FNew_York";
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Weather API ${res.status}`);
  return res.json();
}

async function fetchTides(): Promise<TideResponse> {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const url =
    `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?station=8531680&product=predictions&begin_date=${formatDate(now)}&end_date=${formatDate(tomorrow)}&datum=MLLW&time_zone=lst_ldt&units=english&interval=hilo&application=KarlKiserSite&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Tides API ${res.status}`);
  return res.json();
}

function parseMarineAtCurrentHour(data: MarineResponse): OceanData["wave"] {
  const now = new Date();
  const eastern = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const currentHour = eastern.getHours();
  const times = data.hourly.time;

  let idx = 0;
  for (let i = 0; i < times.length; i++) {
    const hour = new Date(times[i]).getHours();
    if (hour <= currentHour) idx = i;
  }

  return {
    height: data.hourly.wave_height[idx] ?? DEFAULTS.wave.height,
    period: data.hourly.wave_period[idx] ?? DEFAULTS.wave.period,
    direction: data.hourly.wave_direction[idx] ?? DEFAULTS.wave.direction,
    swellHeight: data.hourly.swell_wave_height[idx] ?? DEFAULTS.wave.swellHeight,
    windWaveHeight: data.hourly.wind_wave_height[idx] ?? DEFAULTS.wave.windWaveHeight,
  };
}

function parseWeather(data: WeatherResponse): { wind: OceanData["wind"]; sky: OceanData["sky"] } {
  const dir = data.current.wind_direction_10m;
  // Rockaway faces south: offshore = wind blowing from land (N half: 270-360 or 0-90)
  const isOffshore = dir >= 270 || dir <= 90;

  return {
    wind: {
      speed: data.current.wind_speed_10m,
      direction: dir,
      isOffshore,
    },
    sky: {
      cloudCover: data.current.cloud_cover,
      temperature: data.current.temperature_2m,
    },
  };
}

function interpolateTide(data: TideResponse): OceanData["tide"] {
  const predictions = data.predictions;
  if (!predictions || predictions.length === 0) return DEFAULTS.tide;

  const now = Date.now();

  // Find bracketing predictions: last one before now and first one after now
  let before: TidePrediction | null = null;
  let after: TidePrediction | null = null;

  for (const p of predictions) {
    const t = new Date(p.t).getTime();
    if (t <= now) before = p;
    else if (!after) after = p;
  }

  if (!before || !after) {
    const rising = after ? after.type === "H" : true;
    return { current: 0.5, rising };
  }

  const beforeTime = new Date(before.t).getTime();
  const afterTime = new Date(after.t).getTime();
  const progress = (now - beforeTime) / (afterTime - beforeTime);

  // Normalize: if before is low and after is high, progress goes 0→1
  // If before is high and after is low, progress goes 1→0
  const rising = after.type === "H";
  const current = rising ? progress : 1 - progress;

  return { current: Math.max(0, Math.min(1, current)), rising };
}

function buildOceanData(cache: CacheEntry): OceanData {
  const wave = cache.marine ? parseMarineAtCurrentHour(cache.marine) : DEFAULTS.wave;
  const { wind, sky } = cache.weather ? parseWeather(cache.weather) : { wind: DEFAULTS.wind, sky: DEFAULTS.sky };
  const tide = cache.tides ? interpolateTide(cache.tides) : DEFAULTS.tide;

  return { wave, wind, tide, sky, timestamp: cache.timestamp };
}

export async function getOceanData(): Promise<OceanData> {
  try {
    const cached = readCache();
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return buildOceanData(cached);
    }

    const [marineResult, weatherResult, tidesResult] = await Promise.allSettled([
      fetchMarine(),
      fetchWeather(),
      fetchTides(),
    ]);

    const entry: CacheEntry = {
      marine: marineResult.status === "fulfilled" ? marineResult.value : (cached?.marine ?? null),
      weather: weatherResult.status === "fulfilled" ? weatherResult.value : (cached?.weather ?? null),
      tides: tidesResult.status === "fulfilled" ? tidesResult.value : (cached?.tides ?? null),
      timestamp: Date.now(),
    };

    writeCache(entry);
    return buildOceanData(entry);
  } catch {
    const stale = readCache();
    if (stale) return buildOceanData(stale);
    return { ...DEFAULTS, timestamp: Date.now() };
  }
}
