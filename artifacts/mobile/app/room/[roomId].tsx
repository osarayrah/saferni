import React from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Card, EmptyState, Row, SectionTitle, Chip } from '@/components/ui';
import { money } from '@/components/travel';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/store/AppContext';
import type { HotelOffer } from '@/types/travel';

export default function RoomDetailScreen() {
  const c = useColors();
  const router = useRouter();
  const { roomId, hotelId } = useLocalSearchParams<{ roomId: string; hotelId: string }>();
  const { search, trips, savedOffers } = useApp();
  const hotel = findHotel(hotelId, search?.hotels ?? [], trips.map((trip) => trip.hotel), savedOffers.map((offer) => offer.hotel));
  const room = hotel?.roomOptions?.find((option) => option.id === roomId);

  if (!hotel || !room) {
    return (
      <View style={{ flex: 1, backgroundColor: c.background, justifyContent: 'center' }}>
        <EmptyState icon="home" title="Room option unavailable" message="This room option is no longer available in the current search." />
      </View>
    );
  }

  const images = room.images?.length ? room.images : hotel.images;

  return (
    <>
      <Stack.Screen options={{ title: 'Room details' }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: c.background }}
        contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}
      >
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back to hotel details">
          <Row style={{ gap: 6 }}>
            <Feather name="arrow-left" size={16} color={c.primary} />
            <Text style={{ color: c.primary, fontSize: 13, fontFamily: 'Inter_600SemiBold' }}>
              {hotel.name}
            </Text>
          </Row>
        </Pressable>

        {images.length ? (
          <RoomImageGallery images={images} roomName={room.name} />
        ) : (
          <View style={{ height: 210, borderRadius: 16, backgroundColor: c.muted, justifyContent: 'center', alignItems: 'center' }}>
            <Feather name="image" size={32} color={c.mutedForeground} />
            <Text style={{ color: c.mutedForeground, fontSize: 12, marginTop: 8 }}>Room images unavailable</Text>
          </View>
        )}

        <View style={{ gap: 6 }}>
           <Text style={{ color: c.foreground, fontSize: 26, fontFamily: 'Georgia', letterSpacing: -0.3 }}>{room.name}</Text>
          <Text style={{ color: c.mutedForeground, fontSize: 13 }}>{hotel.name}</Text>
        </View>

        <Card style={{ gap: 12 }}>
          <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ gap: 4 }}>
              <Text style={{ color: c.mutedForeground, fontSize: 12 }}>Total stay</Text>
              <Text style={{ color: c.foreground, fontSize: 22, fontFamily: 'Inter_700Bold' }}>
                {money(room.totalPrice, room.currency)}
              </Text>
            </View>
            {room.refundable !== undefined ? (
              <Chip small label={room.refundable ? 'Refundable' : 'Non-refundable'} />
            ) : null}
          </Row>
          {room.mealPlan ? <DetailRow label="Meal plan" value={room.mealPlan} /> : null}
          {room.roomSizeSquare ? (
            <DetailRow label="Room size" value={`${room.roomSizeSquare} ${room.roomSizeUnit ?? 'm²'}`} />
          ) : null}
          {room.maxOccupancy ? <DetailRow label="Occupancy" value={`Up to ${room.maxOccupancy} guests`} /> : null}
        </Card>

        {room.description ? (
          <Card style={{ gap: 7 }}>
            <SectionTitle title="About this room" />
            <Text style={{ color: c.mutedForeground, fontSize: 14, lineHeight: 21 }}>{room.description}</Text>
          </Card>
        ) : null}

        {room.bedTypes?.length ? (
          <Card style={{ gap: 7 }}>
            <SectionTitle title="Beds" />
            {room.bedTypes.map((bed) => (
              <Row key={bed} style={{ gap: 8 }}>
                <Feather name="moon" size={14} color={c.primary} />
                <Text style={{ color: c.mutedForeground, fontSize: 13 }}>{bed}</Text>
              </Row>
            ))}
          </Card>
        ) : null}

        {room.amenities?.length ? (
          <View style={{ gap: 8 }}>
            <SectionTitle title="Room amenities" />
            <Row style={{ flexWrap: 'wrap', gap: 8 }}>
              {room.amenities.map((amenity) => <Chip key={amenity} small label={amenity} />)}
            </Row>
          </View>
        ) : null}

        <Text style={{ color: c.mutedForeground, fontSize: 12, lineHeight: 18 }}>
          Availability and final terms are confirmed with the travel provider when you proceed to booking.
        </Text>
      </ScrollView>
    </>
  );
}

function findHotel(
  id: string | undefined,
  ...collections: (HotelOffer | undefined)[][]
): HotelOffer | undefined {
  if (!id) return undefined;
  return collections.flat().find((hotel) => hotel?.id === id);
}

function RoomImageGallery({ images, roomName }: { images: string[]; roomName: string }) {
  const c = useColors();
  const { width } = useWindowDimensions();
  const imageWidth = width - 40;
  return (
    <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
      {images.map((uri, index) => (
        <Image
          key={`${uri}_${index}`}
          source={{ uri }}
          style={{ width: imageWidth, height: 210, borderRadius: 16, marginRight: index === images.length - 1 ? 0 : 8 }}
          contentFit="cover"
          accessibilityLabel={`${roomName} image ${index + 1}`}
        />
      ))}
      {images.length > 1 ? (
        <Text style={{ position: 'absolute', right: 12, bottom: 10, color: c.background, backgroundColor: '#00000099', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, fontSize: 11 }}>
          {images.length} photos
        </Text>
      ) : null}
    </ScrollView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  const c = useColors();
  return (
    <Row style={{ justifyContent: 'space-between', gap: 12 }}>
      <Text style={{ color: c.mutedForeground, fontSize: 13 }}>{label}</Text>
      <Text style={{ color: c.foreground, fontSize: 13, fontFamily: 'Inter_600SemiBold', flex: 1, textAlign: 'right' }}>{value}</Text>
    </Row>
  );
}