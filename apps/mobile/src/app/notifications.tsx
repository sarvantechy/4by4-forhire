import type { ConversationSummaryResponse } from '@4by4/api-client';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from '@/components/GradientBackground';
import { translate } from '@4by4/i18n';

import { apiClient } from '@/services/api';
import { useLocale } from '@/services/localeStore';
import { getAccessToken } from '@/services/sessionStore';
import { colors, radius } from '@/theme';
import { ListSkeleton } from '@/components/Skeleton';

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  return `${days}d`;
}

export default function NotificationsScreen() {
  const locale = useLocale();
  const [conversations, setConversations] = useState<ConversationSummaryResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) {
      setConversations([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      setConversations(await apiClient.listConversations(token));
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load conversations.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional mount-time fetch, also reused by pull-to-refresh
    load();
  }, [load]);

  function openConversation(item: ConversationSummaryResponse) {
    if (!item.listing_id) return;
    router.push({
      pathname: '/listing-chat',
      params: { listingId: item.listing_id, title: item.listing_title ?? item.other_display_name },
    });
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <Text accessibilityRole="header" style={styles.title}>{translate(locale, 'notifications.title')}</Text>
      </View>
      {loading ? (
        <ListSkeleton />
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={conversations}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              refreshing={refreshing}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="chatbubbles-outline" size={28} color={colors.signal} />
              <Text style={styles.emptyTitle}>{translate(locale, 'notifications.empty')}</Text>
              <Text style={styles.emptyMessage}>{error || translate(locale, 'notifications.emptyMessage')}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              disabled={!item.listing_id}
              onPress={() => openConversation(item)}
              style={styles.row}
            >
              <View style={styles.avatar}>
                <Ionicons name="person" size={18} color={colors.surface} />
              </View>
              <View style={styles.rowBody}>
                <View style={styles.rowTop}>
                  <Text numberOfLines={1} style={styles.rowName}>{item.other_display_name}</Text>
                  <Text style={styles.rowTime}>{relativeTime(item.last_message_at)}</Text>
                </View>
                {item.listing_title ? (
                  <Text numberOfLines={1} style={styles.rowListing}>{item.listing_title}</Text>
                ) : null}
                <Text
                  numberOfLines={1}
                  style={[styles.rowPreview, !item.last_message_is_mine && styles.rowPreviewUnread]}
                >
                  {item.last_message_body ?? '—'}
                </Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.paper, flex: 1 },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingBottom: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  title: { color: colors.ink, fontSize: 20, fontWeight: '900' },
  loading: { marginTop: 60 },
  list: { flexGrow: 1, padding: 16, paddingBottom: 40 },
  empty: { alignItems: 'center', gap: 6, marginTop: 60, paddingHorizontal: 24 },
  emptyTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  emptyMessage: { color: colors.muted, fontSize: 13, textAlign: 'center' },
  row: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
    padding: 12,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.teal,
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  rowBody: { flex: 1 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between' },
  rowName: { color: colors.ink, flexShrink: 1, fontSize: 14, fontWeight: '800' },
  rowTime: { color: colors.muted, fontSize: 11 },
  rowListing: { color: colors.signal, fontSize: 11, fontWeight: '700', marginTop: 2 },
  rowPreview: { color: colors.muted, fontSize: 13, marginTop: 2 },
  rowPreviewUnread: { color: colors.ink, fontWeight: '700' },
});
