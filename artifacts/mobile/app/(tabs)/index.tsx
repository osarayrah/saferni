import React, { useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState, SectionTitle } from '@/components/ui';
import { ImmersiveHomeHero } from '@/components/ImmersiveHomeHero';
import { DEST_IMAGES, DestinationCard, TripCard } from '@/components/travel';
import { useColors } from '@/hooks/useColors';
import { DESTINATIONS } from '@/services/mockData';
import { useApp } from '@/store/AppContext';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useI18n } from '@/services/i18n';

type PlanMode = 'flights' | 'hotels' | 'packages' | 'general';

const MODES: { key: PlanMode; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { key: 'flights', label: 'Flights', icon: 'send' },
  { key: 'hotels', label: 'Hotels', icon: 'home' },
  { key: 'packages', label: 'Packages', icon: 'package' },
  { key: 'general', label: 'General', icon: 'message-circle' },
];

// Destination browser sections — folded in from the former standalone Explore
// tab so the search/filter capability isn't lost, just relocated.
const BROWSE_SECTIONS: { title: string; filter: (tags: string[]) => boolean }[] = [
  { title: 'Beach escapes', filter: (t) => t.includes('Beach') },
  { title: 'Culture & history', filter: (t) => t.includes('Culture') || t.includes('History') },
  { title: 'Food destinations', filter: (t) => t.includes('Food') },
  { title: 'Budget friendly', filter: (t) => t.includes('Budget') || t.includes('City break') },
];

export default function HomeScreen() {
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, trips, ready, language } = useApp();
  const { t } = useI18n(language);
  const [browseQuery, setBrowseQuery] = useState<string>('');
  const promptedRef = useRef<boolean>(false);

  // Only auto-prompt onboarding while this screen is actually focused.
  // On a cold start via a deep link (e.g. saferni:///booking/<id>) this screen
  // mounts beneath the target screen; pushing onboarding then would cover it.
  useFocusEffect(
    React.useCallback(() => {
      if (!ready || profile.onboarded || promptedRef.current) return;
      promptedRef.current = true;
      const t = setTimeout(() => router.push('/onboarding'), 400);
      return () => clearTimeout(t);
    }, [ready, profile.onboarded, router]),
  );

  const upcoming = trips.filter((t) => new Date(t.departureDate) >= new Date());
  const greetingName = profile.firstName ? `, ${profile.firstName}` : '';
  const month = new Date().getMonth();
  const seasonal = month >= 4 && month <= 8
    ? DESTINATIONS.filter((d) => d.tags.includes('Beach'))
    : DESTINATIONS.filter((d) => !d.tags.includes('Beach'));

  const openMode = (mode: PlanMode) => router.push({ pathname: '/plan', params: { mode } });
  const startPlanning = (text: string) => {
    if (!text.trim()) return;
    router.push({ pathname: '/plan', params: { mode: 'packages', q: text.trim() } });
  };
  const openDest = (code: string) => router.push({ pathname: '/destination/[code]', params: { code } });

  const browseFiltered = useMemo(() => {
    const q = browseQuery.trim().toLowerCase();
    if (!q) return null;
    return DESTINATIONS.filter(
      (d) =>
        d.city.toLowerCase().includes(q) ||
        d.country.toLowerCase().includes(q) ||
        d.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [browseQuery]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{
        paddingTop: Platform.OS === 'web' ? 87 : insets.top + 16,
        paddingBottom: Platform.OS === 'web' ? 118 : 110,
        paddingHorizontal: 20,
        gap: 20,
      }}
      showsVerticalScrollIndicator={false}
    >
      <ImmersiveHomeHero
        greeting={profile.firstName}
        trip={upcoming[0]}
        onPlan={() => startPlanning('Plan a memorable city escape')}
        onSearch={() => router.push({ pathname: '/plan', params: { mode: 'general' } })}
        onProfile={() => router.push('/profile')}
        onOpenTrips={() => router.push('/trips')}
      />

      <View style={styles.modeGrid}>
        {MODES.map((m) => (
          <Pressable
            key={m.key}
            onPress={() => openMode(m.key)}
            accessibilityRole="button"
            accessibilityLabel={m.label}
            style={({ pressed }) => [
              styles.modeBubble,
              { backgroundColor: c.card, borderColor: c.border, opacity: pressed ? 0.9 : 1 },
            ]}
          >
            <View style={[styles.modeIcon, { backgroundColor: c.accent }]}>
              <Feather name={m.icon} size={20} color={c.primary} />
            </View>
            <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 14, color: c.foreground }}>{t(m.label)}</Text>
          </Pressable>
        ))}
      </View>

      {upcoming.length > 0 ? (
        <View style={{ gap: 12 }}>
          <SectionTitle title="Upcoming trip" action="All trips" onAction={() => router.push('/trips')} />
          <TripCard trip={upcoming[0]} onPress={() => router.push({ pathname: '/trip/[tripId]', params: { tripId: upcoming[0].id } })} />
        </View>
      ) : null}

      <View style={{ gap: 12 }}>
       <SectionTitle title={t('Trending now')} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
          {DESTINATIONS.slice(0, 5).map((d) => (
            <DestinationCard
              key={d.code}
              destination={d}
              onPress={() => startPlanning(`Plan a ${d.suggestedNights}-day trip to ${d.city}`)}
            />
          ))}
        </ScrollView>
      </View>

      <View style={{ gap: 12 }}>
       <SectionTitle title={t('In season')} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
          {seasonal.map((d) => (
            <DestinationCard
              key={d.code}
              destination={d}
              onPress={() => startPlanning(`Plan a ${d.suggestedNights}-day trip to ${d.city}`)}
            />
          ))}
        </ScrollView>
      </View>

      <View style={{ gap: 12 }}>
       <SectionTitle title={t('All destinations')} />
        <View style={[styles.search, { backgroundColor: c.card, borderColor: c.border }]}>
          <Feather name="search" size={17} color={c.mutedForeground} />
          <TextInput
            value={browseQuery}
            onChangeText={setBrowseQuery}
             placeholder={t('Search destinations or vibes…')}
            placeholderTextColor={c.mutedForeground}
            style={{ flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular', color: c.foreground }}
             accessibilityLabel={t('Search destinations')}
          />
        </View>

        {browseFiltered ? (
          browseFiltered.length === 0 ? (
             <EmptyState icon="map" title={t('No matches')} message={t('Try a city, country or vibe like beach, food or culture.')} />
          ) : (
            <View style={{ gap: 12 }}>
              {browseFiltered.map((d) => (
                <DestinationCard key={d.code} destination={d} wide onPress={() => openDest(d.code)} />
              ))}
            </View>
          )
        ) : (
          BROWSE_SECTIONS.map((s) => {
            const items = DESTINATIONS.filter((d) => s.filter(d.tags));
            if (!items.length) return null;
            return (
              <View key={s.title} style={{ gap: 12 }}>
                 <SectionTitle title={t(s.title)} />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                  {items.map((d) => (
                    <DestinationCard key={d.code} destination={d} onPress={() => openDest(d.code)} />
                  ))}
                </ScrollView>
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  modeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  modeBubble: {
    width: '48%',
    minHeight: 108,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 15,
    gap: 12,
  },
  modeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'web' ? 12 : 10,
  },
  eyebrow: {
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    letterSpacing: 1.4,
  },
});
