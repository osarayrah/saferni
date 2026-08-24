import { DESTINATIONS, uid } from '@/services/mockData';
import type { PackingItem, Trip } from '@/types/travel';

type Suggestion = { label: string; category: string };

const ESSENTIALS: Suggestion[] = [
  { label: 'Passport / ID', category: 'Documents' },
  { label: 'Flight & hotel confirmations', category: 'Documents' },
  { label: 'Travel insurance details', category: 'Documents' },
  { label: 'Payment cards & some cash', category: 'Documents' },
  { label: 'Phone charger & power bank', category: 'Tech' },
  { label: 'Universal plug adapter', category: 'Tech' },
  { label: 'Medication & small first-aid kit', category: 'Health' },
  { label: 'Toiletries bag', category: 'Health' },
];

const BEACH: Suggestion[] = [
  { label: 'Swimwear', category: 'Clothing' },
  { label: 'Sunscreen (SPF 30+)', category: 'Health' },
  { label: 'Sunglasses & sun hat', category: 'Clothing' },
  { label: 'Flip flops / sandals', category: 'Clothing' },
  { label: 'Beach towel', category: 'Extras' },
];

const CITY: Suggestion[] = [
  { label: 'Comfortable walking shoes', category: 'Clothing' },
  { label: 'Day bag / small backpack', category: 'Extras' },
  { label: 'Smart-casual outfit for evenings', category: 'Clothing' },
];

const NATURE: Suggestion[] = [
  { label: 'Hiking shoes', category: 'Clothing' },
  { label: 'Light rain jacket', category: 'Clothing' },
  { label: 'Reusable water bottle', category: 'Extras' },
  { label: 'Insect repellent', category: 'Health' },
];

const FAMILY: Suggestion[] = [
  { label: 'Kids\u2019 snacks & entertainment', category: 'Family' },
  { label: 'Extra changes of clothes for kids', category: 'Family' },
];

export function generatePackingList(trip: Trip): PackingItem[] {
  const dest = DESTINATIONS.find((d) => d.code === trip.destinationCode);
  const tags = dest?.tags ?? [];
  const nights = Math.max(1, trip.days.length - 1);

  const suggestions: Suggestion[] = [...ESSENTIALS];
  suggestions.push({ label: `Outfits for ${nights} day${nights > 1 ? 's' : ''}`, category: 'Clothing' });
  if (tags.includes('Beach') || trip.coverImage === 'beach') suggestions.push(...BEACH);
  if (trip.coverImage === 'city' || tags.some((t) => ['Culture', 'History', 'Food', 'Nightlife'].includes(t))) suggestions.push(...CITY);
  if (trip.coverImage === 'nature' || tags.includes('Nature') || tags.includes('Adventure')) suggestions.push(...NATURE);
  if (trip.children > 0) suggestions.push(...FAMILY);

  const seen = new Set<string>();
  return suggestions
    .filter((s) => (seen.has(s.label) ? false : (seen.add(s.label), true)))
    .map((s) => ({ id: uid('pack'), label: s.label, category: s.category, checked: false }));
}

export const PACKING_CATEGORY_ORDER = ['Documents', 'Clothing', 'Tech', 'Health', 'Family', 'Extras'];
