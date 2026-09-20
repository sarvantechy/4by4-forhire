import type { ListingResponse, MessageResponse } from '@4by4/api-client';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from '@/components/GradientBackground';

import { apiClient } from '@/services/api';
import { getAccessToken } from '@/services/sessionStore';
import { categoryColor, colors, radius } from '@/theme';

function priceLine(unit: string, amountMinor: number): string {
  return `Rs. ${Math.round(amountMinor / 100).toLocaleString('en-IN')} / ${unit}`;
}

export default function ListingChatScreen() {
  const params = useLocalSearchParams<{ listingId: string; ownerId?: string; title?: string }>();
  const listingId = params.listingId;

  const [currentUserId, setCurrentUserId] = useState('');
  const [listing, setListing] = useState<ListingResponse | null>(null);
  const [messages, setMessages] = useState<MessageResponse[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const listRef = useRef<FlatList<MessageResponse>>(null);

  useEffect(() => {
    let active = true;
    async function bootstrap() {
      const token = await getAccessToken();
      if (!token) {
        if (active) {
          setError('Sign in from Account to message this owner.');
          setLoading(false);
        }
        return;
      }
      try {
        const [me, thread] = await Promise.all([
          apiClient.getCurrentUser(token),
          apiClient.listListingMessages(listingId, token),
        ]);
        if (!active) return;
        setCurrentUserId(me.id);
        setMessages(thread);
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : 'Unable to load this conversation.');
      } finally {
        if (active) setLoading(false);
      }
    }
    bootstrap();
    return () => {
      active = false;
    };
  }, [listingId]);

  useEffect(() => {
    let active = true;
    apiClient.getListing(listingId)
      .then((result) => active && setListing(result))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [listingId]);

  async function send() {
    const body = draft.trim();
    if (!body) return;
    const token = await getAccessToken();
    if (!token) {
      setError('Sign in from Account to message this owner.');
      return;
    }
    setSending(true);
    setError('');
    try {
      const message = await apiClient.sendListingMessage(
        listingId,
        { body, client_message_id: globalThis.crypto.randomUUID() },
        undefined,
        token,
      );
      setMessages((current) => [...current, message]);
      setDraft('');
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to send that message.');
    } finally {
      setSending(false);
    }
  }

  function confirmBlock() {
    if (!params.ownerId) return;
    Alert.alert(
      'Block this user?',
      'They will no longer be able to message you or contact you about listings.',
      [
        { style: 'cancel', text: 'Cancel' },
        {
          onPress: async () => {
            const token = await getAccessToken();
            if (!token) return;
            try {
              await apiClient.blockUser(params.ownerId as string, undefined, token);
              router.back();
            } catch (caught) {
              setError(caught instanceof Error ? caught.message : 'Unable to block this user.');
            }
          },
          style: 'destructive',
          text: 'Block',
        },
      ],
    );
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={12}
        style={styles.flex}
      >
        <View style={styles.header}>
          <Pressable accessibilityLabel="Back" onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={22} color={colors.ink} />
          </Pressable>
          <Text numberOfLines={1} style={styles.title}>{params.title ?? 'Message owner'}</Text>
          {params.ownerId ? (
            <Pressable accessibilityLabel="Block user" onPress={confirmBlock} style={styles.backButton}>
              <Ionicons name="hand-left-outline" size={20} color={colors.danger} />
            </Pressable>
          ) : (
            <View style={styles.backButton} />
          )}
        </View>

        {listing ? (
          <Pressable onPress={() => router.push(`/listing/${listing.id}`)} style={styles.listingCard}>
            {listing.images[0] ? (
              <Image source={{ uri: listing.images[0].url }} style={styles.listingImage} />
            ) : (
              <View style={[styles.listingImage, { backgroundColor: categoryColor(listing.category.slug) }]}>
                <Ionicons
                  color={colors.surface}
                  name={listing.listing_type === 'service' ? 'person-outline' : 'cube-outline'}
                  size={18}
                />
              </View>
            )}
            <View style={styles.listingInfo}>
              <Text numberOfLines={1} style={styles.listingTitle}>{listing.title}</Text>
              <Text style={styles.listingPrice}>
                {priceLine(listing.prices[0]?.unit ?? '', listing.prices[0]?.amount_minor ?? 0)}
              </Text>
            </View>
            <Ionicons color={colors.muted} name="chevron-forward" size={16} />
          </Pressable>
        ) : null}

        <View style={styles.safetyBanner}>
          <Ionicons name="shield-checkmark-outline" size={16} color={colors.teal} />
          <Text style={styles.safetyBannerText}>
            Stay safe: keep the conversation in the app, never share your phone number, bank details, or
            OTPs, and meet in a public place for handovers.
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.teal} size="large" style={styles.loading} />
        ) : (
          <FlatList
            contentContainerStyle={styles.list}
            data={messages}
            keyExtractor={(item) => item.id}
            ref={listRef}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="chatbubble-ellipses-outline" size={28} color={colors.muted} />
                <Text style={styles.emptyText}>Say hello and ask about availability.</Text>
              </View>
            }
            renderItem={({ item }) => {
              const mine = item.sender_user_id === currentUserId;
              return (
                <View style={[styles.bubbleRow, mine && styles.bubbleRowMine]}>
                  <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                    <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{item.body}</Text>
                  </View>
                </View>
              );
            }}
          />
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.composer}>
          <TextInput
            multiline
            onChangeText={setDraft}
            placeholder="Type a message..."
            placeholderTextColor={colors.muted}
            style={styles.input}
            value={draft}
          />
          <Pressable disabled={sending || !draft.trim()} onPress={send} style={styles.sendButton}>
            {sending ? (
              <ActivityIndicator color={colors.surface} />
            ) : (
              <Ionicons name="send" size={18} color={colors.surface} />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.paper, flex: 1 },
  flex: { flex: 1 },
  header: {
    alignItems: 'center',
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  backButton: { height: 36, width: 36, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.ink, flex: 1, fontSize: 16, fontWeight: '900', textAlign: 'center' },
  listingCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  listingImage: { alignItems: 'center', borderRadius: radius.sm, height: 40, justifyContent: 'center', width: 40 },
  listingInfo: { flex: 1, gap: 2 },
  listingTitle: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  listingPrice: { color: colors.teal, fontSize: 12, fontWeight: '700' },
  safetyBanner: {
    alignItems: 'flex-start',
    backgroundColor: '#EAF7F1',
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    borderRadius: radius.sm,
  },
  safetyBannerText: { color: colors.ink, flex: 1, fontSize: 12, lineHeight: 17 },
  loading: { marginTop: 60 },
  list: { flexGrow: 1, gap: 8, padding: 16 },
  empty: { alignItems: 'center', gap: 8, marginTop: 60 },
  emptyText: { color: colors.muted, fontSize: 13 },
  bubbleRow: { flexDirection: 'row' },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubble: { borderRadius: radius.md, maxWidth: '80%', paddingHorizontal: 14, paddingVertical: 10 },
  bubbleTheirs: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1 },
  bubbleMine: { backgroundColor: colors.teal },
  bubbleText: { color: colors.ink, fontSize: 14, lineHeight: 19 },
  bubbleTextMine: { color: colors.surface },
  error: {
    backgroundColor: '#FFF2F0',
    borderLeftColor: colors.danger,
    borderLeftWidth: 3,
    color: colors.danger,
    marginHorizontal: 16,
    padding: 10,
  },
  composer: {
    alignItems: 'flex-end',
    borderTopColor: colors.line,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 8,
    padding: 12,
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.ink,
    flex: 1,
    maxHeight: 100,
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  sendButton: {
    alignItems: 'center',
    backgroundColor: colors.teal,
    borderRadius: radius.pill,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
});
