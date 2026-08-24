import React, { useCallback, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { money, TripCard } from '@/components/travel';
import { Card, EmptyState, PrimaryButton, Row, SectionTitle, Segmented } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@clerk/expo';
import { fetchMyBookings } from '@/services/bookings';
import { useApp } from '@/store/AppContext';
import type { SavedOffer, Trip } from '@/types/travel';
import type { Booking, BookingStatus } from '@workspace/api-client-react';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useI18n } from '@/services/i18n';

const STATUS_LABEL: Record<BookingStatus, string> = {
  paid: 'Booking in progress',
  booked: 'Booked',
  booking_failed: 'Needs attention',
  cancelled: 'Cancelled',
};

export default function TripsScreen() {
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { trips, deleteTrip, duplicateTrip, savedOffers, language } = useApp();
  const { t } = useI18n(language);
  const { isSignedIn } = useAuth();
  const [segment, setSegment] = useState<string>('Planned');
  const [bookings, setBookings] = useState<Booking[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      fetchMyBookings(Boolean(isSignedIn))
        .then(setBookings)
        .catch(() => setBookings((prev) => prev ?? []));
    }, [isSignedIn]),
  );

  const now = new Date();
  // returnDate is a stay-end date for hotel/itinerary purposes, not proof of
  // a return flight — for a one-way trip it's not a meaningful "trip is
  // over" signal, so use departureDate instead.
  const tripEnd = (t: Trip) => new Date(t.oneWay ? t.departureDate : t.returnDate);
  const upcoming = trips.filter((t) => t.status !== 'draft' && tripEnd(t) >= now);
  const drafts = trips.filter((t) => t.status === 'draft');
  const past = trips.filter((t) => t.status !== 'draft' && tripEnd(t) < now);

  const confirmDelete = (trip: Trip) => {
    Alert.alert('Delete trip?', `"${trip.title}" will be permanently removed.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteTrip(trip.id) },
    ]);
  };

  const renderGroup = (title: string, list: Trip[]) =>
    list.length ? (
      <View style={{ gap: 12 }} key={title}>
        <SectionTitle title={title} />
        {list.map((t) => (
          <View key={t.id} style={{ gap: 6 }}>
            <TripCard trip={t} onPress={() => router.push({ pathname: '/trip/[tripId]', params: { tripId: t.id } })} />
            <Row style={{ justifyContent: 'flex-end', gap: 18, paddingRight: 6 }}>
              <Pressable onPress={() => duplicateTrip(t.id)} accessibilityRole="button" accessibilityLabel="Duplicate trip" hitSlop={8}>
                <Feather name="copy" size={16} color={c.mutedForeground} />
              </Pressable>
              <Pressable onPress={() => confirmDelete(t)} accessibilityRole="button" accessibilityLabel="Delete trip" hitSlop={8}>
                <Feather name="trash-2" size={16} color={c.destructive} />
              </Pressable>
            </Row>
          </View>
        ))}
      </View>
    ) : null;

  const nothingAtAll = trips.length === 0 && savedOffers.length === 0 && (bookings === null || bookings.length === 0);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{
        paddingTop: Platform.OS === 'web' ? 87 : insets.top + 16,
        paddingBottom: Platform.OS === 'web' ? 118 : 110,
        paddingHorizontal: 20,
        gap: 20,
      }}
      showsVerticalScrollIndicator={false}
    >
       <Text style={{ fontFamily: 'Georgia', fontSize: 32, color: c.foreground, letterSpacing: -0.5 }}>{t('Trips')}</Text>

      {nothingAtAll ? (
        <View style={{ gap: 16 }}>
          <EmptyState
            icon="briefcase"
            title={t('No trips yet')}
            message="Plan your first trip with Safferni and it will appear here in your account."
          />
          <PrimaryButton title={t('Start planning')} icon="send" onPress={() => router.push('/')} />
        </View>
      ) : (
        <>
            <Segmented
              options={['Saved', 'Planned', 'Active'].map(t)}
              value={t(segment)}
              onChange={(value) => setSegment(['Saved', 'Planned', 'Active'].find((key) => t(key) === value) ?? value)}
            />

          {segment === 'Saved' ? (
            savedOffers.length === 0 ? (
              <EmptyState
                icon="heart"
                title="Nothing saved yet"
                message="Tap the heart on a flight, hotel or package to bookmark it here."
              />
            ) : (
              <View style={{ gap: 12 }}>
                {savedOffers.map((o) => (
                  <SavedOfferCard key={o.id} offer={o} />
                ))}
              </View>
            )
          ) : segment === 'Planned' ? (
            upcoming.length === 0 && drafts.length === 0 && past.length === 0 ? (
              <EmptyState
                icon="briefcase"
                title="No planned trips"
                message="Choose a package from your search results and it will show up here, ready to book."
              />
            ) : (
              <>
                {renderGroup('Upcoming', upcoming)}
                {renderGroup('Drafts', drafts)}
                {renderGroup('Past', past)}
              </>
            )
          ) : bookings === null ? null : bookings.length === 0 ? (
            <EmptyState
              icon="check-circle"
              title="No active bookings"
              message="Once you complete a booking, it will show up here with its confirmation status."
            />
          ) : (
            <View style={{ gap: 12 }}>
              {bookings.map((b) => (
                <BookingCard key={b.id} booking={b} onPress={() => router.push({ pathname: '/booking/[bookingId]', params: { bookingId: b.id } })} />
              ))}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

function BookingCard({ booking: b, onPress }: { booking: Booking; onPress: () => void }) {
  const c = useColors();
  const statusColor =
    b.status === 'booked' ? c.success : b.status === 'booking_failed' ? c.destructive : b.status === 'cancelled' ? c.mutedForeground : c.warning;
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
           <Text style={{ fontFamily: 'Georgia', fontSize: 19, color: c.foreground }}>{b.destinationName ?? 'Trip'}</Text>
          <Text style={{ color: statusColor, fontSize: 12, fontFamily: 'Inter_700Bold' }}>{STATUS_LABEL[b.status]}</Text>
        </Row>
        {b.departureDate ? (
          <Text style={{ color: c.mutedForeground, fontSize: 13, fontFamily: 'Inter_400Regular' }}>
            {b.returnDate ? `${b.departureDate} → ${b.returnDate}` : `${b.departureDate} (one-way)`}
          </Text>
        ) : null}
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={{ color: c.mutedForeground, fontSize: 12, fontFamily: 'Inter_400Regular' }}>
            {new Date(b.createdAt).toLocaleDateString()}
          </Text>
          <Text style={{ color: c.primary, fontFamily: 'Inter_700Bold' }}>{money(b.amountCents / 100, b.currency)}</Text>
        </Row>
      </Card>
    </Pressable>
  );
}

function SavedOfferCard({ offer }: { offer: SavedOffer }) {
  const c = useColors();
  const router = useRouter();
  const { unsaveOffer } = useApp();

  const icon = offer.kind === 'flight' ? 'send' : offer.kind === 'hotel' ? 'home' : 'package';
  const title =
    offer.kind === 'flight' && offer.flight
      ? `${offer.flight.outbound.segments[0].departureAirport} → ${offer.flight.outbound.segments[offer.flight.outbound.segments.length - 1].arrivalAirport}`
      : offer.kind === 'hotel' && offer.hotel
        ? offer.hotel.name
        : offer.destinationName
          ? `${offer.destinationName} package`
          : 'Saved package';
  const subtitle =
    offer.kind === 'flight' && offer.flight
      ? offer.flight.validatingAirline
      : offer.kind === 'hotel' && offer.hotel
        ? `${offer.hotel.starRating}★ · ${offer.hotel.address}`
        : offer.kind === 'package' && offer.package
          ? `${offer.package.flight.validatingAirline} + ${offer.package.hotel.name}`
          : undefined;
  const price = offer.flight?.totalPrice ?? offer.hotel?.totalPrice ?? offer.package?.totalPrice;

  const hasDetailScreen = (offer.kind === 'flight' && offer.flight) || (offer.kind === 'hotel' && offer.hotel);
  const openDetails = () => {
    if (offer.kind === 'flight' && offer.flight) {
      router.push({ pathname: '/flight/[offerId]', params: { offerId: offer.flight.id } });
    } else if (offer.kind === 'hotel' && offer.hotel) {
      router.push({ pathname: '/hotel/[offerId]', params: { offerId: offer.hotel.id } });
    }
  };

  const refreshPricing = () => {
    const mode = offer.kind === 'flight' ? 'flights' : offer.kind === 'hotel' ? 'hotels' : 'packages';
    const q = offer.destinationName ? `Plan a trip to ${offer.destinationName}` : undefined;
    router.push({ pathname: '/plan', params: q ? { mode, q } : { mode } });
  };

  return (
    <Card style={{ gap: 10 }}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Row style={{ gap: 10, flex: 1 }}>
          <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: c.accent }}>
            <Feather name={icon} size={15} color={c.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 15, color: c.foreground }} numberOfLines={1}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={{ color: c.mutedForeground, fontSize: 12 }} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        </Row>
        <Pressable onPress={() => unsaveOffer(offer.id)} accessibilityRole="button" accessibilityLabel="Remove from saved" hitSlop={8}>
          <Feather name="heart" size={18} color={c.secondary} />
        </Pressable>
      </Row>

      <Row style={{ justifyContent: 'space-between' }}>
        <Text style={{ color: c.mutedForeground, fontSize: 11 }}>
          Saved {new Date(offer.savedAt).toLocaleDateString()} · frozen price snapshot
        </Text>
        {price !== undefined ? (
          <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 15, color: c.foreground }}>{money(price, offer.currency)}</Text>
        ) : null}
      </Row>

      <Row style={{ gap: 10 }}>
        {hasDetailScreen ? (
          <Pressable onPress={openDetails} accessibilityRole="button" style={[savedStyles.actionBtn, { borderColor: c.primary }]}>
            <Text style={{ color: c.primary, fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>View details</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={refreshPricing} accessibilityRole="button" style={[savedStyles.actionBtn, { borderColor: c.border }]}>
          <Text style={{ color: c.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>Refresh pricing</Text>
        </Pressable>
      </Row>
    </Card>
  );
}

const savedStyles = {
  actionBtn: {
    flex: 1,
    alignItems: 'center' as const,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
  },
};
