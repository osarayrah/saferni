import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import type { TripMapProps } from './TripMap.types';

// react-native-maps is native-only; on web we render a schematic fallback.
export default function TripMap({ markers, kindIcon, onMarkerPress }: TripMapProps) {
  const c = useColors();
  const lats = markers.map((x) => x.latitude);
  const lngs = markers.map((x) => x.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: c.accent }]}>
      {markers.map((m) => {
        const x = maxLng === minLng ? 0.5 : (m.longitude - minLng) / (maxLng - minLng);
        const y = maxLat === minLat ? 0.5 : 1 - (m.latitude - minLat) / (maxLat - minLat);
        return (
          <Pressable
            key={m.id}
            onPress={() => onMarkerPress(m)}
            accessibilityRole="button"
            accessibilityLabel={`Open ${m.title} in maps`}
            style={[
              styles.pin,
              {
                left: `${8 + x * 78}%`,
                top: `${10 + y * 72}%`,
                backgroundColor: m.kind === 'hotel' ? c.secondary : c.primary,
              },
            ]}
          >
            <Feather name={kindIcon[m.kind]} size={13} color="#FFFFFF" />
          </Pressable>
        );
      })}
      <Text style={{ position: 'absolute', bottom: 8, right: 12, fontSize: 10, color: c.accentForeground }}>
        Interactive map available on iOS & Android — tap a pin to open in Maps
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pin: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
});
