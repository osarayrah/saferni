import React, { useState } from 'react';
import { Linking, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { DEST_IMAGES, money } from '@/components/travel';
import { Card, Chip, EmptyState, FadeIn, PrimaryButton, Row, SectionTitle, SourceBadge } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/store/AppContext';
import type { FlightOffer, HotelOffer, Trip, TripDraft } from '@/types/travel';
import { uid } from '@/services/mockData';
import type { HotelImage, HotelReview, HotelRoomOption, HotelRoomType, HotelSentiment } from '@workspace/api-client-react';
import { getGetHotelDetailQueryKey, useGetHotelDetail } from '@workspace/api-client-react';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';

function useFindHotel(offerId?: string): HotelOffer | undefined {
  const { search, trips, savedOffers } = useApp();
  if (!offerId) return undefined;
  return (
    search?.hotels.find((h) => h.id === offerId) ??
    trips.map((t) => t.hotel).find((h) => h.id === offerId) ??
    savedOffers.map((o) => o.hotel).find((h) => h?.id === offerId)
  );
}

export default function HotelDetailScreen() {
  const c = useColors();
  const router = useRouter();
  const { offerId } = useLocalSearchParams<{ offerId: string }>();
  const hotel = useFindHotel(offerId);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [showAllFacilities, setShowAllFacilities] = useState(false);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const { saveOffer, unsaveOffer, isOfferSaved, trips, saveTrip, search } = useApp();
  const {
    data: detail,
    isLoading: detailLoading,
    isError: detailIsError,
    error: detailError,
  } = useGetHotelDetail(hotel?.bookingRef ?? '', {
    query: { enabled: !!hotel?.bookingRef, queryKey: getGetHotelDetailQueryKey(hotel?.bookingRef ?? '') },
  });

  if (!hotel) {
    return (
      <View style={{ flex: 1, backgroundColor: c.background, justifyContent: 'center' }}>
        <EmptyState icon="home" title="Hotel not found" message="This offer is no longer available in the current session." />
      </View>
    );
  }

  const saved = isOfferSaved(hotel.id);
  const toggleSave = () =>
    saved ? unsaveOffer(hotel.id) : saveOffer({ id: hotel.id, kind: 'hotel', currency: hotel.currency, hotel });

  // The real booking flow (booking/new.tsx) books a whole Trip (flight +
  // hotel together) — there's no standalone "book just this hotel" path.
  // Only show the CTA when this hotel is actually part of a saved trip.
  const linkedTrip = trips.find((t) => t.hotel.id === hotel.id);
  const latitude = detail?.latitude ?? hotel.latitude;
  const longitude = detail?.longitude ?? hotel.longitude;
  const mapUrl = Number.isFinite(latitude) && Number.isFinite(longitude)
    ? `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`
    : null;
  const facilities = detail?.facilities?.length ? detail.facilities : hotel.amenities;
  const cancellation = detail?.cancellation;
  const checkinTime = detail?.checkinTime ?? hotel.checkInTime;
  const checkoutTime = detail?.checkoutTime ?? hotel.checkOutTime;
  const selectedRoom = detail?.rooms.find((room) => room.id === selectedRoomId) ?? detail?.rooms[0];
  const proceedToBooking = () => {
    if (linkedTrip) {
      router.push({ pathname: '/booking/new', params: { tripId: linkedTrip.id } });
      return;
    }
    const draft = search?.draft;
    if (!draft?.departureDate || !hotel.bookingRef) return;
  const hotelOnlyTrip = makeHotelOnlyTrip(draft, hotel);
    saveTrip(hotelOnlyTrip);
    router.push({ pathname: '/booking/new', params: { tripId: hotelOnlyTrip.id } });
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.background }} contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 60 }}>
      {detailLoading ? (
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 16, height: 16, borderRadius: 5, backgroundColor: c.primary }} />
          <Text style={{ color: c.mutedForeground, fontSize: 13, fontFamily: 'Inter_500Medium' }}>
            Loading hotel details…
          </Text>
        </Card>
      ) : null}

      {detail?.images.length ? (
        <HotelImageGallery images={detail.images} />
      ) : (
        <>
          <Image
            source={DEST_IMAGES.beach}
            style={{ width: '100%', height: 220, borderRadius: 18 }}
            contentFit="cover"
            accessibilityLabel="Sample hotel image"
          />
          <Text style={{ color: c.mutedForeground, fontSize: 11, marginTop: -8 }}>Sample image — demo listing</Text>
        </>
      )}

      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
         <Text style={{ fontFamily: 'Georgia', fontSize: 25, color: c.foreground, flex: 1, letterSpacing: -0.3 }}>{hotel.name}</Text>
        <Row style={{ gap: 12 }}>
          <SourceBadge sourceType={hotel.sourceType} />
          <Pressable
            onPress={toggleSave}
            accessibilityRole="button"
            accessibilityLabel={saved ? 'Remove from saved' : 'Save hotel'}
            hitSlop={8}
          >
            <Feather name="heart" size={20} color={saved ? c.secondary : c.mutedForeground} />
          </Pressable>
        </Row>
      </Row>

      <Row style={{ gap: 4 }}>
        <Text style={{ color: c.mutedForeground, fontSize: 13 }}>
          {detail?.address ?? hotel.address}
        </Text>
      </Row>

      {detail?.description ? (
        <Card style={{ gap: 6 }}>
          <SectionTitle title="About this hotel" />
          <ExpandableText text={detail.description} />
        </Card>
      ) : null}

      <Card style={{ gap: 12 }}>
        <Row style={{ justifyContent: 'space-between', gap: 14 }}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ color: c.mutedForeground, fontSize: 12 }}>Hotel rating</Text>
            <Row style={{ gap: 3 }}>
              {Array.from({ length: Math.round(detail?.starRating ?? hotel.starRating) }).map((_, i) => (
                <Feather key={i} name="star" size={14} color={c.warning} fill={c.warning} />
              ))}
            </Row>
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ color: c.mutedForeground, fontSize: 12 }}>Guest rating</Text>
            <Text style={{ color: c.foreground, fontSize: 15, fontFamily: 'Inter_700Bold' }}>
              {(detail?.rating ?? hotel.guestRating).toFixed(1)}
              <Text style={{ color: c.mutedForeground, fontSize: 12, fontFamily: 'Inter_400Regular' }}>
                {' '}· {(detail?.reviewCount ?? hotel.reviewCount).toLocaleString()} reviews
              </Text>
            </Text>
          </View>
        </Row>
      </Card>

      {detail?.sentiment ? (
        <FadeIn>
          <SentimentSummary sentiment={detail.sentiment} />
        </FadeIn>
      ) : null}

      <Card style={{ gap: 8 }}>
        <DetailRow label="Address" value={detail?.address ?? hotel.address} />
        {(detail?.city || detail?.country) ? (
          <DetailRow label="Location" value={[detail.city, detail.country].filter(Boolean).join(', ')} />
        ) : null}
        <DetailRow label="Room" value={hotel.roomName ?? '—'} />
        <DetailRow label="Meal plan" value={hotel.mealPlan ?? '—'} />
        <DetailRow label="Check-in / out" value={`${checkinTime} / ${checkoutTime}`} />
        {hotel.distanceFromCenterKm !== undefined ? (
          <DetailRow label="Distance from centre" value={`${hotel.distanceFromCenterKm} km`} />
        ) : null}
        {mapUrl ? (
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="View hotel on map"
            onPress={() => Linking.openURL(mapUrl)}
            hitSlop={8}
          >
            <Row style={{ gap: 6 }}>
              <Feather name="map-pin" size={14} color={c.primary} />
              <Text style={{ color: c.primary, fontSize: 13, fontFamily: 'Inter_600SemiBold' }}>View map</Text>
            </Row>
          </Pressable>
        ) : null}
      </Card>

      {facilities.length ? (
        <View style={{ gap: 8 }}>
          <SectionTitle title="Facilities" />
          <Row style={{ flexWrap: 'wrap', gap: 8 }}>
            {(showAllFacilities ? facilities : facilities.slice(0, 8)).map((facility) => (
              <Chip key={facility} small label={facility} />
            ))}
          </Row>
          {facilities.length > 8 ? (
            <ShowMoreButton expanded={showAllFacilities} onPress={() => setShowAllFacilities((value) => !value)} />
          ) : null}
        </View>
      ) : null}

      <Card style={{ gap: 6 }}>
        <SectionTitle title="Cancellation policy" />
        {cancellation ? (
          <>
            <Text style={{ color: cancellation.refundable ? c.success : c.destructive, fontSize: 14, fontFamily: 'Inter_600SemiBold' }}>
              {cancellation.refundable
                ? cancellation.deadline ? `Free cancellation until ${formatPolicyDate(cancellation.deadline)}` : 'Refundable'
                : 'Non-refundable'}
            </Text>
            {cancellation.deadline && cancellation.amount !== undefined ? (
              <Text style={{ color: c.mutedForeground, fontSize: 13, lineHeight: 19 }}>
                After {formatPolicyDate(cancellation.deadline)}, {money(cancellation.amount, cancellation.currency ?? hotel.currency)} will be charged.
              </Text>
            ) : null}
          </>
        ) : (
          <ExpandableText text={hotel.cancellationSummary ?? 'Cancellation terms are unavailable for this offer.'} compact />
        )}
      </Card>

      {detail?.importantInformation ? (
        <Card style={{ gap: 6 }}>
          <SectionTitle title="Important information" />
          <ExpandableText text={detail.importantInformation} compact />
        </Card>
      ) : null}

      {hotel.roomOptions?.length ? (
        <FadeIn>
          <View style={{ gap: 10 }}>
            <SectionTitle title="Choose your room and rate" />
            <Text style={{ color: c.mutedForeground, fontSize: 12 }}>
              Compare the live room options and meal plans available for these dates.
            </Text>
            <RoomOptionsRow
              options={hotel.roomOptions}
              selectedRoomId={selectedRoomId ?? hotel.roomOptions[0].id}
              onSelect={setSelectedRoomId}
              onOpen={(roomId) => router.push({ pathname: '/room/[roomId]', params: { roomId, hotelId: hotel.id } })}
              currency={hotel.currency}
            />
          </View>
        </FadeIn>
      ) : detail?.rooms.length ? (
        <FadeIn>
          <View style={{ gap: 10 }}>
            <SectionTitle title="Choose your room" />
            <Text style={{ color: c.mutedForeground, fontSize: 12 }}>
              Select a room option to compare what each room includes.
            </Text>
            <RoomTypesRow rooms={detail.rooms} selectedRoomId={selectedRoom?.id} onSelect={setSelectedRoomId} />
          </View>
        </FadeIn>
      ) : null}

      {detail?.reviews.length ? (
        <FadeIn>
          <View style={{ gap: 10 }}>
            <SectionTitle title="Guest reviews" />
            <View style={{ gap: 10 }}>
              {(showAllReviews ? detail.reviews : detail.reviews.slice(0, 2)).map((r, i) => (
                <ReviewCard key={`${r.name}_${i}`} review={r} />
              ))}
            </View>
              {detail.reviews.length > 2 ? (
                <ShowMoreButton expanded={showAllReviews} onPress={() => setShowAllReviews((value) => !value)} />
              ) : null}
          </View>
        </FadeIn>
      ) : null}

      <Card style={{ gap: 4 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={{ color: c.mutedForeground, fontSize: 14 }}>Total stay</Text>
          <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 22, color: c.foreground }}>
            {money(hotel.totalPrice, hotel.currency)}
          </Text>
        </Row>
        <Text style={{ color: c.mutedForeground, fontSize: 12 }}>
          {money(hotel.nightlyPrice, hotel.currency)}/night · taxes & fees ~{money(hotel.taxesAndFees ?? 0, hotel.currency)}
        </Text>
      </Card>

      {linkedTrip || (search?.draft && hotel.bookingRef) ? (
        <>
          <PrimaryButton
            title={linkedTrip ? 'Book this trip' : 'Proceed to booking'}
            icon="credit-card"
            onPress={proceedToBooking}
          />
          <Text style={{ color: c.mutedForeground, fontSize: 12, textAlign: 'center' }}>
            {linkedTrip
              ? 'Booking includes this hotel as part of your saved trip.'
              : 'Continue to add traveler details and book this hotel.'}
          </Text>
        </>
      ) : null}
    </ScrollView>
  );
}

