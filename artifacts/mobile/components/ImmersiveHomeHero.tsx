import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { Row } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import type { Trip } from '@/types/travel';

const heroImage = require('../assets/images/safferni-immersive-hero.jpg');

export function ImmersiveHomeHero({
  greeting,
  trip,
  onPlan,
  onSearch,
  onProfile,
  onOpenTrips,
}: {
  greeting?: string;
  trip?: Trip;
  onPlan: () => void;
  onSearch: () => void;
  onProfile: () => void;
  onOpenTrips: () => void;
}) {
  const c = useColors();
  const destination = trip?.destinationName ?? 'somewhere unforgettable';
  const date = trip ? new Date(trip.departureDate).toLocaleDateString(undefined, { day: '2-digit', month: 'short' }) : 'Next chapter';

  return (
    <View style={styles.hero}>
      <Image source={heroImage} style={StyleSheet.absoluteFill} contentFit="cover" transition={350} />
      <View style={[StyleSheet.absoluteFill, styles.overlay]} />
      <View style={styles.content}>
        <Row style={styles.header}>
          <Row style={{ gap: 8 }}>
            <Image source={require('../assets/images/safferni-logo-symbol.png')} contentFit="contain" style={styles.brandLogo} accessibilityLabel="Safferni logo" />
            <Text style={styles.brand}>safferni</Text>
          </Row>
          <Row style={{ gap: 8 }}>
            <IconButton icon="search" label="Search travel" onPress={onSearch} />
            <IconButton icon="user" label="Open profile" onPress={onProfile} />
          </Row>
        </Row>

        <Text style={[styles.kicker, { color: c.primary }]}>YOUR TRAVEL COMPANION</Text>
        <View style={styles.orbit} pointerEvents="none">
          <View style={[styles.orbitRing, styles.orbitOuter, { borderColor: c.primary + '66' }]} />
          <View style={[styles.orbitRing, styles.orbitMiddle, { borderColor: c.primary + '44' }]} />
          <View style={[styles.orbitDot, { backgroundColor: c.primary }]} />
        </View>
        <Text style={styles.title}>Where next{greeting ? `, ${greeting}` : ''}{'\n'}feels right?</Text>
        <Text style={styles.subtitle}>A quieter way to plan the places you have been thinking about.</Text>
        <View style={styles.routeChip}>
          <Feather name="map-pin" size={12} color={c.primary} />
          <Text style={styles.routeText}>{trip ? `${trip.origin}  →  ${trip.destinationCode}` : 'Tell us what you want to remember'}</Text>
        </View>

        <View style={styles.footer}>
          <View>
            <Text style={styles.localLabel}>{trip ? 'DEPARTURE' : 'READY WHEN YOU ARE'}</Text>
            <Text style={styles.localValue}>{trip ? date : 'Start exploring'}</Text>
          </View>
          <Pressable
            onPress={onPlan}
            accessibilityRole="button"
            accessibilityLabel="Start a new travel plan"
            style={({ pressed }) => [styles.planButton, { backgroundColor: c.primary, opacity: pressed ? 0.86 : 1 }]}
          >
            <Text style={{ color: c.primaryForeground, fontFamily: 'Inter_700Bold', fontSize: 11 }}>Start a new plan</Text>
            <Feather name="arrow-up-right" size={15} color={c.primaryForeground} />
          </Pressable>
        </View>
        <Pressable onPress={trip ? onOpenTrips : onPlan} accessibilityRole="button" style={styles.scrollCue}>
          <Feather name="arrow-down" size={13} color={c.primary} />
          <Text style={styles.scrollText}>{trip ? `UPCOMING · ${destination.toUpperCase()}` : 'CURATED JOURNEYS'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function IconButton({ icon, label, onPress }: { icon: keyof typeof Feather.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={styles.iconButton}>
      <Feather name={icon} size={16} color="#F7F0E1" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: { height: 470, overflow: 'hidden', borderRadius: 26, backgroundColor: '#FFFFFF' },
  overlay: { backgroundColor: 'rgba(18, 49, 94, .36)' },
  content: { flex: 1, padding: 18, justifyContent: 'space-between' },
  header: { justifyContent: 'space-between', alignItems: 'center' },
  brandLogo: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#FFFFFF' },
  brand: { color: '#FFFFFF', fontFamily: 'Georgia', fontSize: 20, letterSpacing: -0.8 },
  iconButton: { width: 34, height: 34, borderWidth: 1, borderColor: '#FFFFFF66', borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#12315E55' },
  kicker: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 2.1, marginTop: 30 },
  title: { color: '#F8F1E3', fontFamily: 'Georgia', fontSize: 44, lineHeight: 40, letterSpacing: -1.9, marginTop: 6 },
  subtitle: { color: '#F8F1E3B8', fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, maxWidth: 250, marginTop: 14 },
  routeChip: { flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start', borderWidth: 1, borderColor: '#F8F1E338', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 7, marginTop: 17, backgroundColor: '#0c1d3a55' },
  routeText: { color: '#F8F1E3C7', fontFamily: 'Inter_600SemiBold', fontSize: 9, letterSpacing: 0.5 },
  footer: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginTop: 20 },
  localLabel: { color: '#F8F1E394', fontFamily: 'Inter_600SemiBold', fontSize: 9, letterSpacing: 1.1 },
  localValue: { color: '#F8F1E3', fontFamily: 'Georgia', fontSize: 19, marginTop: 2 },
  planButton: { minHeight: 48, borderRadius: 11, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 8 },
  scrollCue: { flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start', marginTop: 16 },
  scrollText: { color: '#F8F1E380', fontFamily: 'Inter_700Bold', fontSize: 8, letterSpacing: 1.4 },
  orbit: { position: 'absolute', right: 18, top: 125, width: 135, height: 110 },
  orbitRing: { position: 'absolute', borderWidth: 1, borderRadius: 100 },
  orbitOuter: { width: 132, height: 76, top: 16, transform: [{ rotate: '-13deg' }] },
  orbitMiddle: { width: 105, height: 60, top: 24, left: 14, transform: [{ rotate: '-13deg' }] },
  orbitDot: { position: 'absolute', width: 6, height: 6, borderRadius: 3, top: 11, right: 35 },
});