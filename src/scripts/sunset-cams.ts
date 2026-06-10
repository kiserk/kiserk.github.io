// Curated live beach webcams used by the Golden Hour page.
//
// Every entry is a YouTube *live* stream, chosen specifically because YouTube
// embeds render in an iframe anywhere (no X-Frame-Options / CSP blocking and no
// auth wall, which is what breaks most proprietary surf cams). Cams are spread
// across world longitudes so that at any given moment one of them is near its
// local sunset and another near its local sunrise.
//
// Each `youtubeId` below was verified live/public via YouTube's oEmbed endpoint.
// To add a cam: confirm it is a public YouTube live stream, grab the 11-char id
// from its watch URL, and add an entry with accurate lat/lon. To replace a dead
// cam, just swap its `youtubeId` (the selection logic does the rest).

export interface SunsetCam {
  id: string;
  name: string;
  location: string;
  /** Latitude in decimal degrees (north positive). */
  lat: number;
  /** Longitude in decimal degrees (east positive). */
  lon: number;
  /** 11-character YouTube video id of a public live stream. */
  youtubeId: string;
}

export const CAMS: SunsetCam[] = [
  // --- Pacific ---
  {
    id: 'pipeline-oahu',
    name: 'Banzai Pipeline',
    location: 'North Shore, Oahu, Hawaii',
    lat: 21.665,
    lon: -158.053,
    youtubeId: 'iHw4jLNvUJA',
  },
  {
    id: 'orewa-nz',
    name: 'Orewa Beach',
    location: 'Hibiscus Coast, New Zealand',
    lat: -36.586,
    lon: 174.694,
    youtubeId: 'HUMY8M8K4A4',
  },

  // --- US West Coast ---
  {
    id: 'santa-monica',
    name: 'Santa Monica Beach',
    location: 'Los Angeles, California',
    lat: 34.008,
    lon: -118.499,
    youtubeId: 'qmE7U1YZPQA',
  },
  {
    id: 'glass-beach',
    name: 'Glass Beach',
    location: 'Fort Bragg, California',
    lat: 39.448,
    lon: -123.812,
    youtubeId: 'zaTW0UqZCzY',
  },

  // --- US Gulf / Southeast ---
  {
    id: 'vue-30a',
    name: 'The Vue on 30A',
    location: 'Santa Rosa Beach, Florida',
    lat: 30.366,
    lon: -86.23,
    youtubeId: 'ftGfQqCA184',
  },
  {
    id: 'clearwater',
    name: "Frenchy's Clearwater Beach",
    location: 'Clearwater, Florida',
    lat: 27.978,
    lon: -82.827,
    youtubeId: 'rxBBRLWF0mM',
  },

  // --- Caribbean ---
  {
    id: 'soggy-dollar',
    name: 'Soggy Dollar Bar',
    location: 'Jost Van Dyke, British Virgin Islands',
    lat: 18.447,
    lon: -64.749,
    youtubeId: 'LXWVYoBluT4',
  },
  {
    id: 'st-croix',
    name: 'The Fred',
    location: 'Frederiksted, St. Croix, USVI',
    lat: 17.711,
    lon: -64.883,
    youtubeId: 'gdbRASr1dJw',
  },

  // --- Eastern Atlantic ---
  {
    id: 'reis-magos',
    name: 'Praia dos Reis Magos',
    location: 'Caniço, Madeira, Portugal',
    lat: 32.64,
    lon: -16.835,
    youtubeId: '4bgsscC-fJc',
  },

  // --- Mediterranean ---
  {
    id: 'ibiza',
    name: 'Sant Antoni Sunset Strip',
    location: 'Ibiza, Spain',
    lat: 38.967,
    lon: 1.3,
    youtubeId: 'f6tsHCx4-3g',
  },

  // --- East Asia ---
  {
    id: 'okinawa',
    name: 'Kariyushi Beach',
    location: 'Okinawa, Japan',
    lat: 26.5,
    lon: 127.918,
    youtubeId: 'QuS6sJXQyVE',
  },
];

export function embedUrl(cam: SunsetCam): string {
  const params = new URLSearchParams({
    autoplay: '1',
    mute: '1',
    playsinline: '1',
    rel: '0',
  });
  return `https://www.youtube.com/embed/${cam.youtubeId}?${params.toString()}`;
}

export function watchUrl(cam: SunsetCam): string {
  return `https://www.youtube.com/watch?v=${cam.youtubeId}`;
}
