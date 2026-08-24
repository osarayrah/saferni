import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { configureApiClient } from '@/services/api';
import { AppProvider, useApp } from '@/store/AppContext';
import { useColors } from '@/hooks/useColors';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { Image } from 'expo-image';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import {
  ClerkLoaded,
  ClerkProvider,
  useAuth,
  useSSO,
  useSignIn,
  useSignUp,
} from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

configureApiClient();

WebBrowser.maybeCompleteAuthSession();

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!;
const proxyUrl = process.env.EXPO_PUBLIC_CLERK_PROXY_URL || undefined;

const queryClient = new QueryClient();

function RootLayoutNav() {
  const { language } = useApp();
  const c = useColors();
  return (
    <View style={{ flex: 1, direction: language === 'ar' ? 'rtl' : 'ltr' }}>
      <StatusBar style="dark" backgroundColor={c.background} />
    <Stack screenOptions={{
      headerBackTitle: language === 'ar' ? 'رجوع' : 'Back',
      animation: 'slide_from_right',
      headerStyle: { backgroundColor: c.background },
      headerTintColor: c.foreground,
      headerShadowVisible: false,
      headerTitleStyle: { fontFamily: 'Inter_700Bold', color: c.foreground },
      contentStyle: { backgroundColor: c.background },
    }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="plan" options={{ title: 'Safferni Assistant' }} />
      <Stack.Screen name="results" options={{ title: 'Trip options' }} />
      <Stack.Screen name="flight/[offerId]" options={{ title: 'Flight details' }} />
      <Stack.Screen name="hotel/[offerId]" options={{ title: 'Hotel details' }} />
      <Stack.Screen name="room/[roomId]" options={{ title: 'Room details' }} />
      <Stack.Screen name="trip/[tripId]" options={{ title: 'Your trip' }} />
      <Stack.Screen name="trip-budget" options={{ title: 'Budget' }} />
      <Stack.Screen name="trip-map" options={{ title: 'Trip map' }} />
      <Stack.Screen name="trip-packing" options={{ title: 'Packing list' }} />
      <Stack.Screen name="destination/[code]" options={{ title: 'Destination' }} />
      <Stack.Screen name="booking/new" options={{ title: 'Book trip' }} />
      <Stack.Screen name="booking/[bookingId]" options={{ title: 'Booking' }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false, presentation: 'modal' }} />
    </Stack>
    </View>
  );
}

function AuthenticationGate() {
  const c = useColors();
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: c.background, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: c.mutedForeground, fontFamily: 'Inter_500Medium', fontSize: 14 }}>Checking your account…</Text>
      </View>
    );
  }

  if (!isSignedIn) {
    return <SignInScreen />;
  }

  return <RootLayoutNav />;
}

