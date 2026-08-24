import React, { useMemo, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card, Chip, DemoBanner, EmptyState, Row } from '@/components/ui';
import TripMap from '@/components/TripMap';
import type { TripMapMarker } from '@/components/TripMap.types';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/store/AppContext';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';

export default function TripMapScreen() {
  const c = useColors();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { trips } = useApp();
  const trip = trips.find((t) => t.id === tripId);
  const [dayFilter, setDayFilter] = useState<number | null>(null);

  const markers = useMemo<TripMapMarker[]>(() => {
    if (!trip) return [];
    const list: TripMapMarker[] = [
      {
        id: 'hotel',
        title: trip.hotel.name,
        subtitle: 'Your hotel',
        latitude: trip.hotel.latitude,
        longitude: trip.hotel.longitude,
        kind: 'hotel',
      },
    ];
    trip.days.forEach((d) => {
      d.items.forEach((i) => {
        if (i.latitude && i.longitude && (i.category === 'activity' || i.category === 'food')) {
          list.push({
            id: i.id,
            title: i.title,
            subtitle: `Day ${d.dayNumber} · ${i.locationName}`,
            latitude: i.latitude,
            longitude: i.longitude,
            kind: i.category === 'food' ? 'food' : 'activity',
            day: d.dayNumber,
          });
        }
      });
    });
    return list;
  }, [trip]);

  if (!trip) {
    return (
      <View style={{ flex: 1, backgroundColor: c.background, justifyContent: 'center' }}>
        <EmptyState icon="map" title="Trip not found" message="This trip may have been deleted." />
      </View>
    );
  }

  const filtered = dayFilter ? markers.filter((m) => m.kind === 'hotel' || m.day === dayFilter) : markers;
  const days = Array.from(new Set(markers.filter((m) => m.day).map((m) => m.day as number))).sort((a, b) => a - b);

  const openInMaps = (m: TripMapMarker) => {
    const q = `${m.latitude},${m.longitude}`;
    const url =
      Platform.OS === 'ios'
        ? `http://maps.apple.com/?ll=${q}&q=${encodeURIComponent(m.title)}`
        : `https://www.google.com/maps/search/?api=1&query=${q}`;
    Linking.openURL(url).catch(() => {});
  };

  const kindIcon: Record<TripMapMarker['kind'], keyof typeof Feather.glyphMap> = {
    hotel: 'home',
    activity: 'compass',
    food: 'coffee',
    flight: 'send',
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.background }} contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 60 }}>
      <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 22, color: c.foreground }}>
        {trip.destinationName} map
      </Text>
      <DemoBanner />

      <Row style={{ flexWrap: 'wrap', gap: 8 }}>
        <Chip small label="All days" selected={dayFilter === null} onPress={() => setDayFilter(null)} />
        {days.map((d) => (
          <Chip key={d} small label={`Day ${d}`} selected={dayFilter === d} onPress={() => setDayFilter(d)} />
        ))}
      </Row>

      <View style={[styles.mapCanvas, { borderColor: c.border }]}>
        <TripMap markers={filtered} kindIcon={kindIcon} onMarkerPress={openInMaps} />
      </View>

      {filtered.map((m) => (
        <Pressable key={`row_${m.id}`} onPress={() => openInMaps(m)} accessibilityRole="button">
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={[styles.rowIcon, { backgroundColor: m.kind === 'hotel' ? c.secondary : c.primary }]}>
              <Feather name={kindIcon[m.kind]} size={14} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 14, color: c.foreground }} numberOfLines={1}>
                {m.title}
              </Text>
              <Text style={{ color: c.mutedForeground, fontSize: 12 }}>{m.subtitle}</Text>
            </View>
            <Feather name="external-link" size={15} color={c.mutedForeground} />
          </Card>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  mapCanvas: {
    height: 320,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  rowIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
});
