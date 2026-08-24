import React, { useEffect, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card, EmptyState, PrimaryButton, Row } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { PACKING_CATEGORY_ORDER, generatePackingList } from '@/services/packing';
import { useApp } from '@/store/AppContext';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams } from 'expo-router';

export default function PackingScreen() {
  const c = useColors();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { trips, updateTrip } = useApp();
  const trip = trips.find((t) => t.id === tripId);

  useEffect(() => {
    if (trip && !trip.packing) {
      updateTrip(trip.id, { packing: generatePackingList(trip) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip?.id, trip?.packing]);

  const grouped = useMemo(() => {
    if (!trip?.packing) return [];
    return PACKING_CATEGORY_ORDER.map((cat) => ({
      category: cat,
      items: trip.packing!.filter((i) => i.category === cat),
    })).filter((g) => g.items.length > 0);
  }, [trip?.packing]);

  if (!trip) {
    return (
      <View style={{ flex: 1, backgroundColor: c.background, justifyContent: 'center' }}>
        <EmptyState icon="check-square" title="Trip not found" message="This trip may have been deleted." />
      </View>
    );
  }

  const packing = trip.packing ?? [];
  const done = packing.filter((i) => i.checked).length;
  const progress = packing.length ? done / packing.length : 0;

  const toggle = (itemId: string) => {
    Haptics.selectionAsync().catch(() => {});
    updateTrip(trip.id, (t) => ({
      packing: (t.packing ?? []).map((i) => (i.id === itemId ? { ...i, checked: !i.checked } : i)),
    }));
  };

  const reset = () => updateTrip(trip.id, { packing: generatePackingList(trip) });

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.background }} contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 60 }}>
      <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 22, color: c.foreground }}>Packing list</Text>
      <Text style={{ color: c.mutedForeground, fontSize: 14 }}>
        Suggested for {trip.destinationName} — tailored to your trip. Tap to check items off.
      </Text>

      <Card style={{ gap: 8 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 14, color: c.foreground }}>
            {done} of {packing.length} packed
          </Text>
          <Text style={{ color: c.primary, fontFamily: 'Inter_700Bold', fontSize: 14 }}>{Math.round(progress * 100)}%</Text>
        </Row>
        <View style={[styles.barBg, { backgroundColor: c.muted }]}>
          <View style={[styles.bar, { backgroundColor: progress === 1 ? c.success : c.primary, width: `${Math.max(2, progress * 100)}%` }]} />
        </View>
        {progress === 1 && packing.length > 0 ? (
          <Row style={{ gap: 6 }}>
            <Feather name="check-circle" size={14} color={c.success} />
            <Text style={{ color: c.success, fontSize: 13, fontFamily: 'Inter_600SemiBold' }}>All packed — enjoy your trip!</Text>
          </Row>
        ) : null}
      </Card>

      {grouped.map((g) => (
        <View key={g.category} style={{ gap: 8 }}>
          <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 15, color: c.mutedForeground }}>{g.category}</Text>
          <Card style={{ gap: 2 }}>
            {g.items.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => toggle(item.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: item.checked }}
                style={({ pressed }) => [styles.itemRow, { opacity: pressed ? 0.7 : 1 }]}
              >
                <View
                  style={[
                    styles.checkbox,
                    { borderColor: item.checked ? c.primary : c.border, backgroundColor: item.checked ? c.primary : 'transparent' },
                  ]}
                >
                  {item.checked ? <Feather name="check" size={13} color={c.primaryForeground} /> : null}
                </View>
                <Text
                  style={{
                    flex: 1,
                    fontSize: 14.5,
                    color: item.checked ? c.mutedForeground : c.foreground,
                    textDecorationLine: item.checked ? 'line-through' : 'none',
                    fontFamily: 'Inter_400Regular',
                  }}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </Card>
        </View>
      ))}

      <PrimaryButton title="Reset list" icon="rotate-ccw" variant="outline" onPress={reset} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  barBg: { height: 8, borderRadius: 4, overflow: 'hidden' },
  bar: { height: 8, borderRadius: 4 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
  checkbox: { width: 22, height: 22, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
