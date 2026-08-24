import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { DEST_IMAGES } from '@/components/travel';
import { Card, Chip, EmptyState, PrimaryButton, Row } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { DESTINATIONS } from '@/services/mockData';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';

export default function DestinationScreen() {
  const c = useColors();
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code: string }>();
  const dest = DESTINATIONS.find((d) => d.code === code);

  if (!dest) {
    return (
      <View style={{ flex: 1, backgroundColor: c.background, justifyContent: 'center' }}>
        <EmptyState icon="map-pin" title="Destination not found" message="Try browsing destinations from the Home tab." />
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.background }} contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 60 }}>
      <Image source={DEST_IMAGES[dest.image]} style={{ width: '100%', height: 200, borderRadius: 16 }} contentFit="cover" transition={200} />

      <View style={{ gap: 4 }}>
        <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 24, color: c.foreground }}>
          {dest.city}, {dest.country}
        </Text>
        <Text style={{ color: c.mutedForeground, fontSize: 14, lineHeight: 21 }}>{dest.description}</Text>
      </View>

      <Row style={{ flexWrap: 'wrap', gap: 8 }}>
        {dest.tags.map((t) => (
          <Chip key={t} small label={t} />
        ))}
      </Row>

      <Card style={{ gap: 8 }}>
        <InfoRow icon="calendar" label="Best time to visit" value={dest.bestMonths} />
        <InfoRow icon="dollar-sign" label="Typical budget" value={dest.budgetRange} />
        <InfoRow icon="clock" label="Suggested length" value={`${dest.suggestedNights} nights`} />
        <InfoRow icon="send" label="Airport" value={dest.code} />
      </Card>

      <PrimaryButton
        title={`Plan a trip to ${dest.city}`}
        icon="send"
        onPress={() => router.push({ pathname: '/plan', params: { mode: 'packages', q: `Plan a ${dest.suggestedNights}-day trip to ${dest.city}` } })}
      />
    </ScrollView>
  );
}

function InfoRow({ icon, label, value }: { icon: keyof typeof Feather.glyphMap; label: string; value: string }) {
  const c = useColors();
  return (
    <Row style={{ justifyContent: 'space-between' }}>
      <Row style={{ gap: 8 }}>
        <Feather name={icon} size={14} color={c.primary} />
        <Text style={{ color: c.mutedForeground, fontSize: 13 }}>{label}</Text>
      </Row>
      <Text style={{ color: c.foreground, fontSize: 13, fontFamily: 'Inter_500Medium' }}>{value}</Text>
    </Row>
  );
}
