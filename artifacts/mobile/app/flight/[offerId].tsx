import React from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { money } from '@/components/travel';
import { AirlineLogo, Card, EmptyState, PrimaryButton, Row, SourceBadge } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { formatDuration } from '@/services/planner';
import { useApp } from '@/store/AppContext';
import type { FlightItinerary, FlightOffer, FlightSegment } from '@/types/travel';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';

function useFindFlight(offerId?: string): FlightOffer | undefined {
  const { search, trips, savedOffers } = useApp();
  if (!offerId) return undefined;
  return (
    search?.flights.find((f) => f.id === offerId) ??
    trips.map((t) => t.flight).find((f) => f.id === offerId) ??
    savedOffers.map((o) => o.flight).find((f) => f?.id === offerId)
  );
}

function LayoverRow({ current, next }: { current: FlightSegment; next: FlightSegment }) {
  const c = useColors();
  const minutes = Math.round((new Date(next.departureTime).getTime() - new Date(current.arrivalTime).getTime()) / 60000);
  const valid = Number.isFinite(minutes) && minutes > 0;
  return (
    <Row style={{ gap: 6, marginVertical: 4 }}>
      <Feather name="clock" size={13} color={c.warning} />
      <Text style={{ color: c.warning, fontSize: 12 }}>
        {valid ? `${formatDuration(minutes)} layover in ${current.arrivalAirport}` : 'Layover — check connection time'}
      </Text>
    </Row>
  );
}

function Leg({ label, itin }: { label: string; itin: FlightItinerary }) {
  const c = useColors();
  return (
    <Card style={{ gap: 10 }}>
      <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 14, color: c.mutedForeground }}>{label}</Text>
      {itin.segments.map((s, i) => (
        <View key={`${s.flightNumber}_${i}`} style={{ gap: 4 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 15, color: c.foreground }}>
              {s.departureAirport} → {s.arrivalAirport}
            </Text>
            <Text style={{ color: c.mutedForeground, fontSize: 13 }}>{formatDuration(s.durationMinutes)}</Text>
          </Row>
          <Row style={{ gap: 6 }}>
            <AirlineLogo iataCode={s.airlineCode} size={16} />
            <Text style={{ color: c.mutedForeground, fontSize: 13 }}>
              {s.airlineName} {s.flightNumber} · dep {s.departureTime.slice(11, 16)} → arr {s.arrivalTime.slice(11, 16)} (local)
            </Text>
          </Row>
          {i < itin.segments.length - 1 ? <LayoverRow current={s} next={itin.segments[i + 1]} /> : null}
        </View>
      ))}
      <Text style={{ color: c.mutedForeground, fontSize: 12 }}>Total: {formatDuration(itin.durationMinutes)}</Text>
    </Card>
  );
}

export default function FlightDetailScreen() {
  const c = useColors();
  const { offerId } = useLocalSearchParams<{ offerId: string }>();
  const flight = useFindFlight(offerId);
  const { saveOffer, unsaveOffer, isOfferSaved } = useApp();

  if (!flight) {
    return (
      <View style={{ flex: 1, backgroundColor: c.background, justifyContent: 'center' }}>
        <EmptyState icon="send" title="Flight not found" message="This offer is no longer available in the current session." />
      </View>
    );
  }

  const warnings: string[] = [];
  if (flight.baggage.unknown) warnings.push('Checked baggage information unavailable for this fare.');
  if (!flight.refundable) warnings.push('Non-refundable fare.');
  if (flight.totalStops > 0) warnings.push('Itinerary includes connections — allow time between flights.');

  const saved = isOfferSaved(flight.id);
  const toggleSave = () =>
    saved ? unsaveOffer(flight.id) : saveOffer({ id: flight.id, kind: 'flight', currency: flight.currency, flight });

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.background }} contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 60 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Row style={{ gap: 10 }}>
          <AirlineLogo iataCode={flight.outbound.segments[0]?.airlineCode} size={28} />
          <Text style={{ fontFamily: 'Georgia', fontSize: 25, color: c.foreground, letterSpacing: -0.3 }}>{flight.validatingAirline}</Text>
        </Row>
        <Row style={{ gap: 12 }}>
          <SourceBadge sourceType={flight.sourceType} />
          <Pressable
            onPress={toggleSave}
            accessibilityRole="button"
            accessibilityLabel={saved ? 'Remove from saved' : 'Save flight'}
            hitSlop={8}
          >
            <Feather name="heart" size={20} color={saved ? c.secondary : c.mutedForeground} />
          </Pressable>
        </Row>
      </Row>

      <Leg label="Outbound" itin={flight.outbound} />
      {flight.inbound ? <Leg label="Return" itin={flight.inbound} /> : null}

      <Card style={{ gap: 8 }}>
        <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 14, color: c.mutedForeground }}>Fare details</Text>
        <DetailRow label="Cabin" value={flight.cabinClass === 'business' ? 'Business' : 'Economy'} />
        <DetailRow label="Cabin baggage" value={flight.baggage.cabin ?? 'Unknown'} />
        <DetailRow label="Checked baggage" value={flight.baggage.checked ?? 'Unknown'} />
        <DetailRow label="Refundable" value={flight.refundable ? 'Yes (fees may apply)' : 'No'} />
        <DetailRow label="Changes" value={flight.changeable ? 'Permitted' : 'Not permitted'} />
        <DetailRow label="Fare rules" value={flight.fareRulesSummary ?? 'Unavailable'} />
        <DetailRow label="Data updated" value={new Date(flight.lastUpdatedAt).toLocaleString()} />
      </Card>

      {warnings.length ? (
        <Card style={{ gap: 6 }}>
          {warnings.map((w) => (
            <Row key={w} style={{ gap: 8 }}>
              <Feather name="alert-triangle" size={14} color={c.warning} />
              <Text style={{ color: c.warning, fontSize: 13, flex: 1 }}>{w}</Text>
            </Row>
          ))}
        </Card>
      ) : null}

      <Card style={{ gap: 4 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={{ color: c.mutedForeground, fontSize: 14 }}>Total ({flight.currency})</Text>
          <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 22, color: c.foreground }}>
            {money(flight.totalPrice, flight.currency)}
          </Text>
        </Row>
        <Text style={{ color: c.mutedForeground, fontSize: 12 }}>
          {money(flight.pricePerTraveller, flight.currency)} per traveller · estimate, taxes included where known
        </Text>
      </Card>

      <PrimaryButton
        title="Open demo booking link"
        icon="external-link"
        variant="secondary"
        onPress={() => flight.bookingUrl && Linking.openURL(flight.bookingUrl)}
      />
      <Text style={{ color: c.mutedForeground, fontSize: 12, textAlign: 'center' }}>
        Safferni never books automatically — booking always happens on the provider's site.
      </Text>
    </ScrollView>
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

const styles = StyleSheet.create({});
