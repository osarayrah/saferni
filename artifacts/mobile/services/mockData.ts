import type {
  ActivityItem,
  Destination,
  FlightOffer,
  FlightSegment,
  HotelOffer,
  TripDraft,
} from '@/types/travel';

export function uid(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 9)}`;
}

// Deterministic pseudo-random from a string seed
export const DESTINATIONS: Destination[] = [
  {
    code: 'LCA', city: 'Larnaca', country: 'Cyprus',
    description: 'Beach resorts, warm Mediterranean water and relaxed seaside promenades.',
    suggestedNights: 5, budgetRange: '$900 – $2,400', bestMonths: 'May – Oct',
    tags: ['Beach', 'Relaxation', 'Food'], image: 'beach', latitude: 34.9167, longitude: 33.6233,
  },
  {
    code: 'CAI', city: 'Cairo', country: 'Egypt',
    description: 'Pyramids, museums and legendary street food on the Nile.',
    suggestedNights: 4, budgetRange: '$600 – $1,600', bestMonths: 'Oct – Apr',
    tags: ['Culture', 'History', 'Budget'], image: 'city', latitude: 30.0444, longitude: 31.2357,
  },
  {
    code: 'BEY', city: 'Beirut', country: 'Lebanon',
    description: 'Vibrant nightlife, mountain day trips and unbeatable cuisine.',
    suggestedNights: 4, budgetRange: '$700 – $1,800', bestMonths: 'Apr – Jun, Sep – Nov',
    tags: ['Food', 'Nightlife', 'Culture'], image: 'city', latitude: 33.8938, longitude: 35.5018,
  },
  {
    code: 'CDG', city: 'Paris', country: 'France',
    description: 'Museums, cafés and unforgettable evening strolls along the Seine.',
    suggestedNights: 5, budgetRange: '$1,400 – $3,500', bestMonths: 'Apr – Jun, Sep',
    tags: ['Culture', 'Food', 'Luxury'], image: 'city', latitude: 48.8566, longitude: 2.3522,
  },
  {
    code: 'BCN', city: 'Barcelona', country: 'Spain',
    description: 'Gaudí architecture, tapas crawls and city beaches in one trip.',
    suggestedNights: 5, budgetRange: '$1,100 – $2,800', bestMonths: 'May – Jun, Sep',
    tags: ['Beach', 'Culture', 'Nightlife'], image: 'beach', latitude: 41.3874, longitude: 2.1686,
  },
  {
    code: 'CUN', city: 'Cancún', country: 'Mexico',
    description: 'Caribbean beaches, cenotes and Mayan ruins within easy reach.',
    suggestedNights: 6, budgetRange: '$1,200 – $3,200', bestMonths: 'Dec – Apr',
    tags: ['Beach', 'Adventure', 'Relaxation'], image: 'beach', latitude: 21.1619, longitude: -86.8515,
  },
  {
    code: 'YUL', city: 'Montreal', country: 'Canada',
    description: 'European charm in North America — festivals, food markets and old-town cobblestones.',
    suggestedNights: 3, budgetRange: '$500 – $1,400', bestMonths: 'Jun – Sep',
    tags: ['City break', 'Food', 'Culture'], image: 'nature', latitude: 45.5019, longitude: -73.5674,
  },
  {
    code: 'IST', city: 'Istanbul', country: 'Türkiye',
    description: 'Bazaars, Bosphorus ferries and skyline sunsets between two continents.',
    suggestedNights: 4, budgetRange: '$700 – $1,900', bestMonths: 'Apr – Jun, Sep – Oct',
    tags: ['Culture', 'Food', 'Shopping'], image: 'city', latitude: 41.0082, longitude: 28.9784,
  },
];

const AIRLINES = [
  { code: 'SD', name: 'SkyDemo Air' },
  { code: 'BV', name: 'BlueVoyage' },
  { code: 'AT', name: 'AeroTrail' },
  { code: 'NW', name: 'NimbusWays' },
];

function isoAt(dateISO: string, hour: number, minute: number): string {
  return `${dateISO}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
}

function addMinutesISO(iso: string, minutes: number): string {
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() + minutes);
  return d.toISOString().slice(0, 19);
}

function makeItin(
  rnd: () => number,
  from: string,
  to: string,
  dateISO: string,
  stops: number,
  airline: { code: string; name: string },
): { durationMinutes: number; segments: FlightSegment[] } {
  const depHour = 6 + Math.floor(rnd() * 14);
  const legMinutes = 90 + Math.floor(rnd() * 240);
  const segments: FlightSegment[] = [];
  let dep = isoAt(dateISO, depHour, rnd() > 0.5 ? 15 : 40);
  if (stops === 0) {
    segments.push({
      departureAirport: from, arrivalAirport: to,
      departureTime: dep, arrivalTime: addMinutesISO(dep, legMinutes),
      airlineCode: airline.code, airlineName: airline.name,
      flightNumber: `${airline.code}${100 + Math.floor(rnd() * 800)}`,
      durationMinutes: legMinutes,
    });
    return { durationMinutes: legMinutes, segments };
  }
  const hub = 'HUB';
  const leg1 = Math.floor(legMinutes * 0.6);
  const layover = 60 + Math.floor(rnd() * 150);
  const leg2 = Math.floor(legMinutes * 0.7);
  const arr1 = addMinutesISO(dep, leg1);
  const dep2 = addMinutesISO(arr1, layover);
  segments.push({
    departureAirport: from, arrivalAirport: hub,
    departureTime: dep, arrivalTime: arr1,
    airlineCode: airline.code, airlineName: airline.name,
    flightNumber: `${airline.code}${100 + Math.floor(rnd() * 800)}`,
    durationMinutes: leg1,
  });
  segments.push({
    departureAirport: hub, arrivalAirport: to,
    departureTime: dep2, arrivalTime: addMinutesISO(dep2, leg2),
    airlineCode: airline.code, airlineName: airline.name,
    flightNumber: `${airline.code}${100 + Math.floor(rnd() * 800)}`,
    durationMinutes: leg2,
  });
  return { durationMinutes: leg1 + layover + leg2, segments };
}
