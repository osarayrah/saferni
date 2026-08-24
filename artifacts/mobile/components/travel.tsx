import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AirlineLogo, Card, Chip, Row, SourceBadge } from '@/components/ui';
import colors from '@/constants/colors';
import { useColors } from '@/hooks/useColors';
import { formatDate, formatDuration, stopsSummary } from '@/services/planner';
import type {
  Destination,
  FlightOffer,
  HotelOffer,
  ItineraryDay,
  Trip,
  TripPackage,
} from '@/types/travel';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useApp } from '@/store/AppContext';
import { useI18n } from '@/services/i18n';

export const DEST_IMAGES: Record<string, number> = {
  beach: require('../assets/images/dest_beach.jpg'),
  city: require('../assets/images/dest_city.jpg'),
  nature: require('../assets/images/dest_nature.jpg'),
};

export function travelImageSource(value?: string | number): number | { uri: string } {
  if (typeof value === 'number') return value;
  if (!value) return DEST_IMAGES.beach;
  if (DEST_IMAGES[value]) return DEST_IMAGES[value];
  return { uri: value };
}

export function money(amount: number, currency: string): string {
  return `${currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency + ' '}${Math.round(amount).toLocaleString()}`;
}

// flight.baggage.checked is a pre-formatted display string from the backend:
// "Included (23kg)" reads fine on its own, but "From USD53.13 (23kg)" (a
// per-bag price) has nothing tying it to baggage, so that case gets a
// "Bags:" prefix and the currency code swapped for a symbol to match money().
function baggageChipLabel(checked: string | undefined): string {
  if (!checked) return 'Bags: unknown';
  if (!checked.startsWith('From ')) return checked;
  return `Bags: from ${checked.slice(5).replace(/^USD/, '$').replace(/^EUR/, '€')}`;
}

export function FlightSummaryRow({ flight }: { flight: FlightOffer }) {
  const c = useColors();
  const out = flight.outbound.segments[0];
  const lastOut = flight.outbound.segments[flight.outbound.segments.length - 1];
  return (
    <Row style={{ justifyContent: 'space-between' }}>
      <Row style={{ gap: 6 }}>
        <Feather name="arrow-up-right" size={14} color={c.primary} />
        <Text style={{ color: c.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 14 }}>
          {out.departureAirport}  /  {lastOut.arrivalAirport}
        </Text>
      </Row>
        <Text style={{ color: c.mutedForeground, fontSize: 12, fontFamily: 'Inter_500Medium' }}>
        {formatDuration(flight.outbound.durationMinutes)} · {stopsSummary(flight)}
      </Text>
    </Row>
  );
}

export function FlightCard({ flight, onPress }: { flight: FlightOffer; onPress?: () => void }) {
  const c = useColors();
  const { language } = useApp();
  const { t } = useI18n(language);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}>
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Row style={{ gap: 8 }}>
            <AirlineLogo iataCode={flight.outbound.segments[0]?.airlineCode} />
            <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 15, color: c.foreground, letterSpacing: 0.1 }}>
              {flight.validatingAirline}
            </Text>
          </Row>
          <SourceBadge sourceType={flight.sourceType} />
        </Row>
        <FlightSummaryRow flight={flight} />
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Row style={{ gap: 6, flex: 1, flexWrap: 'wrap' }}>
             <Chip small label={t(flight.cabinClass === 'business' ? 'Business' : 'Economy')} />
             {flight.refundable ? <Chip small label={t('Refundable')} /> : null}
            <Chip small label={baggageChipLabel(flight.baggage.checked)} />
          </Row>
          <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 17, color: c.foreground, flexShrink: 0, marginLeft: 8 }}>
            {money(flight.totalPrice, flight.currency)}
          </Text>
        </Row>
      </Card>
    </Pressable>
  );
}

export function HotelCard({ hotel, onPress }: { hotel: HotelOffer; onPress?: () => void }) {
  const c = useColors();
  const { language } = useApp();
  const { t } = useI18n(language);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}>
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 15, color: c.foreground, flex: 1 }} numberOfLines={1}>
            {hotel.name}
          </Text>
          <SourceBadge sourceType={hotel.sourceType} />
        </Row>
        <Row style={{ gap: 4 }}>
          {Array.from({ length: hotel.starRating }).map((_, i) => (
            <Feather key={i} name="star" size={12} color={c.warning} />
          ))}
          <Text style={{ color: c.mutedForeground, fontSize: 13, marginLeft: 4 }}>
            {hotel.guestRating.toFixed(1)} · {hotel.reviewCount.toLocaleString()} reviews
          </Text>
        </Row>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={{ color: c.mutedForeground, fontSize: 13 }}>
             {t(hotel.refundable ? 'Free cancellation' : 'Non-refundable')} · {hotel.distanceFromCenterKm} km from centre
          </Text>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 17, color: c.foreground }}>
              {money(hotel.totalPrice, hotel.currency)}
            </Text>
            <Text style={{ color: c.mutedForeground, fontSize: 11 }}>{money(hotel.nightlyPrice, hotel.currency)}/night</Text>
          </View>
        </Row>
      </Card>
    </Pressable>
  );
}