function makeHotelOnlyTrip(draft: TripDraft, hotel: HotelOffer): Trip {
  const now = new Date().toISOString();
  const departureDate = draft.departureDate ?? now.slice(0, 10);
  const destinationCode = draft.destinationCode ?? 'HOTEL';
  const destinationName = draft.destinationName ?? hotel.name;
  const flight: FlightOffer = {
    id: uid('hotel_only_flight'),
    provider: 'Safferni',
    sourceType: 'mock',
    totalPrice: 0,
    currency: hotel.currency,
    pricePerTraveller: 0,
    validatingAirline: 'Not selected',
    cabinClass: 'economy',
    outbound: { durationMinutes: 0, segments: [] },
    totalDurationMinutes: 0,
    totalStops: 0,
    baggage: { unknown: true },
    lastUpdatedAt: now,
  };
  return {
    id: uid('trip'),
    title: `${destinationName} · ${draft.nights ?? 1} nights`,
    origin: draft.origin,
    destinationCode,
    destinationName,
    country: draft.destinationCountry ?? detailCountry(hotel),
    departureDate,
    returnDate: draft.returnDate ?? departureDate,
    oneWay: true,
    adults: draft.adults,
    children: draft.children,
    status: 'planned',
    currency: hotel.currency,
    budget: draft.budget ?? 0,
    estimatedTotal: hotel.totalPrice,
    coverImage: hotel.images[0] ?? 'beach',
    flight,
    hotel,
    days: [],
    sourceType: hotel.sourceType,
    createdAt: now,
    updatedAt: now,
  };
}

