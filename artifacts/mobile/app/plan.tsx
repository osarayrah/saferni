import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useHeaderHeight } from '@react-navigation/elements';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Chip, Row, SourceBadge } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { uid } from '@/services/mockData';
import { emptyDraft, ensureDates, type SearchMode, type SearchResults } from '@/services/planner';
import { plannerChat, ApiError } from '@workspace/api-client-react';
import { useApp } from '@/store/AppContext';
import type { ChatMessage, TripDraft } from '@/types/travel';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { clearPlannerDraft, loadPlannerDraft, savePlannerDraft } from '@/services/plannerDraft';

const VALID_MODES: SearchMode[] = ['flights', 'hotels', 'packages', 'general'];

const MODE_GREETING: Record<SearchMode, string> = {
  flights: "Hi{name}! I'm Safferni Assistant. Let's find your flight — where are you headed, and when?",
  hotels: "Hi{name}! I'm Safferni Assistant. Let's find your stay — where are you headed, and when?",
  packages: "Hi{name}! I'm Safferni Assistant. Where would you like Safferni to take you?",
  general: "Hi{name}! I'm Safferni Assistant. Where would you like Safferni to take you?",
};

export default function PlanScreen() {
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // KeyboardAvoidingView measures its own frame relative to its parent, not
  // the screen — under this stack screen's native header that leaves a
  // gap exactly the header's height, so the keyboard offset undershoots by
  // that much unless it's told about it explicitly.
  const headerHeight = useHeaderHeight();
  const { q, mode: modeParam } = useLocalSearchParams<{ q?: string; mode?: string }>();
  const mode: SearchMode = VALID_MODES.includes(modeParam as SearchMode) ? (modeParam as SearchMode) : 'packages';
  const { profile, setSearch } = useApp();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState<string>('');
  const [typing, setTyping] = useState<boolean>(false);
  const draftRef = useRef<TripDraft>(emptyDraft(profile.homeAirport, profile.currency, profile.travelStyles.map((s) => s.toLowerCase())));
  const startedRef = useRef<boolean>(false);
  const modeRef = useRef<SearchMode>(mode);

  const historyRef = useRef<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const hydratedRef = useRef<boolean>(false);

  // Update messages and persist the full snapshot (messages + history + draft)
  // from the same state transition, so leaving the screen mid-conversation
  // never loses the latest turn. Writes are serialized inside savePlannerDraft.
  const commitMessages = useCallback((updater: (prev: ChatMessage[]) => ChatMessage[]) => {
    setMessages((prev) => {
      const next = updater(prev);
      if (hydratedRef.current) {
        savePlannerDraft({ messages: next, history: historyRef.current, draft: draftRef.current, mode: modeRef.current });
      }
      return next;
    });
  }, []);

  const pushAssistant = useCallback(
    (msg: Omit<ChatMessage, 'id' | 'role'>) => {
      commitMessages((prev) => [{ id: uid('m'), role: 'assistant', ...msg }, ...prev]);
    },
    [commitMessages],
  );

  const handleUserText = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      historyRef.current = [...historyRef.current, { role: 'user', content: trimmed }];
      commitMessages((prev) => [{ id: uid('m'), role: 'user', content: trimmed }, ...prev]);
      setInput('');
      setTyping(true);
      try {
        const res = await plannerChat({
          messages: historyRef.current,
          draft: draftRef.current,
          mode: modeRef.current,
        });
        draftRef.current = res.draft as TripDraft;
        historyRef.current = [...historyRef.current, { role: 'assistant', content: res.reply }];
        pushAssistant({
          content: res.reply,
          kind: res.readyToSearch ? 'summary' : 'question',
          quickReplies: res.quickReplies.length ? res.quickReplies : undefined,
          showSearchButton: res.readyToSearch,
          sourceType: (res.source ?? 'demo') as 'ai' | 'demo',
        });
      } catch (err) {
        // Surface the server's own message (e.g. "The AI planner isn't
        // configured yet") — fall back to the generic copy only for true
        // network failures where no response body exists.
        const serverMessage =
          err instanceof ApiError && typeof (err.data as { message?: unknown } | null)?.message === 'string'
            ? ((err.data as { message: string }).message)
            : undefined;
        pushAssistant({
          content: serverMessage ?? "I couldn't reach the trip planner just now. Please try sending that again.",
        });
      } finally {
        setTyping(false);
      }
    },
    [commitMessages, pushAssistant],
  );

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    modeRef.current = mode;
    // A fresh query param (or an explicit mode bubble) means the user is
    // starting a new request — don't restore an old conversation over it.
    const startingFresh = (typeof q === 'string' && q) || (typeof modeParam === 'string' && modeParam);

    (async () => {
      const restored = startingFresh ? null : await loadPlannerDraft();
      if (restored) {
        draftRef.current = restored.draft ?? draftRef.current;
        historyRef.current = restored.history;
        modeRef.current = restored.mode ?? modeRef.current;
        setMessages(restored.messages);
      } else {
        if (startingFresh) {
          draftRef.current = emptyDraft(profile.homeAirport, profile.currency, profile.travelStyles.map((s) => s.toLowerCase()));
          historyRef.current = [];
          clearPlannerDraft();
        }
        const name = profile.firstName ? ` ${profile.firstName}` : '';
        setMessages([{ id: uid('m'), role: 'assistant', content: MODE_GREETING[mode].replace('{name}', name) }]);
        if (typeof q === 'string' && q) {
          setTimeout(() => handleUserText(q), 300);
        }
      }
      hydratedRef.current = true;
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSearch = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    // Search kicked off — the draft conversation is complete, so clear it.
    hydratedRef.current = false;
    clearPlannerDraft();
    const draft = ensureDates(draftRef.current);
    const activeMode = modeRef.current;
    // Seed a streaming search: the results screen fires flight and hotel
    // requests independently and fills these in as each one finishes. A
    // flights/hotels-only mode marks the other category as already "done"
    // (with no offers) so it never runs and no package is assembled.
    const results: SearchResults = {
      draft,
      flights: [],
      hotels: [],
      activities: [], // live data only — no demo activity listings
      packages: [],
      flightsStatus: activeMode === 'hotels' ? 'done' : 'loading',
      hotelsStatus: activeMode === 'flights' ? 'done' : 'loading',
      mode: activeMode,
    };
    setSearch(results);
    pushAssistant({
      content: `Searching live prices for ${draft.destinationName}… A first-time search can take up to 30 seconds — opening the results so you can watch them come in.`,
    });
    router.push('/results');
  }, [pushAssistant, router, setSearch]);

  const renderItem = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';
    return (
        <View style={{ paddingHorizontal: 16, marginVertical: 6 }}>
        <View
          style={[
            styles.bubble,
            isUser
              ? { backgroundColor: c.primary, alignSelf: 'flex-end', borderBottomRightRadius: 4 }
              : { backgroundColor: c.card, alignSelf: 'flex-start', borderBottomLeftRadius: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border },
          ]}
        >
          <Text style={{ color: isUser ? c.primaryForeground : c.foreground, fontSize: 15, lineHeight: 22, fontFamily: isUser ? 'Inter_500Medium' : 'Inter_400Regular' }}>
            {item.content}
          </Text>
          {item.kind === 'summary' ? (
            <View style={{ marginTop: 8 }}>
              <SourceBadge sourceType={item.sourceType ?? 'demo'} />
            </View>
          ) : null}
        </View>
        {item.quickReplies ? (
          <Row style={{ flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
            {item.quickReplies.map((r) => (
              <Chip key={r} small label={r} onPress={() => handleUserText(r)} />
            ))}
          </Row>
        ) : null}
        {item.showSearchButton ? (
          <Pressable
            onPress={onSearch}
            accessibilityRole="button"
            style={({ pressed }) => [styles.searchBtn, { backgroundColor: c.secondary, opacity: pressed ? 0.85 : 1 }]}
          >
            <Feather name="search" size={16} color={c.secondaryForeground} />
            <Text style={{ color: c.secondaryForeground, fontFamily: 'Inter_600SemiBold', fontSize: 15 }}>Search trips</Text>
          </Pressable>
        ) : null}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={headerHeight} style={{ flex: 1, backgroundColor: c.background }}>
      <FlatList
        inverted
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingVertical: 16 }}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          typing ? (
            <View style={{ paddingHorizontal: 16, marginVertical: 6 }}>
          <View style={[styles.bubble, { backgroundColor: c.accent, alignSelf: 'flex-start', borderWidth: StyleSheet.hairlineWidth, borderColor: c.border }]}>
                <Text style={{ color: c.accentForeground, fontSize: 14, fontFamily: 'Inter_500Medium' }}>Safferni is thinking…</Text>
              </View>
            </View>
          ) : null
        }
      />
      <View
        style={[
          styles.inputBar,
          {
            backgroundColor: c.card,
            borderColor: c.border,
            paddingBottom: Platform.OS === 'web' ? 34 : Math.max(insets.bottom, 10),
          },
        ]}
      >
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Describe your trip…"
          placeholderTextColor={c.mutedForeground}
           style={[styles.textInput, { color: c.foreground, backgroundColor: c.background, borderColor: c.border }]}
          multiline
          accessibilityLabel="Message"
        />
        <Pressable
          onPress={() => handleUserText(input)}
          disabled={!input.trim()}
          accessibilityRole="button"
          accessibilityLabel="Send"
          style={({ pressed }) => [
            styles.sendBtn,
            { backgroundColor: input.trim() ? c.primary : c.muted, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Feather name="arrow-up" size={20} color={input.trim() ? c.primaryForeground : c.mutedForeground} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  bubble: {
    maxWidth: '88%',
    borderRadius: 16,
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  searchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
    paddingVertical: 13,
    borderRadius: 11,
    alignSelf: 'stretch',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 110,
    minHeight: 44,
    fontFamily: 'Inter_400Regular',
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
