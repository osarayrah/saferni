import React from 'react';
import { Alert, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { DayCard, FlightSummaryRow, money, travelImageSource } from '@/components/travel';
import { Card, EmptyState, PrimaryButton, Row, SourceBadge } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { formatDate, regenerateDay } from '@/services/planner';
import { useApp } from '@/store/AppContext';
import type { TripDraft, TripPackage } from '@/types/travel';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useI18n } from '@/services/i18n';

export default function TripScreen() {
  const c = useColors();
  const router = useRouter();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { trips, updateTripDays, saveOffer, unsaveOffer, isOfferSaved, language } = useApp();
  const { t } = useI18n(language);
  const trip = trips.find((t) => t.id === tripId);

  if (!trip) {
    return (
      <View style={{ flex: 1, backgroundColor: c.background, justifyContent: 'center' }}>
        <EmptyState icon="briefcase" title="Trip not found" message="This trip may have been deleted." />
      </View>
    );
  }

  const daysUntil = Math.ceil((new Date(trip.departureDate + 'T12:00:00').getTime() - Date.now()) / 86400000);

  const draftLike: TripDraft = {
    origin: trip.origin,
    destinationCode: trip.destinationCode,
    destinationName: trip.destinationName,
    departureDate: trip.departureDate,
    returnDate: trip.returnDate,
    nights: trip.days.length - 1,
    adults: trip.adults,
    children: trip.children,
    budget: trip.budget || undefined,
    currency: trip.currency,
    styles: [],
  };
  const pkgLike: TripPackage = {
    id: 'x', title: '', recommendationType: 'custom',
    flight: trip.flight, hotel: trip.hotel,
    estimatedActivitiesTotal: 0, estimatedFoodTotal: 0, estimatedLocalTransportTotal: 0,
    totalPrice: trip.estimatedTotal, currency: trip.currency,
    pricePerTraveller: 0, budgetDifference: 0, score: 0,
    advantages: [], disadvantages: [], warnings: [],
  };

  const onRegenerateDay = (dayId: string) => {
    const day = trip.days.find((d) => d.id === dayId);
    if (!day) return;
    if (day.dayNumber === 1 || day.dayNumber === trip.days.length) {
      Alert.alert('Travel day', 'Arrival and departure days follow your flights and can’t be regenerated.');
      return;
    }
    const next = regenerateDay(draftLike, pkgLike, day);
    updateTripDays(trip.id, trip.days.map((d) => (d.id === dayId ? next : d)));
  };

  const onRemoveItem = (dayId: string, itemId: string) => {
    updateTripDays(
      trip.id,
      trip.days.map((d) =>
        d.id === dayId
          ? {
              ...d,
              items: d.items.filter((i) => i.id !== itemId),
              estimatedCost: d.items.filter((i) => i.id !== itemId).reduce((s, i) => s + i.estimatedCost, 0),
            }
          : d,
      ),
    );
  };

  const onShare = () => {
    const lines = trip.days.map((d) => `Day ${d.dayNumber} (${formatDate(d.date)}): ${d.title}`).join('\n');
    Share.share({
      message: `Safferni trip — ${trip.destinationName}, ${trip.country}\n${formatDate(trip.departureDate)}${trip.oneWay ? ' (one-way)' : ` – ${formatDate(trip.returnDate)}`}\nEstimated total: ${money(trip.estimatedTotal, trip.currency)}\n\n${lines}`,
    }).catch(() => {});
  };

  const saved = isOfferSaved(trip.id);
  const toggleSave = () =>
    saved
      ? unsaveOffer(trip.id)
      : saveOffer({
          id: trip.id,
          kind: 'package',
          currency: trip.currency,
          destinationName: trip.destinationName,
          destinationCode: trip.destinationCode,
          origin: trip.origin,
          departureDate: trip.departureDate,
          returnDate: trip.returnDate,
          package: pkgLike,
        });

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.background }} contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 60 }}>
      <Image source={travelImageSource(trip.coverImage)} style={{ width: '100%', height: 160, borderRadius: 16 }} contentFit="cover" />
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
           <Text style={{ fontFamily: 'Georgia', fontSize: 27, color: c.foreground, letterSpacing: -0.4 }}>
            {trip.destinationName}, {trip.country}
          </Text>
          <Text style={{ color: c.mutedForeground, fontSize: 14 }}>
            {formatDate(trip.departureDate)}
            {trip.oneWay ? ' · One-way' : ` – ${formatDate(trip.returnDate)}`} · {trip.adults + trip.children} travellers
          </Text>
        </View>
        <Row style={{ gap: 12 }}>
          <SourceBadge sourceType={trip.sourceType} />
          <Pressable
            onPress={toggleSave}
            accessibilityRole="button"
            accessibilityLabel={saved ? 'Remove from saved' : 'Save this package'}
            hitSlop={8}
          >
            <Feather name="heart" size={20} color={saved ? c.secondary : c.mutedForeground} />
          </Pressable>
        </Row>
      </Row>

      {trip.flight.bookingRef || trip.hotel.bookingRef ? (
        <PrimaryButton
          title={`Book this trip · ${money(trip.flight.totalPrice + trip.hotel.totalPrice, trip.currency)}`}
          icon="credit-card"
          onPress={() => router.push({ pathname: '/booking/new', params: { tripId: trip.id } })}
        />
      ) : null}

      {daysUntil > 0 ? (
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Feather name="clock" size={17} color={c.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 15, color: c.foreground }}>
              {daysUntil} day{daysUntil === 1 ? '' : 's'} to go
            </Text>
            <Text style={{ color: c.mutedForeground, fontSize: 12 }}>Departure {formatDate(trip.departureDate)}</Text>
          </View>
        </Card>
      ) : null}

       <View style={styles.quickActions}>
         <PrimaryButton title="Budget" icon="pie-chart" variant="outline" style={styles.quickAction} onPress={() => router.push({ pathname: '/trip-budget', params: { tripId: trip.id } })} />
         <PrimaryButton title="Map" icon="map" variant="outline" style={styles.quickAction} onPress={() => router.push({ pathname: '/trip-map', params: { tripId: trip.id } })} />
         <PrimaryButton title="Packing" icon="check-square" variant="outline" style={styles.quickAction} onPress={() => router.push({ pathname: '/trip-packing', params: { tripId: trip.id } })} />
         <PrimaryButton title="Share" icon="share-2" variant="outline" style={styles.quickAction} onPress={onShare} />
       </View>

      <Card style={{ gap: 10 }}>
        <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 14, color: c.mutedForeground }}>Selected flight</Text>
        <FlightSummaryRow flight={trip.flight} />
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={{ color: c.mutedForeground, fontSize: 13 }}>{trip.flight.validatingAirline}</Text>
          <Text style={{ fontFamily: 'Inter_600SemiBold', color: c.foreground }}>{money(trip.flight.totalPrice, trip.currency)}</Text>
        </Row>
        <View style={{ height: 1, backgroundColor: c.border }} />
        <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 14, color: c.mutedForeground }}>Selected hotel</Text>
        <Row style={{ justifyContent: 'space-between' }}>
          <Row style={{ gap: 6, flex: 1 }}>
            <Feather name="home" size={14} color={c.primary} />
            <Text style={{ color: c.foreground, fontSize: 14, flex: 1 }} numberOfLines={1}>
              {trip.hotel.name} · {trip.hotel.starRating}★
            </Text>
          </Row>
          <Text style={{ fontFamily: 'Inter_600SemiBold', color: c.foreground }}>{money(trip.hotel.totalPrice, trip.currency)}</Text>
        </Row>
      </Card>

      <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 18, color: c.foreground, marginTop: 4 }}>{t('Itinerary')}</Text>
      {trip.days.map((d) => (
        <DayCard
          key={d.id}
          day={d}
          currency={trip.currency}
          onRegenerate={() => onRegenerateDay(d.id)}
          onRemoveItem={(itemId) => onRemoveItem(d.id, itemId)}
        />
      ))}
    </ScrollView>
  );
}

const styles = {
  quickActions: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 10,
  },
  quickAction: {
    width: '47%' as const,
    minHeight: 48,
    paddingHorizontal: 8,
  },
};
