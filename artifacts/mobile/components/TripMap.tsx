import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker as MapMarker } from 'react-native-maps';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import type { TripMapProps } from './TripMap.types';

export default function TripMap({ markers, kindIcon, onMarkerPress }: TripMapProps) {
  const c = useColors();
  const mapRef = useRef<MapView>(null);

  const initialRegion = useMemo(() => {
    if (markers.length === 0) {
      return { latitude: 0, longitude: 0, latitudeDelta: 40, longitudeDelta: 40 };
    }
    const lats = markers.map((m) => m.latitude);
    const lngs = markers.map((m) => m.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max((maxLat - minLat) * 1.6, 0.03),
      longitudeDelta: Math.max((maxLng - minLng) * 1.6, 0.03),
    };
    // Fit only on first render; day-filter changes are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapRef.current || markers.length === 0) return;
    mapRef.current.fitToCoordinates(
      markers.map((m) => ({ latitude: m.latitude, longitude: m.longitude })),
      { edgePadding: { top: 60, right: 60, bottom: 60, left: 60 }, animated: true },
    );
  }, [markers]);

  return (
    <MapView ref={mapRef} style={StyleSheet.absoluteFill} initialRegion={initialRegion}>
      {markers.map((m) => (
        <MapMarker
          key={m.id}
          coordinate={{ latitude: m.latitude, longitude: m.longitude }}
          title={m.title}
          description={m.subtitle}
          onCalloutPress={() => onMarkerPress(m)}
        >
          <View style={[styles.pin, { backgroundColor: m.kind === 'hotel' ? c.secondary : c.primary }]}>
            <Feather name={kindIcon[m.kind]} size={13} color="#FFFFFF" />
          </View>
        </MapMarker>
      ))}
    </MapView>
  );
}

const styles = StyleSheet.create({
  pin: {
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
