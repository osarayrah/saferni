import React from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import colors from '@/constants/colors';
import { useColors } from '@/hooks/useColors';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';

const R = colors.radius;

export function PrimaryButton({
  title,
  onPress,
  icon,
  loading,
  disabled,
  variant = 'primary',
  style,
}: {
  title: string;
  onPress: () => void;
  icon?: keyof typeof Feather.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'outline' | 'destructive';
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const bg =
    variant === 'primary' ? c.primary
    : variant === 'secondary' ? c.secondary
    : variant === 'destructive' ? c.destructive
    : 'transparent';
  const fg =
    variant === 'primary' ? c.primaryForeground
    : variant === 'secondary' ? c.secondaryForeground
    : variant === 'destructive' ? c.destructiveForeground
    : c.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled || loading}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress();
      }}
      style={({ pressed }) => [
         styles.btn,
        {
          backgroundColor: bg,
          borderColor: variant === 'outline' ? c.primary : 'transparent',
          borderWidth: variant === 'outline' ? 1.5 : 0,
           opacity: disabled ? 0.45 : pressed ? 0.84 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Feather name={icon} size={18} color={fg} /> : null}
          <Text style={[styles.btnText, { color: fg }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

export function Chip({
  label,
  onPress,
  selected,
  small,
  disabled,
}: {
  label: string;
  onPress?: () => void;
  selected?: boolean;
  small?: boolean;
  disabled?: boolean;
}) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected, disabled: !!disabled }}
      onPress={onPress}
      disabled={!onPress || disabled}
      style={({ pressed }) => [
        styles.chip,
        small && { paddingVertical: 8, paddingHorizontal: 10 },
        {
          backgroundColor: selected ? c.primary : c.accent,
          opacity: disabled ? 0.4 : pressed ? 0.8 : 1,
        },
      ]}
    >
      <Text
        style={{
          color: selected ? c.primaryForeground : c.accentForeground,
          fontFamily: 'Inter_500Medium',
          fontSize: small ? 12 : 13,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function SourceBadge({ sourceType }: { sourceType: string }) {
  const c = useColors();
  const isMock = sourceType === 'mock' || sourceType === 'demo';
  const isAi = sourceType === 'ai';
  const bg = isMock ? c.warning + '22' : c.success + '22';
  const fg = isMock ? c.warning : c.success;
  const icon: React.ComponentProps<typeof Feather>['name'] = isMock ? 'info' : isAi ? 'cpu' : 'zap';
  const label = isMock ? 'Demo data' : isAi ? 'AI' : sourceType === 'estimated' ? 'Estimate' : 'Live';
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Feather name={icon} size={11} color={fg} />
      <Text style={{ color: fg, fontSize: 11, fontFamily: 'Inter_600SemiBold' }}>{label}</Text>
    </View>
  );
}

// pics.avs.io (Travelpayouts/Aviasales) — free, no API key, documented for
// exactly this use case. Not every airline has a logo there (confirmed live:
// some unknown codes 404, some silently return a generic placeholder image),
// so this fails soft — on a load error it renders nothing and the airline
// name text already shown alongside it carries the identification instead.
// A fixed light backing (not theme-driven) frames the logo regardless of
// app theme — several real airline marks (e.g. Qatar's maroon square) are
// dark, solid-color assets that read poorly directly on a dark card.
export function AirlineLogo({ iataCode, size = 28 }: { iataCode?: string; size?: number }) {
  const [failed, setFailed] = React.useState(false);
  if (!iataCode || failed) return null;
  const px = size * 3; // 3x for retina clarity
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 6,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.08)',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <Image
        source={{ uri: `https://pics.avs.io/${px}/${px}/${iataCode}.png` }}
        style={{ width: size - 4, height: size - 4 }}
        contentFit="contain"
        onError={() => setFailed(true)}
        accessibilityLabel={`${iataCode} logo`}
      />
    </View>
  );
}

export function DemoBanner() {
  const c = useColors();
  return (
    <View style={[styles.demoBanner, { backgroundColor: c.accent, borderColor: c.border }]}>
      <Feather name="info" size={13} color={c.accentForeground} />
      <Text style={{ color: c.accentForeground, fontSize: 12, fontFamily: 'Inter_500Medium', flex: 1 }}>
        Demo mode — travel results are sample data, not live prices.
      </Text>
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return (
    <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }, style]}>
      {children}
    </View>
  );
}

export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const c = useColors();
  return (
    <View style={styles.sectionRow}>
      <Text style={{ fontSize: 19, fontFamily: 'Georgia', color: c.foreground, letterSpacing: -0.2 }}>{title}</Text>
      {action ? (
        <Pressable onPress={onAction} accessibilityRole="button">
          <Text style={{ color: c.primary, fontFamily: 'Inter_600SemiBold', fontSize: 14 }}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  message,
  actionLabel,
  onAction,
}: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const c = useColors();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: c.accent }]}>
        <Feather name={icon} size={26} color={c.primary} />
      </View>
      <Text style={{ fontSize: 17, fontFamily: 'Inter_600SemiBold', color: c.foreground }}>{title}</Text>
      <Text style={{ fontSize: 14, color: c.mutedForeground, textAlign: 'center', lineHeight: 20 }}>{message}</Text>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          onPress={onAction}
          style={({ pressed }) => [
            styles.emptyAction,
            { backgroundColor: c.primary, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={{ color: c.primaryForeground, fontFamily: 'Inter_600SemiBold', fontSize: 14 }}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Segmented({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  const c = useColors();
  return (
    <View style={[styles.segmented, { backgroundColor: c.muted }]}>
      {options.map((o) => (
        <Pressable
          key={o}
          accessibilityRole="button"
          onPress={() => onChange(o)}
          style={[
            styles.segment,
            value === o && { backgroundColor: c.card, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
          ]}
        >
          <Text
            style={{
              fontFamily: value === o ? 'Inter_600SemiBold' : 'Inter_500Medium',
              fontSize: 13,
              color: value === o ? c.foreground : c.mutedForeground,
            }}
          >
            {o}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export function Row({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 8 }, style]}>{children}</View>;
}

// Fades its content in on mount — give it a `key` that changes when the
// content being shown changes (a status, a stage index, an item id) so
// swaps crossfade in instead of popping instantly.
export function FadeIn({
  children,
  style,
  duration = 220,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  duration?: number;
}) {
  const opacity = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration, useNativeDriver: true }).start();
  }, [opacity, duration]);
  return <Animated.View style={[{ opacity }, style]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 52,
    paddingVertical: 13,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  btnText: { fontSize: 14, fontFamily: 'Inter_700Bold', letterSpacing: 0.1 },
  chip: {
    minHeight: 36,
    paddingVertical: 8,
    paddingHorizontal: 13,
    borderRadius: 10,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 7,
    alignSelf: 'flex-start',
  },
  demoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 11,
    paddingHorizontal: 13,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  card: {
    borderRadius: R,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 17,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  empty: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 52,
    paddingHorizontal: 32,
  },
  emptyAction: {
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 999,
  },
  emptyIcon: {
    width: 62,
    height: 62,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  segmented: {
    flexDirection: 'row',
    borderRadius: 11,
    padding: 4,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    minHeight: 40,
    paddingVertical: 10,
    borderRadius: 8,
  },
});