function SignInScreen() {
  const c = useColors();
  const { signIn, errors: signInErrors, fetchStatus: signInFetchStatus } = useSignIn();
  const { signUp, errors: signUpErrors, fetchStatus: signUpFetchStatus } = useSignUp();
  const { startSSOFlow } = useSSO();
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const isSignUp = mode === 'sign-up';
  const isBusy = isSignUp ? signUpFetchStatus === 'fetching' : signInFetchStatus === 'fetching';
  const needsVerification =
    isSignUp &&
    signUp.status === 'missing_requirements' &&
    signUp.unverifiedFields.includes('email_address') &&
    signUp.missingFields.length === 0;
  const errorMessage = isSignUp
    ? signUpErrors.fields.code?.message || signUpErrors.fields.emailAddress?.message || signUpErrors.fields.password?.message
    : signInErrors.fields.identifier?.message || signInErrors.fields.password?.message || signInErrors.fields.code?.message;

  const finalize = useCallback(async (flow: typeof signIn | typeof signUp) => {
    await flow.finalize({
      navigate: ({ session, decorateUrl }) => {
        if (session?.currentTask) {
          console.log(session.currentTask);
          return;
        }
        const url = decorateUrl('/');
        if (url.startsWith('http')) {
          window.location.href = url;
        }
      },
    });
  }, [signIn, signUp]);

  const submit = useCallback(async () => {
    if (isSignUp) {
      const { error } = await signUp.password({ emailAddress, password });
      if (!error) await signUp.verifications.sendEmailCode();
      return;
    }

    const { error } = await signIn.password({ emailAddress, password });
    if (!error && signIn.status === 'complete') await finalize(signIn);
  }, [emailAddress, finalize, isSignUp, password, signIn, signUp]);

  const verify = useCallback(async () => {
    await signUp.verifications.verifyEmailCode({ code });
    if (signUp.status === 'complete') await finalize(signUp);
  }, [code, finalize, signUp]);

  const signInWithGoogle = useCallback(async () => {
    const { createdSessionId, setActive } = await startSSOFlow({
      strategy: 'oauth_google',
      redirectUrl: AuthSession.makeRedirectUri({ scheme: 'safferni' }),
    });
    if (createdSessionId) {
      await setActive?.({
        session: createdSessionId,
        navigate: ({ session, decorateUrl }) => {
          if (session?.currentTask) {
            console.log(session.currentTask);
            return;
          }
          const url = decorateUrl('/');
          if (url.startsWith('http')) window.location.href = url;
        },
      });
    }
  }, [startSSOFlow]);

  return (
    <View style={{ flex: 1, backgroundColor: c.background, paddingHorizontal: 28, justifyContent: 'center', gap: 18 }}>
      <Image source={require('../assets/images/safferni-logo-symbol.png')} contentFit="contain" style={{ width: 74, height: 74, borderRadius: 18, backgroundColor: '#FFFFFF' }} accessibilityLabel="Safferni logo" />
      <Text style={{ color: c.foreground, fontFamily: 'Georgia', fontSize: 38, letterSpacing: -0.7 }}>{needsVerification ? 'Verify your email' : isSignUp ? 'Create your Safferni account' : 'Welcome to Safferni'}</Text>
      <Text style={{ color: c.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 23 }}>
        {needsVerification ? 'Enter the verification code we sent to your email.' : 'Sign in to plan journeys, save your preferences, and keep your trips available across devices.'}
      </Text>
      {needsVerification ? <TextInput value={code} onChangeText={setCode} keyboardType="numeric" placeholder="Verification code" placeholderTextColor={c.mutedForeground} style={{ minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: c.border, color: c.foreground, paddingHorizontal: 14 }} /> : <><TextInput value={emailAddress} onChangeText={setEmailAddress} autoCapitalize="none" keyboardType="email-address" placeholder="Email address" placeholderTextColor={c.mutedForeground} style={{ minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: c.border, color: c.foreground, paddingHorizontal: 14 }} /><TextInput value={password} onChangeText={setPassword} secureTextEntry placeholder="Password" placeholderTextColor={c.mutedForeground} style={{ minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: c.border, color: c.foreground, paddingHorizontal: 14 }} /></>}
      {errorMessage ? <Text style={{ color: c.destructive, fontFamily: 'Inter_500Medium', fontSize: 13 }}>{errorMessage}</Text> : null}
      <Pressable onPress={needsVerification ? verify : submit} disabled={isBusy || (!needsVerification && (!emailAddress || !password))} accessibilityRole="button" style={{ minHeight: 52, borderRadius: 14, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center', marginTop: 8, opacity: isBusy ? 0.65 : 1 }}>
        <Text style={{ color: c.primaryForeground, fontFamily: 'Inter_700Bold', fontSize: 15 }}>{isBusy ? 'Please wait…' : needsVerification ? 'Verify email' : isSignUp ? 'Create account' : 'Log in'}</Text>
      </Pressable>
      {!needsVerification ? <Pressable onPress={signInWithGoogle} accessibilityRole="button" style={{ minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: c.foreground, fontFamily: 'Inter_700Bold', fontSize: 15 }}>Continue with Google</Text></Pressable> : null}
      <Pressable onPress={() => { setMode(isSignUp ? 'sign-in' : 'sign-up'); setCode(''); }} accessibilityRole="button"><Text style={{ color: c.primary, fontFamily: 'Inter_600SemiBold', fontSize: 14, textAlign: 'center' }}>{isSignUp ? 'Already have an account? Log in' : 'New to Safferni? Create an account'}</Text></Pressable>
      {isSignUp ? <View nativeID="clerk-captcha" /> : null}
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
           <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache} proxyUrl={proxyUrl}>
             <ClerkLoaded>
               <AppProvider>
                 <GestureHandlerRootView>
                   <KeyboardProvider>
                     <AuthenticationGate />
                   </KeyboardProvider>
                 </GestureHandlerRootView>
               </AppProvider>
             </ClerkLoaded>
           </ClerkProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
