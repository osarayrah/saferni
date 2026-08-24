import React, { useMemo, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Card, EmptyState, PrimaryButton, Row } from '@/components/ui';
import { money } from '@/components/travel';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/store/AppContext';
import { startBooking } from '@/services/bookings';
import type { CreateBookingRequest } from '@workspace/api-client-react';
import { Feather } from '@expo/vector-icons';

type TravelerInput = { firstName: string; lastName: string; type: 'adult' | 'child' };

export default function NewBookingScreen() {
  const c = useColors();
  const router = useRouter();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { trips, profile } = useApp();
  const trip = trips.find((t) => t.id === tripId);

  const [travelers, setTravelers] = useState<TravelerInput[]>(() => {
    if (!trip) return [{ firstName: '', lastName: '', type: 'adult' }];
    return [
      ...Array.from({ length: trip.adults }, (_, i) => ({
        firstName: i === 0 ? (profile.firstName ?? '') : '',
        lastName: '',
        type: 'adult' as const,
      })),
      ...Array.from({ length: trip.children }, () => ({ firstName: '', lastName: '', type: 'child' as const })),
    ];
  });
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bookableFlight = trip?.flight?.bookingRef ? trip.flight : null;
  const bookableHotel = trip?.hotel?.bookingRef ? trip.hotel : null;
  const total = (bookableFlight?.totalPrice ?? 0) + (bookableHotel?.totalPrice ?? 0);

  const valid = useMemo(
    () =>
      travelers.every((t) => t.firstName.trim().length > 0 && t.lastName.trim().length > 0) &&
      /.+@.+\..+/.test(email),
    [travelers, email],
  );

  if (!trip) {
    return <EmptyState icon="alert-circle" title="Trip not found" message="Go back and pick a trip to book." />;
  }
  if (!bookableFlight && !bookableHotel) {
    return (
      <EmptyState
        icon="alert-circle"
        title="Nothing bookable in this trip"
        message="This trip's offers can't be booked automatically. Run a new search to get bookable live prices."
      />
    );
  }

  const onBook = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const req: CreateBookingRequest = {
        draft: {
          origin: trip.origin,
          destinationCode: trip.destinationCode,
          destinationName: trip.destinationName,
          departureDate: trip.departureDate,
          // trip.returnDate is a stay-end date for hotel/itinerary purposes,
          // always populated even for a one-way flight — don't record it as
          // this booking's return date when there's no return flight.
          ...(trip.oneWay ? {} : { returnDate: trip.returnDate }),
          adults: trip.adults,
          children: trip.children,
          currency: trip.currency,
          styles: [],
        },
        ...(bookableFlight ? { flight: bookableFlight as CreateBookingRequest['flight'] } : {}),
        ...(bookableHotel ? { hotel: bookableHotel as CreateBookingRequest['hotel'] } : {}),
        travelers,
        contactEmail: email.trim(),
      };
      const { bookingId } = await startBooking(req);
      router.replace({ pathname: '/booking/[bookingId]', params: { bookingId } });
    } catch (err) {
      const data = (err as { data?: { error?: string } | null })?.data;
      setError(
        typeof data?.error === 'string'
          ? data.error
          : "We couldn't submit the booking. Please try again.",
      );
      setSubmitting(false);
    }
  };

  const setTraveler = (i: number, patch: Partial<TravelerInput>) =>
    setTravelers((ts) => ts.map((t, j) => (j === i ? { ...t, ...patch } : t)));

  const inputStyle = {
    borderWidth: 1,
    borderColor: c.input,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: c.foreground,
    backgroundColor: c.card,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    flex: 1,
  } as const;

  return (
    <>
      <Stack.Screen options={{ title: 'Book trip' }} />
      <ScrollView style={{ flex: 1, backgroundColor: c.background }} contentContainerStyle={{ padding: 16, gap: 16 }}>
        <Card>
            <Text style={{ fontFamily: 'Georgia', fontSize: 23, color: c.foreground }}>
            {trip.destinationName}, {trip.country}
          </Text>
          <Text style={{ color: c.mutedForeground, marginTop: 4, fontSize: 13, fontFamily: 'Inter_400Regular' }}>
            {trip.oneWay ? `${trip.departureDate} (one-way)` : `${trip.departureDate} → ${trip.returnDate}`}
          </Text>
          <View style={{ marginTop: 12, gap: 6 }}>
            {bookableFlight ? (
              <Row style={{ justifyContent: 'space-between' }}>
                  <Row style={{ gap: 7, flex: 1 }}>
                    <Feather name="send" size={14} color={c.primary} />
                    <Text style={{ color: c.foreground, fontFamily: 'Inter_400Regular' }}>{bookableFlight.validatingAirline}</Text>
                  </Row>
                <Text style={{ color: c.foreground, fontFamily: 'Inter_600SemiBold' }}>
                  {money(bookableFlight.totalPrice, trip.currency)}
                </Text>
              </Row>
            ) : null}
            {bookableHotel ? (
              <Row style={{ justifyContent: 'space-between' }}>
                  <Row style={{ gap: 7, flex: 1 }}>
                    <Feather name="home" size={14} color={c.primary} />
                    <Text style={{ color: c.foreground, fontFamily: 'Inter_400Regular' }} numberOfLines={1}>{bookableHotel.name}</Text>
                  </Row>
                <Text style={{ color: c.foreground, fontFamily: 'Inter_600SemiBold' }}>
                  {money(bookableHotel.totalPrice, trip.currency)}
                </Text>
              </Row>
            ) : null}
            <Row style={{ justifyContent: 'space-between', marginTop: 6, borderTopWidth: 1, borderTopColor: c.border, paddingTop: 8 }}>
              <Text style={{ color: c.foreground, fontFamily: 'Inter_700Bold' }}>Total</Text>
              <Text style={{ color: c.primary, fontFamily: 'Inter_700Bold', fontSize: 17 }}>
                {money(total, trip.currency)}
              </Text>
            </Row>
          </View>
        </Card>

         <Text style={{ fontFamily: 'Georgia', fontSize: 21, color: c.foreground }}>Travelers</Text>
        {travelers.map((t, i) => (
          <Card key={i}>
            <Text style={{ color: c.mutedForeground, fontSize: 12, fontFamily: 'Inter_600SemiBold', marginBottom: 8 }}>
              {t.type === 'adult' ? `Adult ${i + 1}` : `Child`} — as shown on passport
            </Text>
            <Row style={{ gap: 8 }}>
              <TextInput
                style={inputStyle}
                placeholder="First name"
                placeholderTextColor={c.mutedForeground}
                value={t.firstName}
                onChangeText={(v) => setTraveler(i, { firstName: v })}
              />
              <TextInput
                style={inputStyle}
                placeholder="Last name"
                placeholderTextColor={c.mutedForeground}
                value={t.lastName}
                onChangeText={(v) => setTraveler(i, { lastName: v })}
              />
            </Row>
          </Card>
        ))}

         <Text style={{ fontFamily: 'Georgia', fontSize: 21, color: c.foreground }}>Contact</Text>
        <Card>
          <TextInput
            style={inputStyle}
            placeholder="Email for confirmations"
            placeholderTextColor={c.mutedForeground}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
        </Card>

        {error ? (
          <Text style={{ color: c.destructive, fontSize: 13, fontFamily: 'Inter_500Medium' }}>{error}</Text>
        ) : null}

        <PrimaryButton
          title={submitting ? 'Submitting booking…' : `Book trip · ${money(total, trip.currency)}`}
          icon="check-circle"
          disabled={!valid || submitting}
          onPress={onBook}
        />
        <Text style={{ color: c.mutedForeground, fontSize: 12, textAlign: 'center', fontFamily: 'Inter_400Regular', marginBottom: 24 }}>
          Your booking will be submitted to the travel provider for confirmation. The final status will appear in your booking details.
        </Text>
      </ScrollView>
    </>
  );
}
