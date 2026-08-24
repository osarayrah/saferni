import React, { useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Chip, PrimaryButton, Row } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/store/AppContext';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useI18n } from '@/services/i18n';

const STYLES = ['Budget', 'Balanced', 'Comfort', 'Luxury', 'Adventure', 'Relaxation', 'Culture', 'Family', 'Food', 'Nightlife', 'Shopping', 'Nature'];
const CURRENCIES = ['USD', 'EUR', 'CAD', 'GBP', 'JOD', 'AED', 'SAR'];

export default function OnboardingScreen() {
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, updateProfile, language, setLanguage } = useApp();
  const { t } = useI18n(language);

  const [step, setStep] = useState<number>(0);
  const [name, setName] = useState<string>(profile.firstName);
  const [city, setCity] = useState<string>(profile.homeCity);
  const [airport, setAirport] = useState<string>(profile.homeAirport);
  const [currency, setCurrency] = useState<string>(profile.currency);
  const [budget, setBudget] = useState<string>(profile.typicalBudget ? String(profile.typicalBudget) : '');
  const [selStyles, setSelStyles] = useState<string[]>(profile.travelStyles);

  const finish = () => {
    updateProfile({
      firstName: name.trim(),
      homeCity: city.trim() || 'Amman',
      homeAirport: (airport.trim() || 'AMM').toUpperCase().slice(0, 3),
      currency,
      typicalBudget: budget ? parseInt(budget, 10) || undefined : undefined,
      travelStyles: selStyles,
      onboarded: true,
    });
    router.back();
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{
        paddingTop: Platform.OS === 'web' ? 87 : insets.top + 24,
        paddingBottom: Platform.OS === 'web' ? 60 : Math.max(insets.bottom, 24) + 12,
        paddingHorizontal: 24,
        gap: 22,
        flexGrow: 1,
      }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ gap: 8 }}>
        <View style={[styles.logo, { backgroundColor: c.primary }]}>
          <Feather name="send" size={22} color={c.primaryForeground} />
        </View>
        <Text style={{ fontFamily: 'Georgia', fontSize: 34, color: c.foreground, letterSpacing: -0.6 }}>Safferni</Text>
        <Text style={{ color: c.mutedForeground, fontSize: 15 }}>{t('Your AI travel companion. Plan less. Travel more.')}</Text>
        <Row style={{ gap: 8, marginTop: 6 }}>
          <Chip label={t('English')} selected={language === 'en'} onPress={() => setLanguage('en')} />
          <Chip label={t('Arabic')} selected={language === 'ar'} onPress={() => setLanguage('ar')} />
        </Row>
      </View>

      <Row style={{ gap: 6 }}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={[styles.dot, { backgroundColor: i <= step ? c.primary : c.muted }]} />
        ))}
      </Row>

      {step === 0 ? (
        <View style={{ gap: 14 }}>
            <Text style={{ fontFamily: 'Georgia', fontSize: 24, color: c.foreground }}>{t('Tell us about you')}</Text>
           <Field label={t('First name (optional)')} value={name} onChangeText={setName} placeholder="e.g. Omar" />
           <Field label={t('Home city')} value={city} onChangeText={setCity} placeholder="e.g. Amman" />
           <Field label={t('Preferred departure airport')} value={airport} onChangeText={setAirport} placeholder="e.g. AMM" autoCapitalize="characters" />
        </View>
      ) : step === 1 ? (
        <View style={{ gap: 14 }}>
            <Text style={{ fontFamily: 'Georgia', fontSize: 24, color: c.foreground }}>{t('Money matters')}</Text>
           <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: c.mutedForeground }}>{t('Preferred currency')}</Text>
          <Row style={{ flexWrap: 'wrap', gap: 8 }}>
            {CURRENCIES.map((cur) => (
              <Chip key={cur} label={cur} selected={currency === cur} onPress={() => setCurrency(cur)} />
            ))}
          </Row>
           <Field label={t('Typical trip budget (optional)')} value={budget} onChangeText={setBudget} placeholder="e.g. 2000" keyboardType="number-pad" />
        </View>
      ) : (
        <View style={{ gap: 14 }}>
            <Text style={{ fontFamily: 'Georgia', fontSize: 24, color: c.foreground }}>{t('How do you like to travel?')}</Text>
          <Row style={{ flexWrap: 'wrap', gap: 8 }}>
            {STYLES.map((s) => (
              <Chip
                key={s}
                 label={t(s)}
                selected={selStyles.includes(s)}
                onPress={() =>
                  setSelStyles((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))
                }
              />
            ))}
          </Row>
          <Text style={{ color: c.mutedForeground, fontSize: 12, lineHeight: 18 }}>
            Visa information provided by Safferni is general guidance and should always be verified through official
            government sources.
          </Text>
        </View>
      )}

      <View style={{ flex: 1 }} />

      <View style={{ gap: 10 }}>
        <PrimaryButton
           title={t(step < 2 ? 'Continue' : 'Start exploring')}
          icon={step < 2 ? 'arrow-right' : 'check'}
          onPress={() => (step < 2 ? setStep(step + 1) : finish())}
        />
      </View>
    </ScrollView>
  );
}

function Field({ label, ...props }: { label: string } & React.ComponentProps<typeof TextInput>) {
  const c = useColors();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: c.mutedForeground }}>{label}</Text>
      <TextInput
        {...props}
        placeholderTextColor={c.mutedForeground}
        style={[styles.input, { borderColor: c.border, color: c.foreground, backgroundColor: c.card }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  logo: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  dot: { flex: 1, height: 4, borderRadius: 2 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
  },
});
