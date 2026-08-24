import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Card, EmptyState, PrimaryButton, Row } from '@/components/ui';
import { money } from '@/components/travel';
import { useColors } from '@/hooks/useColors';
import { fetchBooking } from '@/services/bookings';
import { bookingFailedNextSteps, bookingStatusCopy } from '@/services/bookingStatusCopy';
import type { Booking } from '@workspace/api-client-react';

const POLL_MS = 4000;
const MAX_POLLS = 45; // ~3 minutes

export default function BookingStatusScreen() {
  const c = useColors();
  const router = useRouter();
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [failedToLoad, setFailedToLoad] = useState(false);
  const polls = useRef(0);
  const refreshNow = useRef<() => void>(() => {});

  useEffect(() => {
    if (!bookingId) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = async () => {
      try {
        const b = await fetchBooking(bookingId);
        if (stop) return;
        setBooking(b);
        setFailedToLoad(false);
        const settled = b.status === 'booked' || b.status === 'booking_failed' || b.status === 'cancelled';
        if (!settled && polls.current < MAX_POLLS) {
          polls.current += 1;
          timer = setTimeout(tick, POLL_MS);
        }
      } catch {
        if (stop) return;
        if (!booking) setFailedToLoad(true);
        if (polls.current < MAX_POLLS) {
          polls.current += 1;
          timer = setTimeout(tick, POLL_MS);
        }
      }
    };
    refreshNow.current = () => {
      if (stop) return;
      if (timer) clearTimeout(timer);
      polls.current = 0; // give a fresh polling budget after returning to the app
      tick();
    };
    tick();
    return () => {
      stop = true;
      refreshNow.current = () => {};
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  if (!bookingId) {
    return <EmptyState icon="alert-circle" title="Booking not found" message="Missing booking reference." />;
  }
  if (!booking) {
    return failedToLoad ? (
      <EmptyState icon="wifi-off" title="Can't reach the server" message="Retrying — check your connection." />
    ) : (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.background }}>
        <View style={{ width: 54, height: 54, borderRadius: 17, backgroundColor: c.accent, marginBottom: 14 }} />
        <Text style={{ color: c.mutedForeground, fontFamily: 'Inter_500Medium', fontSize: 13 }}>Retrieving booking status…</Text>
      </View>
    );
  }

  const statusColors = {
    paid: c.primary,
    booked: c.success,
    booking_failed: c.destructive,
    cancelled: c.mutedForeground,
  } as const;
  const cfg = {
    ...bookingStatusCopy(booking.status, {
      contactEmail: booking.contactEmail,
      flightConfirmed: booking.flightConfirmed,
      hotelConfirmed: booking.hotelConfirmed,
    }),
    color: statusColors[booking.status],
  };

  const inProgress = booking.status === 'paid';

  return (
    <>
      <Stack.Screen options={{ title: 'Booking' }} />
      <ScrollView style={{ flex: 1, backgroundColor: c.background }} contentContainerStyle={{ padding: 16, gap: 16 }}>
        <Card style={{ alignItems: 'center', paddingVertical: 32 }}>
          {inProgress ? (
            <View style={{ width: 48, height: 48, borderRadius: 15, backgroundColor: cfg.color, marginBottom: 16 }} />
          ) : (
            <Feather name={cfg.icon} size={48} color={cfg.color} style={{ marginBottom: 16 }} />
          )}
          <Text style={{ fontFamily: 'Georgia', fontSize: 23, color: c.foreground, textAlign: 'center' }}>
            {cfg.title}
          </Text>
          <Text
            style={{
              color: c.mutedForeground, fontSize: 14, lineHeight: 21, textAlign: 'center',
              marginTop: 8, fontFamily: 'Inter_400Regular', paddingHorizontal: 8,
            }}
          >
            {cfg.message}
          </Text>
        </Card>

        {booking.status === 'booking_failed' ? (
          <Card style={{ borderColor: c.destructive, borderWidth: 1 }}>
            {booking.errorMessage ? (
              <>
                <Text style={{ color: c.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 14 }}>
                  What went wrong
                </Text>
                <Text
                  style={{
                    color: c.mutedForeground, fontSize: 13, lineHeight: 20,
                    marginTop: 4, fontFamily: 'Inter_400Regular',
                  }}
                >
                  {booking.errorMessage}
                </Text>
              </>
            ) : null}
            <Text
              style={{
                color: c.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 14,
                marginTop: booking.errorMessage ? 12 : 0,
              }}
            >
              What happens next
            </Text>
            <Text
              style={{
                color: c.mutedForeground, fontSize: 13, lineHeight: 20,
                marginTop: 4, fontFamily: 'Inter_400Regular',
              }}
            >
              {bookingFailedNextSteps({
                contactEmail: booking.contactEmail,
                bookingId: booking.id,
                flightConfirmed: booking.flightConfirmed,
                hotelConfirmed: booking.hotelConfirmed,
              })}
            </Text>
          </Card>
        ) : null}

        <Card>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={{ color: c.mutedForeground, fontFamily: 'Inter_400Regular' }}>Destination</Text>
            <Text style={{ color: c.foreground, fontFamily: 'Inter_600SemiBold' }}>
              {booking.destinationName ?? '—'}
            </Text>
          </Row>
          {booking.departureDate ? (
            <Row style={{ justifyContent: 'space-between', marginTop: 8 }}>
              <Text style={{ color: c.mutedForeground, fontFamily: 'Inter_400Regular' }}>Dates</Text>
              <Text style={{ color: c.foreground, fontFamily: 'Inter_600SemiBold' }}>
                {booking.returnDate ? `${booking.departureDate} → ${booking.returnDate}` : `${booking.departureDate} (one-way)`}
              </Text>
            </Row>
          ) : null}
          <Row style={{ justifyContent: 'space-between', marginTop: 8 }}>
              <Text style={{ color: c.mutedForeground, fontFamily: 'Inter_400Regular' }}>Trip total</Text>
            <Text style={{ color: c.primary, fontFamily: 'Inter_700Bold' }}>
              {money(booking.amountCents / 100, booking.currency)}
            </Text>
          </Row>
          {booking.flightReference ? (
            <Row style={{ justifyContent: 'space-between', marginTop: 8 }}>
              <Text style={{ color: c.mutedForeground, fontFamily: 'Inter_400Regular' }}>Flight reference</Text>
              <Text style={{ color: c.foreground, fontFamily: 'Inter_600SemiBold' }}>{booking.flightReference}</Text>
            </Row>
          ) : null}
          {booking.hotelReference ? (
            <Row style={{ justifyContent: 'space-between', marginTop: 8 }}>
              <Text style={{ color: c.mutedForeground, fontFamily: 'Inter_400Regular' }}>Hotel reference</Text>
              <Text style={{ color: c.foreground, fontFamily: 'Inter_600SemiBold' }}>{booking.hotelReference}</Text>
            </Row>
          ) : null}
          <Row style={{ justifyContent: 'space-between', marginTop: 8 }}>
            <Text style={{ color: c.mutedForeground, fontFamily: 'Inter_400Regular' }}>Booking ID</Text>
            <Text style={{ color: c.mutedForeground, fontSize: 12, fontFamily: 'Inter_400Regular' }}>{booking.id.slice(0, 8)}</Text>
          </Row>
        </Card>

        <PrimaryButton title="Back to my trips" icon="map" variant="outline" onPress={() => router.replace('/(tabs)/trips')} />
      </ScrollView>
    </>
  );
}
