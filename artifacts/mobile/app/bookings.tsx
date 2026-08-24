import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter, Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Card, EmptyState, Row } from '@/components/ui';
import { money } from '@/components/travel';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@clerk/expo';
import { fetchMyBookings } from '@/services/bookings';
import type { Booking, BookingStatus } from '@workspace/api-client-react';

const STATUS_LABEL: Record<BookingStatus, string> = {
  paid: 'Booking in progress',
  booked: 'Booked',
  booking_failed: 'Needs attention',
  cancelled: 'Cancelled',
};

export default function BookingsListScreen() {
  const c = useColors();
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setBookings(await fetchMyBookings(Boolean(isSignedIn)));
    } catch {
      setBookings((prev) => prev ?? []);
    }
  }, [isSignedIn]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const statusColor = (s: BookingStatus) =>
    s === 'booked' ? c.success : s === 'booking_failed' ? c.destructive : s === 'cancelled' ? c.mutedForeground : c.warning;

  return (
    <>
      <Stack.Screen options={{ title: 'My bookings' }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: c.background }}
         contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 42 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
            tintColor={c.primary}
          />
        }
      >
         {bookings === null ? (
           <View style={{ gap: 12, paddingTop: 8 }}>
             {[0, 1, 2].map((item) => (
               <Card key={item} style={{ gap: 12 }}>
                 <View style={{ width: '55%', height: 18, borderRadius: 5, backgroundColor: c.muted }} />
                 <View style={{ width: '78%', height: 12, borderRadius: 4, backgroundColor: c.muted }} />
                 <View style={{ width: '30%', height: 14, borderRadius: 4, backgroundColor: c.muted }} />
               </Card>
             ))}
           </View>
         ) : bookings.length === 0 ? (
          <EmptyState
            icon="briefcase"
            title="No bookings yet"
            message="When you book a trip, it will show up here with its confirmation status."
          />
        ) : (
          bookings.map((b) => (
            <Pressable key={b.id} onPress={() => router.push({ pathname: '/booking/[bookingId]', params: { bookingId: b.id } })}>
            <Card>
              <Row style={{ justifyContent: 'space-between' }}>
                 <Text style={{ fontFamily: 'Georgia', fontSize: 19, color: c.foreground }}>
                  {b.destinationName ?? 'Trip'}
                </Text>
                <Text style={{ color: statusColor(b.status), fontSize: 12, fontFamily: 'Inter_700Bold' }}>
                  {STATUS_LABEL[b.status]}
                </Text>
              </Row>
              {b.departureDate ? (
                <Text style={{ color: c.mutedForeground, fontSize: 13, marginTop: 4, fontFamily: 'Inter_400Regular' }}>
                  {b.returnDate ? `${b.departureDate} → ${b.returnDate}` : `${b.departureDate} (one-way)`}
                </Text>
              ) : null}
              <Row style={{ justifyContent: 'space-between', marginTop: 8 }}>
                <Text style={{ color: c.mutedForeground, fontSize: 12, fontFamily: 'Inter_400Regular' }}>
                  {new Date(b.createdAt).toLocaleDateString()}
                </Text>
                <Text style={{ color: c.primary, fontFamily: 'Inter_700Bold' }}>
                  {money(b.amountCents / 100, b.currency)}
                </Text>
              </Row>
            </Card>
            </Pressable>
          ))
        )}
        <View style={{ height: 24 }} />
      </ScrollView>
    </>
  );
}
