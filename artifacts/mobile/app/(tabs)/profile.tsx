import React, { useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card, Chip, DemoBanner, PrimaryButton, Row, SectionTitle } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { useAuth, useUser } from '@clerk/expo';
import { useApp } from '@/store/AppContext';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useI18n } from '@/services/i18n';

const STYLES = ['Budget', 'Balanced', 'Comfort', 'Luxury', 'Adventure', 'Relaxation', 'Culture', 'Family', 'Food', 'Nightlife'];
const CURRENCIES = ['USD', 'EUR', 'CAD', 'GBP', 'JOD', 'AED', 'SAR'];

export default function ProfileScreen() {
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, updateProfile, syncStatus, language, setLanguage } = useApp();
  const { t } = useI18n(language);
  const { user, isLoaded } = useUser();
  const { isSignedIn, signOut } = useAuth();
  const [name, setName] = useState<string>(profile.firstName);
  const [city, setCity] = useState<string>(profile.homeCity);
  const [airport, setAirport] = useState<string>(profile.homeAirport);

  const toggleStyle = (s: string) => {
    const list = profile.travelStyles.includes(s)
      ? profile.travelStyles.filter((x) => x !== s)
      : [...profile.travelStyles, s];
    updateProfile({ travelStyles: list });
  };

  const saveBasics = () => {
    updateProfile({
      firstName: name.trim(),
      homeCity: city.trim() || 'Amman',
      homeAirport: (airport.trim() || 'AMM').toUpperCase().slice(0, 3),
    });
    Alert.alert('Saved', 'Your preferences were updated.');
  };

  const resetOnboarding = () => {
    updateProfile({ onboarded: false });
    router.push('/onboarding');
  };

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
       <Text style={{ fontFamily: 'Georgia', fontSize: 32, color: c.foreground, letterSpacing: -0.5 }}>{t('Profile')}</Text>

      <DemoBanner />

      <Card>
        <Row style={{ gap: 12 }}>
          <View style={[styles.avatar, { backgroundColor: c.accent }]}>
            <Feather name="user" size={24} color={c.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 17, color: c.foreground }}>
               {profile.firstName || user?.firstName || 'Safferni traveller'}
            </Text>
            <Text style={{ color: c.mutedForeground, fontSize: 13 }}>
               {isSignedIn
                ? syncStatus === 'syncing'
                  ? 'Syncing your trips…'
                  : syncStatus === 'error'
                    ? 'Signed in — sync unavailable right now'
                    : 'Signed in — trips sync across your devices'
                : 'Sign in to sync trips across your devices'}
            </Text>
          </View>
        </Row>
      </Card>

      <View style={{ gap: 12 }}>
         <SectionTitle title={t('Account')} />
        <Card style={{ gap: 10 }}>
           {isSignedIn ? (
            <>
              <Text style={{ color: c.foreground, fontSize: 14, fontFamily: 'Inter_600SemiBold' }}>
                 {user?.primaryEmailAddress?.emailAddress || user?.firstName || 'Signed in'}
              </Text>
              <Text style={{ color: c.mutedForeground, fontSize: 12, lineHeight: 18 }}>
                Your trips and preferences are backed up and synced across devices.
              </Text>
               <PrimaryButton title="Log out" icon="log-out" variant="outline" onPress={() => void signOut()} />
            </>
          ) : (
            <>
              <Text style={{ color: c.mutedForeground, fontSize: 12, lineHeight: 18 }}>
                Log in to back up your trips and preferences and sync them across devices.
              </Text>
              <PrimaryButton
                 title={isLoaded ? 'Log in' : 'Checking…'}
                icon="log-in"
                onPress={() => {}}
                disabled
              />
            </>
          )}
        </Card>
      </View>

      <View style={{ gap: 12 }}>
         <SectionTitle title={t('Bookings')} />
        <Card style={{ gap: 10 }}>
          <Text style={{ color: c.mutedForeground, fontSize: 12, lineHeight: 18 }}>
            Trips you've paid for, with their confirmation status.
          </Text>
           <PrimaryButton title={t('My bookings')} icon="briefcase" variant="outline" onPress={() => router.push('/bookings')} />
        </Card>
      </View>

      <View style={{ gap: 12 }}>
         <SectionTitle title={t('Your details')} />
        <Card style={{ gap: 12 }}>
           <Field label={t('First name')} value={name} onChangeText={setName} placeholder="e.g. Omar" />
           <Field label={t('Home city')} value={city} onChangeText={setCity} placeholder="e.g. Amman" />
           <Field label={t('Home airport (IATA)')} value={airport} onChangeText={setAirport} placeholder="e.g. AMM" autoCapitalize="characters" />
           <PrimaryButton title={t('Save')} icon="check" onPress={saveBasics} />
        </Card>
      </View>

      <View style={{ gap: 12 }}>
         <SectionTitle title={t('Currency')} />
        <Row style={{ flexWrap: 'wrap', gap: 8 }}>
          {CURRENCIES.map((cur) => (
            <Chip key={cur} label={cur} selected={profile.currency === cur} onPress={() => updateProfile({ currency: cur })} />
          ))}
        </Row>
      </View>

      <View style={{ gap: 12 }}>
         <SectionTitle title={t('Travel style')} />
        <Row style={{ flexWrap: 'wrap', gap: 8 }}>
          {STYLES.map((s) => (
            <Chip key={s} label={s} selected={profile.travelStyles.includes(s)} onPress={() => toggleStyle(s)} />
          ))}
        </Row>
      </View>

      <View style={{ gap: 10 }}>
         <SectionTitle title={t('Language')} />
         <Row style={{ gap: 8 }}>
           <Chip label={t('English')} selected={language === 'en'} onPress={() => setLanguage('en')} />
           <Chip label={t('Arabic')} selected={language === 'ar'} onPress={() => setLanguage('ar')} />
         </Row>
         <PrimaryButton title={t('Redo onboarding')} icon="rotate-ccw" variant="outline" onPress={resetOnboarding} />
        <Text style={{ color: c.mutedForeground, fontSize: 12, lineHeight: 18 }}>
           Visa or entry information shown anywhere in the app is general guidance — always verify with official government sources.
        </Text>
      </View>
    </ScrollView>
  );
}

function Field({
  label,
  ...props
}: { label: string } & React.ComponentProps<typeof TextInput>) {
  const c = useColors();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: c.mutedForeground }}>{label}</Text>
      <TextInput
        {...props}
        placeholderTextColor={c.mutedForeground}
        style={[styles.input, { borderColor: c.border, color: c.foreground, backgroundColor: c.background }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { width: 52, height: 52, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
  },
});
