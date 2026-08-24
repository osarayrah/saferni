import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { money } from '@/components/travel';
import { Card, DemoBanner, EmptyState, Row } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { OVER_BUDGET_TIPS, budgetLines } from '@/services/planner';
import { useApp } from '@/store/AppContext';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';

export default function BudgetScreen() {
  const c = useColors();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { trips } = useApp();
  const trip = trips.find((t) => t.id === tripId);

  if (!trip) {
    return (
      <View style={{ flex: 1, backgroundColor: c.background, justifyContent: 'center' }}>
        <EmptyState icon="pie-chart" title="Trip not found" message="This trip may have been deleted." />
      </View>
    );
  }

  const lines = budgetLines(trip);
  const total = lines.reduce((s, l) => s + l.amount, 0);
  const travellers = trip.adults + trip.children;
  const nights = Math.max(1, trip.days.length - 1);
  const over = trip.budget ? total - trip.budget : 0;
  const max = Math.max(...lines.map((l) => l.amount));

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.background }} contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 60 }}>
      <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 22, color: c.foreground }}>Trip budget</Text>
      <DemoBanner />

      <Card style={{ gap: 6 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={{ color: c.mutedForeground, fontSize: 14 }}>Estimated total</Text>
          <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 24, color: c.foreground }}>{money(total, trip.currency)}</Text>
        </Row>
        {trip.budget ? (
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={{ color: c.mutedForeground, fontSize: 13 }}>Your budget: {money(trip.budget, trip.currency)}</Text>
            <Text style={{ color: over > 0 ? c.destructive : c.success, fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>
              {over > 0 ? `${money(over, trip.currency)} over` : `${money(-over, trip.currency)} left`}
            </Text>
          </Row>
        ) : null}
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={{ color: c.mutedForeground, fontSize: 13 }}>Per traveller</Text>
          <Text style={{ color: c.foreground, fontSize: 13, fontFamily: 'Inter_500Medium' }}>{money(total / travellers, trip.currency)}</Text>
        </Row>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={{ color: c.mutedForeground, fontSize: 13 }}>Daily average</Text>
          <Text style={{ color: c.foreground, fontSize: 13, fontFamily: 'Inter_500Medium' }}>{money(total / nights, trip.currency)}</Text>
        </Row>
      </Card>

      <Card style={{ gap: 12 }}>
        {lines.map((l) => (
          <View key={l.label} style={{ gap: 5 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Row style={{ gap: 6 }}>
                <Text style={{ color: c.foreground, fontSize: 14, fontFamily: 'Inter_500Medium' }}>{l.label}</Text>
                <Text style={{ color: c.mutedForeground, fontSize: 11 }}>({l.kind})</Text>
              </Row>
              <Text style={{ color: c.foreground, fontSize: 14, fontFamily: 'Inter_600SemiBold' }}>
                {money(l.amount, trip.currency)} · {Math.round((l.amount / total) * 100)}%
              </Text>
            </Row>
            <View style={[styles.barBg, { backgroundColor: c.muted }]}>
              <View style={[styles.bar, { backgroundColor: c.primary, width: `${Math.max(4, (l.amount / max) * 100)}%` }]} />
            </View>
          </View>
        ))}
      </Card>

      {over > 0 ? (
        <Card style={{ gap: 8 }}>
          <Row style={{ gap: 8 }}>
            <Feather name="alert-triangle" size={16} color={c.warning} />
            <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 15, color: c.foreground }}>Over budget — ideas to trim</Text>
          </Row>
          {OVER_BUDGET_TIPS.map((t) => (
            <Row key={t} style={{ gap: 8 }}>
              <Feather name="corner-down-right" size={13} color={c.mutedForeground} />
              <Text style={{ color: c.mutedForeground, fontSize: 13, flex: 1 }}>{t}</Text>
            </Row>
          ))}
          <Text style={{ color: c.mutedForeground, fontSize: 11 }}>
            These are ideas, not guarantees — prices vary by date and availability.
          </Text>
        </Card>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  barBg: { height: 8, borderRadius: 4, overflow: 'hidden' },
  bar: { height: 8, borderRadius: 4 },
});