function detailCountry(hotel: HotelOffer): string {
  return hotel.address.split(',').pop()?.trim() ?? '';
}

function HotelImageGallery({ images }: { images: HotelImage[] }) {
  const c = useColors();
  const { width } = useWindowDimensions();
  const imageWidth = width - 40; // matches the screen's 20px horizontal padding
  const [index, setIndex] = useState(0);
  return (
    <View>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / imageWidth))}
        scrollEventThrottle={32}
      >
        {images.map((image) => (
          <View key={`${image.url}_${image.order}`} style={{ width: imageWidth, gap: 6 }}>
            <Image source={{ uri: image.url }} style={{ width: imageWidth, height: 200, borderRadius: 16 }} contentFit="cover" />
            {image.caption ? (
              <Text style={{ color: c.mutedForeground, fontSize: 12 }} numberOfLines={1}>{image.caption}</Text>
            ) : null}
          </View>
        ))}
      </ScrollView>
      {images.length > 1 ? (
        <Row style={{ justifyContent: 'center', gap: 6, marginTop: 8 }}>
          {images.map((image, i) => (
            <View
              key={`${image.url}_${image.order}`}
              style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: i === index ? c.primary : c.border }}
            />
          ))}
        </Row>
      ) : null}
    </View>
  );
}

function formatPolicyDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function cleanHotelText(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(?:p|div|li|ul|ol|strong|b|em|i|span|h[1-6])[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function ExpandableText({ text, compact = false }: { text: string; compact?: boolean }) {
  const c = useColors();
  const cleaned = cleanHotelText(text);
  const [expanded, setExpanded] = useState(false);
  const isLong = cleaned.length > (compact ? 260 : 340);
  return (
    <View style={{ gap: 7 }}>
      <Text
        numberOfLines={!expanded && isLong ? (compact ? 5 : 7) : undefined}
        style={{ color: c.mutedForeground, fontSize: compact ? 13 : 14, lineHeight: compact ? 20 : 21 }}
      >
        {cleaned}
      </Text>
      {isLong ? (
        <Pressable onPress={() => setExpanded((value) => !value)} accessibilityRole="button">
          <Text style={{ color: c.primary, fontSize: 13, fontFamily: 'Inter_600SemiBold' }}>
            {expanded ? 'Show less' : 'Show more'}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function ShowMoreButton({ expanded, onPress }: { expanded: boolean; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={{ alignSelf: 'flex-start', paddingVertical: 4 }}>
      <Row style={{ gap: 5 }}>
        <Text style={{ color: c.primary, fontSize: 13, fontFamily: 'Inter_600SemiBold' }}>
          {expanded ? 'Show less' : 'Show more'}
        </Text>
        <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={c.primary} />
      </Row>
    </Pressable>
  );
}

function SentimentSummary({ sentiment }: { sentiment: HotelSentiment }) {
  const c = useColors();
  const categories = sentiment.categories.slice(0, 5);
  return (
    <Card style={{ gap: 10 }}>
      <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 14, color: c.foreground }}>What guests say</Text>
      {categories.map((cat) => (
        <Row key={cat.name} style={{ gap: 8 }}>
          <Text style={{ color: c.mutedForeground, fontSize: 12.5, width: 90 }}>{cat.name}</Text>
          <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: c.muted, overflow: 'hidden' }}>
            <View
              style={{
                width: `${Math.max(0, Math.min(100, cat.rating * 10))}%`,
                height: '100%',
                backgroundColor: c.primary,
              }}
            />
          </View>
          <Text style={{ color: c.foreground, fontSize: 12, fontFamily: 'Inter_600SemiBold', width: 26, textAlign: 'right' }}>
            {cat.rating.toFixed(1)}
          </Text>
        </Row>
      ))}
      {sentiment.pros.length ? (
        <Text style={{ color: c.mutedForeground, fontSize: 12 }}>Guests liked: {sentiment.pros.slice(0, 4).join(', ')}</Text>
      ) : null}
    </Card>
  );
}

function RoomTypesRow({
  rooms,
  selectedRoomId,
  onSelect,
}: {
  rooms: HotelRoomType[];
  selectedRoomId?: string;
  onSelect: (roomId: string) => void;
}) {
  const c = useColors();
  return (
    <View style={{ gap: 10 }}>
      {rooms.map((r) => (
        <Pressable
          key={r.id}
          onPress={() => onSelect(r.id)}
          accessibilityRole="radio"
          accessibilityState={{ selected: r.id === selectedRoomId }}
          accessibilityLabel={`Choose ${r.name}`}
          style={{
            borderWidth: 1,
            borderColor: r.id === selectedRoomId ? c.primary : c.border,
            backgroundColor: r.id === selectedRoomId ? c.primary + '12' : c.card,
            borderRadius: 14,
            padding: 10,
            gap: 8,
          }}
        >
          <Row style={{ gap: 10, alignItems: 'flex-start' }}>
          {r.photos[0] ? (
            <Image source={{ uri: r.photos[0] }} style={{ width: 92, height: 76, borderRadius: 10 }} contentFit="cover" />
          ) : (
            <View style={{ width: 92, height: 76, borderRadius: 10, backgroundColor: c.muted }} />
          )}
            <View style={{ flex: 1, gap: 5 }}>
              <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                <Text numberOfLines={2} style={{ flex: 1, fontSize: 14, fontFamily: 'Inter_600SemiBold', color: c.foreground }}>
                  {r.name}
                </Text>
                <Feather
                  name={r.id === selectedRoomId ? 'check-circle' : 'circle'}
                  size={20}
                  color={r.id === selectedRoomId ? c.primary : c.mutedForeground}
                />
              </Row>
              {r.maxOccupancy ? (
                <Text style={{ color: c.mutedForeground, fontSize: 12 }}>
                  Up to {r.maxOccupancy} guests
                </Text>
              ) : null}
            </View>
          </Row>
          {r.description ? (
            <Text numberOfLines={3} style={{ color: c.mutedForeground, fontSize: 12, lineHeight: 18 }}>
              {r.description}
            </Text>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

function RoomOptionsRow({
  options,
  selectedRoomId,
  onSelect,
  onOpen,
  currency,
}: {
  options: HotelRoomOption[];
  selectedRoomId: string;
  onSelect: (roomId: string) => void;
  onOpen: (roomId: string) => void;
  currency: string;
}) {
  const c = useColors();
  return (
    <View style={{ gap: 10 }}>
      {options.map((option) => {
        const selected = option.id === selectedRoomId;
        return (
          <Pressable
            key={option.id}
            onPress={() => {
              onSelect(option.id);
              onOpen(option.id);
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={`Choose ${option.name}`}
            style={{
              borderWidth: 1,
              borderColor: selected ? c.primary : c.border,
              backgroundColor: selected ? c.primary + '12' : c.card,
              borderRadius: 14,
              padding: 14,
              gap: 9,
            }}
          >
            <Row style={{ alignItems: 'flex-start', gap: 10 }}>
              {option.images?.[0] ? (
                <Image
                  source={{ uri: option.images[0] }}
                  style={{ width: 92, height: 76, borderRadius: 10 }}
                  contentFit="cover"
                  accessibilityLabel={`${option.name} room image`}
                />
              ) : (
                <View style={{ width: 92, height: 76, borderRadius: 10, backgroundColor: c.muted }} />
              )}
              <View style={{ flex: 1, gap: 5 }}>
                <Text style={{ color: c.foreground, fontSize: 14, fontFamily: 'Inter_600SemiBold' }}>
                  {option.name}
                </Text>
                <Row style={{ flexWrap: 'wrap', gap: 6 }}>
                  {option.mealPlan ? <Chip small label={option.mealPlan} /> : null}
                  {option.refundable !== undefined ? (
                    <Chip small label={option.refundable ? 'Refundable' : 'Non-refundable'} />
                  ) : null}
                </Row>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 5 }}>
                <Feather name={selected ? 'check-circle' : 'circle'} size={20} color={selected ? c.primary : c.mutedForeground} />
                <Text style={{ color: c.foreground, fontSize: 15, fontFamily: 'Inter_700Bold' }}>
                  {money(option.totalPrice, option.currency || currency)}
                </Text>
              </View>
            </Row>
          </Pressable>
        );
      })}
    </View>
  );
}

function ReviewCard({ review }: { review: HotelReview }) {
  const c = useColors();
  return (
    <Card style={{ gap: 6 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 13, color: c.foreground }}>
          {review.name} · {review.country.toUpperCase()}
        </Text>
        <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 13, color: c.primary }}>{review.averageScore.toFixed(1)}</Text>
      </Row>
      {review.headline ? (
        <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 13, color: c.foreground }}>{review.headline}</Text>
      ) : null}
      {review.pros ? (
        <Row style={{ gap: 6 }}>
          <Feather name="plus-circle" size={12} color={c.success} />
          <Text style={{ fontSize: 12, color: c.mutedForeground, flex: 1 }}>{review.pros}</Text>
        </Row>
      ) : null}
      {review.cons ? (
        <Row style={{ gap: 6 }}>
          <Feather name="minus-circle" size={12} color={c.warning} />
          <Text style={{ fontSize: 12, color: c.mutedForeground, flex: 1 }}>{review.cons}</Text>
        </Row>
      ) : null}
    </Card>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  const c = useColors();
  return (
    <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <Text style={{ color: c.mutedForeground, fontSize: 13 }}>{label}</Text>
      <Text style={{ color: c.foreground, fontSize: 13, fontFamily: 'Inter_500Medium', flex: 1, textAlign: 'right' }}>
        {value}
      </Text>
    </Row>
  );
}
