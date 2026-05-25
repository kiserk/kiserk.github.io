export interface SurfSpot {
  id: string;
  name: string;
  lat: number;
  lon: number;
  beachFacing: number;
  tidesStation: string;
  region: string;
  camUrl?: string;
  camSnapshot?: string;
}

export function getWindType(
  windDirection: number,
  beachFacing: number,
): 'Offshore' | 'Onshore' | 'Cross' {
  let angleDiff = Math.abs(windDirection - beachFacing);
  if (angleDiff > 180) angleDiff = 360 - angleDiff;

  if (angleDiff <= 70) return 'Onshore';
  if (angleDiff >= 110) return 'Offshore';
  return 'Cross';
}

export const SPOTS: SurfSpot[] = [
  // California
  {
    id: 'huntington-beach',
    name: 'Huntington Beach',
    lat: 33.6553,
    lon: -117.9988,
    beachFacing: 220,
    tidesStation: '9410580',
    region: 'California',
  },
  {
    id: 'mavericks',
    name: 'Mavericks',
    lat: 37.4936,
    lon: -122.4969,
    beachFacing: 270,
    tidesStation: '9414290',
    region: 'California',
  },
  {
    id: 'santa-cruz',
    name: 'Santa Cruz',
    lat: 36.9515,
    lon: -122.026,
    beachFacing: 190,
    tidesStation: '9413450',
    region: 'California',
  },

  // Hawaii
  {
    id: 'pipeline-north-shore',
    name: 'Pipeline/North Shore',
    lat: 21.665,
    lon: -158.0539,
    beachFacing: 340,
    tidesStation: '1612340',
    region: 'Hawaii',
  },
  {
    id: 'waikiki',
    name: 'Waikiki',
    lat: 21.2676,
    lon: -157.8264,
    beachFacing: 190,
    tidesStation: '1612340',
    region: 'Hawaii',
  },

  // New England
  {
    id: 'nantucket',
    name: 'Nantucket, MA',
    lat: 41.2541,
    lon: -69.974,
    beachFacing: 180,
    tidesStation: '8449130',
    region: 'New England',
  },
  {
    id: 'narragansett',
    name: 'Narragansett, RI',
    lat: 41.43,
    lon: -71.4533,
    beachFacing: 170,
    tidesStation: '8452660',
    region: 'New England',
  },

  // New Jersey
  {
    id: 'long-branch',
    name: 'Long Branch',
    lat: 40.2929,
    lon: -73.9707,
    beachFacing: 90,
    tidesStation: '8531680',
    region: 'New Jersey',
  },
  {
    id: 'manasquan',
    name: 'Manasquan',
    lat: 40.1045,
    lon: -73.9718,
    beachFacing: 90,
    tidesStation: '8533615',
    region: 'New Jersey',
  },
  {
    id: 'sandy-hook',
    name: 'Sandy Hook',
    lat: 40.4622,
    lon: -73.9827,
    beachFacing: 90,
    tidesStation: '8531680',
    region: 'New Jersey',
  },

  // New York
  {
    id: 'long-beach-ny',
    name: 'Long Beach, NY',
    lat: 40.5883,
    lon: -73.6579,
    beachFacing: 180,
    tidesStation: '8531680',
    region: 'New York',
  },
  {
    id: 'montauk',
    name: 'Montauk',
    lat: 41.0469,
    lon: -71.9442,
    beachFacing: 170,
    tidesStation: '8510560',
    region: 'New York',
  },
  {
    id: 'rockaway',
    name: 'Rockaway Beach',
    lat: 40.5834,
    lon: -73.8163,
    beachFacing: 180,
    tidesStation: '8531680',
    region: 'New York',
    camUrl: 'https://nybeachcams.com/long-island/rockaway-beach-surf-cam/',
    camSnapshot: 'https://ccn-media.coastalcameranetwork.com/New_York/rockawaybeachoverview2.stream/latest.jpg',
  },

  // Southeast
  {
    id: 'cape-hatteras',
    name: 'Cape Hatteras, NC',
    lat: 35.2233,
    lon: -75.6191,
    beachFacing: 120,
    tidesStation: '8651370',
    region: 'Southeast',
  },
  {
    id: 'cocoa-beach',
    name: 'Cocoa Beach, FL',
    lat: 28.32,
    lon: -80.6076,
    beachFacing: 90,
    tidesStation: '8721604',
    region: 'Southeast',
  },
  {
    id: 'wrightsville-beach',
    name: 'Wrightsville Beach, NC',
    lat: 34.2088,
    lon: -77.796,
    beachFacing: 130,
    tidesStation: '8658120',
    region: 'Southeast',
  },
];

export function getDefaultSpot(): SurfSpot {
  return SPOTS.find((s) => s.id === 'rockaway')!;
}

export function getSpotById(id: string): SurfSpot | undefined {
  return SPOTS.find((s) => s.id === id);
}