export function PackageCard({
  pkg,
  budget,
  onPress,
  onSelect,
}: {
  pkg: TripPackage;
  budget?: number;
  onPress?: () => void;
  onSelect: () => void;
}) {
  const c = useColors();
  const { language } = useApp();
  const { t } = useI18n(language);
  const over = budget ? pkg.totalPrice - budget : 0;
  const typeIcon: Record<string, keyof typeof Feather.glyphMap> = {
    best_overall: 'award',
    lowest_price: 'trending-down',
    most_comfortable: 'heart',
    custom: 'sliders',
  };
  return (
    <Card style={{ gap: 12 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Row style={{ gap: 8 }}>
          <View style={[styles.pkgIcon, { backgroundColor: c.accent }]}>
            <Feather name={typeIcon[pkg.recommendationType]} size={16} color={c.primary} />
          </View>
          <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 16, color: c.foreground }}>{pkg.title}</Text>
        </Row>
        <SourceBadge sourceType={pkg.flight.sourceType} />
      </Row>

      <FlightSummaryRow flight={pkg.flight} />
      <Row style={{ gap: 6 }}>
        <Feather name="home" size={14} color={c.primary} />
        <Text style={{ color: c.foreground, fontSize: 14, flex: 1 }} numberOfLines={1}>
          {pkg.hotel.name} · {pkg.hotel.starRating}★
        </Text>
      </Row>

      <View style={[styles.divider, { backgroundColor: c.border }]} />

      <Row style={{ justifyContent: 'space-between' }}>
        <View>
        <Text style={{ fontFamily: 'Georgia', fontSize: 21, color: c.foreground, letterSpacing: -0.3 }}>
            {money(pkg.totalPrice, pkg.currency)}
          </Text>
          <Text style={{ color: c.mutedForeground, fontSize: 12 }}>
            {money(pkg.pricePerTraveller, pkg.currency)} per traveller · est. total
          </Text>
        </View>
        {budget ? (
          <Text style={{ color: over > 0 ? c.destructive : c.success, fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>
            {over > 0 ? `${money(over, pkg.currency)} over budget` : `${money(-over, pkg.currency)} under budget`}
          </Text>
        ) : null}
      </Row>

      {pkg.advantages.slice(0, 2).map((a) => (
        <Row key={a} style={{ gap: 6 }}>
          <Feather name="check" size={13} color={c.success} />
          <Text style={{ color: c.mutedForeground, fontSize: 13, flex: 1 }}>{a}</Text>
        </Row>
      ))}
      {pkg.warnings.slice(0, 1).map((w) => (
        <Row key={w.code} style={{ gap: 6 }}>
          <Feather name="alert-triangle" size={13} color={c.warning} />
          <Text style={{ color: c.warning, fontSize: 13, flex: 1 }}>{w.message}</Text>
        </Row>
      ))}

      <Row style={{ gap: 10 }}>
        {onPress ? (
          <Pressable onPress={onPress} accessibilityRole="button" style={[styles.viewBtn, { borderColor: c.primary }]}>
             <Text style={{ color: c.primary, fontFamily: 'Inter_600SemiBold', fontSize: 14 }}>{t('Details')}</Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={onSelect}
          accessibilityRole="button"
          style={({ pressed }) => [styles.selectBtn, { backgroundColor: c.primary, opacity: pressed ? 0.85 : 1 }]}
        >
             <Text style={{ color: c.primaryForeground, fontFamily: 'Inter_600SemiBold', fontSize: 14 }}>
             {t('Choose this package')}
          </Text>
        </Pressable>
      </Row>
    </Card>
  );
}

export function DestinationCard({
  destination,
  onPress,
  wide,
}: {
  destination: Destination;
  onPress: () => void;
  wide?: boolean;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.destCard,
        wide && { width: '100%' },
        { backgroundColor: c.card, borderColor: c.border, opacity: pressed ? 0.92 : 1 },
      ]}
    >
      <Image source={DEST_IMAGES[destination.image]} style={styles.destImage} contentFit="cover" transition={200} />
      <View style={{ padding: 12, gap: 4 }}>
        <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 15, color: c.foreground }}>
          {destination.city}, {destination.country}
        </Text>
        <Text style={{ color: c.mutedForeground, fontSize: 12 }} numberOfLines={wide ? 2 : 1}>
          {destination.description}
        </Text>
        <Row style={{ justifyContent: 'space-between', marginTop: 2 }}>
          <Text style={{ color: c.primary, fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>
            est. {destination.budgetRange}
          </Text>
          <Text style={{ color: c.mutedForeground, fontSize: 11 }}>{destination.bestMonths}</Text>
        </Row>
      </View>
    </Pressable>
  );
}

export function TripCard({ trip, onPress }: { trip: Trip; onPress: () => void }) {
  const c = useColors();
  const daysUntil = Math.ceil((new Date(trip.departureDate + 'T12:00:00').getTime() - Date.now()) / 86400000);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.tripCard, { backgroundColor: c.card, borderColor: c.border, opacity: pressed ? 0.92 : 1 }]}
    >
      <Image source={travelImageSource(trip.coverImage)} style={styles.tripImage} contentFit="cover" />
      <View style={{ flex: 1, padding: 12, gap: 3 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 15, color: c.foreground }} numberOfLines={1}>
            {trip.destinationName}
          </Text>
          <SourceBadge sourceType={trip.sourceType} />
        </Row>
        <Text style={{ color: c.mutedForeground, fontSize: 12 }}>
          {formatDate(trip.departureDate)}
          {trip.oneWay ? ' · One-way' : ` – ${formatDate(trip.returnDate)}`} · {trip.adults + trip.children} travellers
        </Text>
        <Row style={{ justifyContent: 'space-between', marginTop: 2 }}>
          <Text style={{ color: c.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>
            {money(trip.estimatedTotal, trip.currency)} est.
          </Text>
          {daysUntil > 0 ? (
            <Text style={{ color: c.primary, fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>in {daysUntil} days</Text>
          ) : (
            <Text style={{ color: c.mutedForeground, fontSize: 12 }}>{trip.status}</Text>
          )}
        </Row>
      </View>
    </Pressable>
  );
}

export function DayCard({
  day,
  currency,
  onRegenerate,
  onRemoveItem,
}: {
  day: ItineraryDay;
  currency: string;
  onRegenerate?: () => void;
  onRemoveItem?: (itemId: string) => void;
}) {
  const c = useColors();
  const { language } = useApp();
  const { t } = useI18n(language);
  const catIcon: Record<string, keyof typeof Feather.glyphMap> = {
    activity: 'compass',
    food: 'coffee',
    transport: 'truck',
    rest: 'moon',
    flight: 'send',
    hotel: 'home',
  };
  return (
    <Card style={{ gap: 12 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 15, color: c.foreground }}>
             {t('Day')} {day.dayNumber} · {formatDate(day.date)}
          </Text>
          <Text style={{ color: c.mutedForeground, fontSize: 13 }}>{day.title}</Text>
        </View>
        {onRegenerate ? (
          <Pressable onPress={onRegenerate} accessibilityRole="button" accessibilityLabel="Regenerate day" hitSlop={8}>
            <Feather name="refresh-cw" size={17} color={c.primary} />
          </Pressable>
        ) : null}
      </Row>
      {day.items.map((item, itemIndex) => (
        <Row key={item.id} style={{ alignItems: 'flex-start', gap: 10 }}>
          <View style={styles.timelineRail}>
            <View style={[styles.itemIcon, { backgroundColor: c.accent }]}>
              <Feather name={catIcon[item.category] ?? 'map-pin'} size={13} color={c.primary} />
            </View>
            {itemIndex < day.items.length - 1 ? <View style={[styles.timelineLine, { backgroundColor: c.border }]} /> : null}
          </View>
          <View style={{ flex: 1, gap: 1 }}>
            <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 13.5, color: c.foreground }}>{item.title}</Text>
            <Text style={{ color: c.mutedForeground, fontSize: 12, lineHeight: 17 }} numberOfLines={2}>
              {item.description}
            </Text>
            <Row style={{ gap: 8, flexWrap: 'wrap' }}>
              <Text style={{ color: c.mutedForeground, fontSize: 11 }}>{item.timeOfDay}</Text>
              {item.estimatedCost > 0 ? (
                <Text style={{ color: c.primary, fontSize: 11, fontFamily: 'Inter_600SemiBold' }}>
                  ~{money(item.estimatedCost, currency)}
                </Text>
              ) : null}
              {item.reservationRequired ? (
             <Text style={{ color: c.warning, fontSize: 11 }}>{t('Reserve ahead')}</Text>
              ) : null}
            </Row>
          </View>
          {onRemoveItem && item.category === 'activity' ? (
            <Pressable onPress={() => onRemoveItem(item.id)} accessibilityRole="button" accessibilityLabel="Remove activity" hitSlop={8}>
              <Feather name="x" size={15} color={c.mutedForeground} />
            </Pressable>
          ) : null}
        </Row>
      ))}
      <Text style={{ color: c.mutedForeground, fontSize: 12, textAlign: 'right' }}>
         {t('Day')} estimate: {money(day.estimatedCost, currency)}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  pkgIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  divider: { height: StyleSheet.hairlineWidth, width: '100%' },
  viewBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: colors.radius,
    borderWidth: 1.5,
  },
  selectBtn: {
    flex: 2,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: colors.radius,
  },
  destCard: {
    width: 248,
    borderRadius: colors.radius,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  destImage: { width: '100%', height: 148 },
  tripCard: {
    flexDirection: 'row',
    borderRadius: colors.radius,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  tripImage: { width: 96, height: '100%' },
  itemIcon: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  timelineRail: { width: 26, alignItems: 'center', minHeight: 48 },
  timelineLine: { width: 1, flex: 1, marginTop: 4 },
});
