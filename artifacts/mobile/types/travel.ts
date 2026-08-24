export type SourceType = 'live' | 'cached' | 'estimated' | 'mock';

export type FlightSegment = {
  departureAirport: string;
  arrivalAirport: string;
  departureTime: string; // ISO
  arrivalTime: string; // ISO
  airlineCode: string;
  airlineName: string;
  flightNumber: string;
  durationMinutes: number;
};

export type FlightItinerary = {
  durationMinutes: number;
  segments: FlightSegment[];
};

export type FlightOffer = {
  id: string;
  provider: string;
  sourceType: SourceType;
  bookingUrl?: string;
  bookingRef?: string;
  totalPrice: number;
  currency: string;
  pricePerTraveller: number;
  validatingAirline: string;
  cabinClass: 'economy' | 'premium_economy' | 'business' | 'first';
  outbound: FlightItinerary;
  inbound?: FlightItinerary;
  totalDurationMinutes: number;
  totalStops: number;
  baggage: { cabin?: string; checked?: string; unknown: boolean };
  refundable?: boolean;
  changeable?: boolean;
  fareRulesSummary?: string;
  lastUpdatedAt: string;
};

export type HotelOffer = {
  id: string;
  provider: string;
  sourceType: SourceType;
  bookingUrl?: string;
  bookingRef?: string;
  name: string;
  description?: string;
  starRating: number;
  guestRating: number;
  reviewCount: number;
  address: string;
  latitude: number;
  longitude: number;
  images: string[];
  amenities: string[];
  roomName?: string;
  mealPlan?: string;
  roomOptions?: {
    id: string;
    name: string;
    description?: string;
    mealPlan?: string;
    roomSizeSquare?: number;
    roomSizeUnit?: string;
    bedTypes?: string[];
    maxOccupancy?: number;
    amenities?: string[];
    images?: string[];
    totalPrice: number;
    currency: string;
    refundable?: boolean;
  }[];
  nightlyPrice: number;
  totalPrice: number;
  taxesAndFees?: number;
  currency: string;
  refundable?: boolean;
  cancellationSummary?: string;
  distanceFromCenterKm?: number;
  checkInTime?: string;
  checkOutTime?: string;
  lastUpdatedAt: string;
};

export type ActivityItem = {
  id: string;
  sourceType: SourceType;
  title: string;
  description: string;
  category: string;
  estimatedCost: number;
  currency: string;
  durationHours: number;
  latitude: number;
  longitude: number;
  locationName: string;
  reservationRequired?: boolean;
};

export type TravelWarning = { code: string; message: string };

export type TripPackage = {
  id: string;
  title: string;
  recommendationType: 'best_overall' | 'lowest_price' | 'most_comfortable' | 'custom';
  flight: FlightOffer;
  hotel: HotelOffer;
  estimatedActivitiesTotal: number;
  estimatedFoodTotal: number;
  estimatedLocalTransportTotal: number;
  totalPrice: number;
  currency: string;
  pricePerTraveller: number;
  budgetDifference: number;
  score: number;
  advantages: string[];
  disadvantages: string[];
  warnings: TravelWarning[];
};

export type ItineraryItem = {
  id: string;
  title: string;
  description: string;
  category: 'activity' | 'food' | 'transport' | 'rest' | 'flight' | 'hotel';
  timeOfDay: 'morning' | 'afternoon' | 'evening';
  locationName: string;
  latitude?: number;
  longitude?: number;
  estimatedCost: number;
  transportationMethod?: string;
  travelTimeMinutes?: number;
  reservationRequired?: boolean;
  notes?: string;
};

export type ItineraryDay = {
  id: string;
  dayNumber: number;
  date: string; // ISO date
  title: string;
  summary: string;
  estimatedCost: number;
  items: ItineraryItem[];
};

export type TripStatus = 'draft' | 'planned' | 'booked' | 'completed' | 'archived';

export type PackingItem = {
  id: string;
  label: string;
  category: string;
  checked: boolean;
};

export type Trip = {
  id: string;
  title: string;
  origin: string;
  destinationCode: string;
  destinationName: string;
  country: string;
  departureDate: string;
  returnDate: string;
  // returnDate above is always populated (itinerary/hotel-nights math needs
  // a stay-end date regardless of flight one-way-ness) — oneWay is what
  // actually says whether the booked flight has a return leg. Never infer
  // trip type from returnDate's presence; it's never absent on a Trip.
  oneWay: boolean;
  adults: number;
  children: number;
  status: TripStatus;
  currency: string;
  budget: number;
  estimatedTotal: number;
  coverImage: string;
  flight: FlightOffer;
  hotel: HotelOffer;
  days: ItineraryDay[];
  packing?: PackingItem[];
  sourceType: SourceType;
  createdAt: string;
  updatedAt: string;
};

export type SavedOfferKind = 'flight' | 'hotel' | 'package';

/**
 * A traveller's explicit heart-tap bookmark of one specific offer. Distinct
 * from Trip (a chosen-but-unbooked package, see TripStatus): a SavedOffer can
 * be a single flight or hotel with no package assembled, and is never created
 * by searching or viewing — only by tapping the heart icon. Stores the offer
 * verbatim as a frozen price snapshot (offers expire server-side); the id
 * matches the underlying flight/hotel/package offer id so it can be deduped
 * and looked up directly.
 */
export type SavedOffer = {
  id: string;
  kind: SavedOfferKind;
  savedAt: string;
  currency: string;
  destinationName?: string;
  destinationCode?: string;
  origin?: string;
  departureDate?: string;
  returnDate?: string;
  flight?: FlightOffer;
  hotel?: HotelOffer;
  package?: TripPackage;
};

export type TripDraft = {
  origin: string;
  destinationCode?: string;
  destinationName?: string;
  destinationCountry?: string;
  departureDate?: string;
  returnDate?: string;
  oneWay?: boolean;
  nights?: number;
  adults: number;
  children: number;
  budget?: number;
  currency: string;
  styles: string[];
  notes?: string;
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  kind?: 'text' | 'summary' | 'question';
  quickReplies?: string[];
  showSearchButton?: boolean;
  /** Source of the assistant message: "ai" = LLM, "demo" = deterministic fallback */
  sourceType?: 'ai' | 'demo';
};

export type Destination = {
  code: string;
  city: string;
  country: string;
  description: string;
  suggestedNights: number;
  budgetRange: string;
  bestMonths: string;
  tags: string[];
  image: 'beach' | 'city' | 'nature';
  latitude: number;
  longitude: number;
};

export type UserProfile = {
  firstName: string;
  homeCity: string;
  homeAirport: string;
  currency: string;
  typicalBudget?: number;
  travelStyles: string[];
  onboarded: boolean;
};
