// Curated live beach webcams used by the Golden Hour page.
//
// Cams are chosen specifically because they embed in an iframe from any origin
// (no X-Frame-Options / CSP frame-ancestors blocking and no auth wall, which is
// what breaks most proprietary surf cams). They are spread across world
// longitudes so that at any moment one of them is near its local sunset and
// another near its local sunrise.
//
// Two source kinds are supported:
//   - 'youtube': a public YouTube live stream id (most stable; preferred).
//   - 'iframe':  any directly-embeddable iframe URL (e.g. rtsp.me, coastalcoms).
//
// Every cam below was verified embeddable during implementation: YouTube ids via
// the oEmbed endpoint, iframe URLs by confirming they return 200 with no
// frame-blocking headers. To add a cam, pick a source it allows to be embedded
// off-site and give it accurate lat/lon. To replace a dead cam, swap its source.

export type CamSource =
  | { kind: 'youtube'; youtubeId: string }
  | { kind: 'iframe'; embed: string; watch?: string };

export interface SunsetCam {
  id: string;
  name: string;
  location: string;
  /** Latitude in decimal degrees (north positive). */
  lat: number;
  /** Longitude in decimal degrees (east positive). */
  lon: number;
  source: CamSource;
  /** Short provider attribution shown next to the cam (e.g. "YouTube"). */
  credit: string;
}

const yt = (youtubeId: string): CamSource => ({ kind: 'youtube', youtubeId });

export const CAMS: SunsetCam[] = [
  // --- Pacific ---
  {
    id: 'pipeline-oahu',
    name: 'Banzai Pipeline',
    location: 'North Shore, Oahu, Hawaii',
    lat: 21.665,
    lon: -158.053,
    source: yt('iHw4jLNvUJA'),
    credit: 'explore.org',
  },
  {
    id: 'orewa-nz',
    name: 'Orewa Beach',
    location: 'Hibiscus Coast, New Zealand',
    lat: -36.586,
    lon: 174.694,
    source: yt('HUMY8M8K4A4'),
    credit: 'YouTube',
  },

  // --- US West Coast ---
  {
    id: 'santa-monica',
    name: 'Santa Monica Beach',
    location: 'Los Angeles, California',
    lat: 34.008,
    lon: -118.499,
    source: yt('qmE7U1YZPQA'),
    credit: 'explore.org',
  },
  {
    id: 'glass-beach',
    name: 'Glass Beach',
    location: 'Fort Bragg, California',
    lat: 39.448,
    lon: -123.812,
    source: yt('zaTW0UqZCzY'),
    credit: 'YouTube',
  },

  // --- US Gulf / Southeast ---
  {
    id: 'vue-30a',
    name: 'The Vue on 30A',
    location: 'Santa Rosa Beach, Florida',
    lat: 30.366,
    lon: -86.23,
    source: yt('ftGfQqCA184'),
    credit: 'YouTube',
  },
  {
    id: 'clearwater',
    name: "Frenchy's Clearwater Beach",
    location: 'Clearwater, Florida',
    lat: 27.978,
    lon: -82.827,
    source: yt('rxBBRLWF0mM'),
    credit: 'YouTube',
  },

  // --- Caribbean ---
  {
    id: 'soggy-dollar',
    name: 'Soggy Dollar Bar',
    location: 'Jost Van Dyke, British Virgin Islands',
    lat: 18.447,
    lon: -64.749,
    source: yt('LXWVYoBluT4'),
    credit: 'YouTube',
  },
  {
    id: 'st-croix',
    name: 'The Fred',
    location: 'Frederiksted, St. Croix, USVI',
    lat: 17.711,
    lon: -64.883,
    source: yt('gdbRASr1dJw'),
    credit: 'YouTube',
  },

  // --- Eastern Atlantic ---
  {
    id: 'reis-magos',
    name: 'Praia dos Reis Magos',
    location: 'Caniço, Madeira, Portugal',
    lat: 32.64,
    lon: -16.835,
    source: yt('4bgsscC-fJc'),
    credit: 'Madeira-Web',
  },

  // --- Mediterranean ---
  {
    id: 'ibiza',
    name: 'Sant Antoni Sunset Strip',
    location: 'Ibiza, Spain',
    lat: 38.967,
    lon: 1.3,
    source: yt('f6tsHCx4-3g'),
    credit: 'YouTube',
  },

  // --- Southern Africa ---
  {
    id: 'bloubergstrand',
    name: 'Bloubergstrand',
    location: 'Cape Town, South Africa',
    lat: -33.81,
    lon: 18.46,
    source: yt('-M9V6mhpxYw'),
    credit: 'Table Mountain Live',
  },

  // --- Indian Ocean ---
  {
    id: 'seychelles',
    name: 'North Island',
    location: 'Seychelles',
    lat: -4.395,
    lon: 55.246,
    source: yt('Thtj8Ht7Z_c'),
    credit: 'YouTube',
  },
  {
    id: 'maldives',
    name: 'InterContinental Maldives',
    location: 'Raa Atoll, Maldives',
    lat: 5.483,
    lon: 72.997,
    source: yt('_BMi3usEwi8'),
    credit: 'YouTube',
  },

  // --- Southeast Asia (rtsp.me iframe) ---
  {
    id: 'kata-phuket',
    name: 'Kata Beach',
    location: 'Phuket, Thailand',
    lat: 7.82,
    lon: 98.298,
    source: {
      kind: 'iframe',
      embed: 'https://rtsp.me/embed/2F8DfBS5/',
      watch: 'https://www.sssphuket.com/kata-beach-live-cam/',
    },
    credit: 'rtsp.me / SSS Phuket',
  },

  // --- East Asia ---
  {
    id: 'okinawa',
    name: 'Kariyushi Beach',
    location: 'Okinawa, Japan',
    lat: 26.5,
    lon: 127.918,
    source: yt('QuS6sJXQyVE'),
    credit: 'YouTube',
  },

  // --- Australia (coastalcoms iframe) ---
  {
    id: 'gold-coast-seaway',
    name: 'Gold Coast Seaway',
    location: 'Southport, Queensland, Australia',
    lat: -27.937,
    lon: 153.428,
    source: {
      kind: 'iframe',
      embed: 'https://widget.coastalcoms.com/video/962b4313-7445-46eb-b731-56edc8483082',
      watch: 'https://www.vmrsouthport.com.au/surfcam/',
    },
    credit: 'VMR Southport',
  },
];

export function embedUrl(cam: SunsetCam): string {
  if (cam.source.kind === 'youtube') {
    const params = new URLSearchParams({
      autoplay: '1',
      mute: '1',
      playsinline: '1',
      rel: '0',
    });
    return `https://www.youtube.com/embed/${cam.source.youtubeId}?${params.toString()}`;
  }
  return cam.source.embed;
}

export function watchUrl(cam: SunsetCam): string {
  if (cam.source.kind === 'youtube') {
    return `https://www.youtube.com/watch?v=${cam.source.youtubeId}`;
  }
  return cam.source.watch ?? cam.source.embed;
}
