import type { BlockedUserResponse } from '@4by4/api-client';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from '@/components/GradientBackground';

import { apiClient } from '@/services/api';
import { getAccessToken } from '@/services/sessionStore';
import { colors } from '@/theme';
import { ListSkeleton } from '@/components/Skeleton';

export default function BlockedUsersScreen() {
  const [token, setToken] = useState('');
  const [blocks, setBlocks] = useState<BlockedUserResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      setError('Sign in from Account to manage blocked users.');
      setBlocks([]);
      return;
    }
    setToken(accessToken);
    setBlocks(await apiClient.listBlockedUsers(accessToken));
  }, []);

  useEffect(() => {
    let active = true;
    load()
      .catch((error_) => active && setError(error_ instanceof Error ? error_.message : 'Unable to load blocked users.'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [load]);

  async function refresh() {
    setRefreshing(true);
    try {
      await load();
    } catch (error_) {
      setError(error_ instanceof Error ? error_.message : 'Unable to refresh blocked users.');
    } finally {
      setRefreshing(false);
    }
  }

  async function unblock(userId: string) {
    setBusyId(userId);
    setError('');
    try {
      await apiClient.unblockUser(userId, undefined, token);
      setBlocks((current) => current.filter((item) => item.blocked_user_id !== userId));
    } catch (error_) {
      setError(error_ instanceof Error ? error_.message : 'Unable to unblock this user.');
    } finally {
      setBusyId('');
    }
  }

  if (loading) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
        <ListSkeleton rows={4} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <Text accessibilityRole="header" style={styles.title}>Blocked users</Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        contentContainerStyle={styles.list}
        data={blocks}
        keyExtractor={(item) => item.blocked_user_id}
        refreshControl={<RefreshControl onRefresh={refresh} refreshing={refreshing} tintColor={colors.teal} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="hand-left-outline" size={28} color={colors.signal} />
            <Text style={styles.emptyTitle}>No blocked users</Text>
            <Text style={styles.emptyMessage}>
              Block someone from a booking or chat to stop them from contacting you.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={18} color={colors.surface} />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowName}>{item.display_name}</Text>
              <Text style={styles.rowMeta}>Blocked {new Date(item.blocked_at).toLocaleDateString('en-IN')}</Text>
            </View>
            <Pressable
              disabled={busyId === item.blocked_user_id}
              onPress={() => unblock(item.blocked_user_id)}
              style={styles.unblockButton}
            >
              <Text style={styles.unblockButtonText}>Unblock</Text>
            </Pressable>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.paper, flex: 1 },
  loading: { marginTop: 60 },
  header: { alignItems: 'center', flexDirection: 'row', gap: 12, padding: 16 },
  backButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  title: { color: colors.ink, fontSize: 20, fontWeight: '900' },
  list: { padding: 16, paddingBottom: 60 },
  empty: { alignItems: 'center', gap: 10, marginTop: 90, padding: 28 },
  emptyTitle: { color: colors.ink, fontSize: 21, fontWeight: '900' },
  emptyMessage: { color: colors.muted, lineHeight: 21, textAlign: 'center' },
  error: {
    backgroundColor: '#FFF2F0',
    borderLeftColor: colors.danger,
    borderLeftWidth: 3,
    color: colors.danger,
    marginHorizontal: 16,
    padding: 12,
  },
  row: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
    padding: 14,
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
  rowName: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  rowMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  unblockButton: { borderColor: colors.line, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  unblockButtonText: { color: colors.ink, fontSize: 12, fontWeight: '800' },
});
