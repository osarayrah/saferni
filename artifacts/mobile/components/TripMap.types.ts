import type { Feather } from '@expo/vector-icons';

export type TripMapMarker = {
  id: string;
  title: string;
  subtitle: string;
  latitude: number;
  longitude: number;
  kind: 'hotel' | 'activity' | 'food' | 'flight';
  day?: number;
};

export type TripMapProps = {
  markers: TripMapMarker[];
  kindIcon: Record<TripMapMarker['kind'], keyof typeof Feather.glyphMap>;
  onMarkerPress: (m: TripMapMarker) => void;
};
