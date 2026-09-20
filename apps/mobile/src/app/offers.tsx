import type { OfferResponse, UserResponse } from '@4by4/api-client';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from '@/components/GradientBackground';

import { apiClient } from '@/services/api';
import { getAccessToken } from '@/services/sessionStore';
import { colors } from '@/theme';
import { ListSkeleton } from '@/components/Skeleton';

function rupees(amountMinor: number): string {
  return `Rs. ${Math.round(amountMinor / 100).toLocaleString('en-IN')}`;
}

export default function OffersScreen() {
  const [token, setToken] = useState('');
  const [user, setUser] = useState<UserResponse | null>(null);
  const [offers, setOffers] = useState<OfferResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [counterAmount, setCounterAmount] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      setError('Sign in from Account to view your offers.');
      setOffers([]);
      return;
    }
    setToken(accessToken);
    const [profile, items] = await Promise.all([
      apiClient.getCurrentUser(accessToken),
      apiClient.listOffers(accessToken),
    ]);
    setUser(profile);
    setOffers(items);
  }, []);

  useEffect(() => {
    let active = true;
    load()
      .catch((error_) => active && setError(error_ instanceof Error ? error_.message : 'Unable to load offers.'))
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
      setError(error_ instanceof Error ? error_.message : 'Unable to refresh offers.');
    } finally {
      setRefreshing(false);
    }
  }

  function replace(updated: OfferResponse) {
    setOffers((current) => current.map((item) => (item.id === updated.id ? updated : item)));
  }

  async function act(offerId: string, action: () => Promise<OfferResponse>, success: string) {
    setBusyId(offerId);
    setError('');
    setNotice('');
    try {
      replace(await action());
      setNotice(success);
    } catch (error_) {
      setError(error_ instanceof Error ? error_.message : 'Unable to complete this action.');
    } finally {
      setBusyId('');
    }
  }

  if (loading) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
        <ListSkeleton />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <Text accessibilityRole="header" style={styles.title}>My offers</Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}

      <FlatList
        contentContainerStyle={styles.list}
        data={offers}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl onRefresh={refresh} refreshing={refreshing} tintColor={colors.teal} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="pricetag-outline" size={28} color={colors.signal} />
            <Text style={styles.emptyTitle}>No offers yet</Text>
            <Text style={styles.emptyMessage}>Make an offer from any listing to negotiate a price.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const isOwner = user?.id === item.owner_user_id;
          const isRenter = user?.id === item.renter_user_id;
          const busy = busyId === item.id;
          return (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.role}>{isOwner ? 'Received on your listing' : 'Sent by you'}</Text>
                <Text style={styles.status}>{item.status.replaceAll('_', ' ')}</Text>
              </View>
              <Text style={styles.amount}>{rupees(item.proposed_amount_minor)}</Text>
              <Text style={styles.reason}>{item.reason}</Text>
              {item.counter_amount_minor != null ? (
                <Text style={styles.counter}>
                  Counter-offer: {rupees(item.counter_amount_minor)}
                  {item.counter_reason ? ` — ${item.counter_reason}` : ''}
                </Text>
              ) : null}

              {isOwner && item.status === 'pending' ? (
                <View style={styles.actionsRow}>
                  <Pressable
                    disabled={busy}
                    onPress={() => act(item.id, () => apiClient.acceptOffer(item.id, undefined, token), 'Offer accepted; a booking was created.')}
                    style={styles.acceptButton}
                  >
                    <Text style={styles.acceptButtonText}>Accept</Text>
                  </Pressable>
                  <Pressable
                    disabled={busy}
                    onPress={() => act(item.id, () => apiClient.declineOffer(item.id, undefined, token), 'Offer declined.')}
                    style={styles.declineButton}
                  >
                    <Text style={styles.declineButtonText}>Decline</Text>
                  </Pressable>
                </View>
              ) : null}

              {isOwner && item.status === 'pending' ? (
                <View style={styles.counterRow}>
                  <TextInput
                    keyboardType="numeric"
                    onChangeText={(value) => setCounterAmount((current) => ({ ...current, [item.id]: value }))}
                    placeholder="Counter price in Rs."
                    placeholderTextColor={colors.muted}
                    style={styles.counterInput}
                    value={counterAmount[item.id] ?? ''}
                  />
                  <Pressable
                    disabled={busy || !counterAmount[item.id]}
                    onPress={() => act(
                      item.id,
                      () => apiClient.counterOffer(item.id, {
                        counter_amount_minor: Math.round(Number(counterAmount[item.id]) * 100),
                        counter_reason: 'Counter-proposal from owner',
                      }, undefined, token),
                      'Counter-offer sent.',
                    )}
                    style={styles.counterButton}
                  >
                    <Text style={styles.counterButtonText}>Counter</Text>
                  </Pressable>
                </View>
              ) : null}

              {isRenter && item.status === 'countered' ? (
                <View style={styles.actionsRow}>
                  <Pressable
                    disabled={busy}
                    onPress={() => act(item.id, () => apiClient.acceptOfferCounter(item.id, undefined, token), 'Counter-offer accepted; a booking was created.')}
                    style={styles.acceptButton}
                  >
                    <Text style={styles.acceptButtonText}>Accept counter</Text>
                  </Pressable>
                  <Pressable
                    disabled={busy}
                    onPress={() => act(item.id, () => apiClient.declineOfferCounter(item.id, undefined, token), 'Counter-offer declined.')}
                    style={styles.declineButton}
                  >
                    <Text style={styles.declineButtonText}>Decline</Text>
                  </Pressable>
                </View>
              ) : null}

              {isRenter && ['pending', 'countered'].includes(item.status) ? (
                <Pressable
                  disabled={busy}
                  onPress={() => act(item.id, () => apiClient.withdrawOffer(item.id, undefined, token), 'Offer withdrawn.')}
                  style={styles.withdrawButton}
                >
                  <Text style={styles.withdrawButtonText}>Withdraw offer</Text>
                </Pressable>
              ) : null}
            </View>
          );
        }}
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
  notice: {
    backgroundColor: '#E8F6F3',
    borderLeftColor: colors.teal,
    borderLeftWidth: 3,
    color: colors.teal,
    marginHorizontal: 16,
    padding: 12,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    gap: 8,
    marginBottom: 12,
    padding: 16,
  },
  cardTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  role: { color: colors.teal, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  status: { color: colors.muted, fontSize: 11, fontWeight: '800', textTransform: 'capitalize' },
  amount: { color: colors.ink, fontSize: 22, fontWeight: '900' },
  reason: { color: colors.ink, fontSize: 13, lineHeight: 19 },
  counter: { color: colors.signal, fontSize: 13, fontWeight: '800' },
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  acceptButton: { backgroundColor: colors.signal, flex: 1, justifyContent: 'center', minHeight: 42 },
  acceptButtonText: { color: colors.ink, fontWeight: '900', textAlign: 'center' },
  declineButton: { borderColor: colors.danger, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 42 },
  declineButtonText: { color: colors.danger, fontWeight: '900', textAlign: 'center' },
  counterRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  counterInput: {
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderWidth: 1,
    color: colors.ink,
    flex: 1,
    minHeight: 42,
    paddingHorizontal: 12,
  },
  counterButton: { alignItems: 'center', backgroundColor: colors.ink, justifyContent: 'center', minHeight: 42, paddingHorizontal: 16 },
  counterButtonText: { color: colors.surface, fontWeight: '900' },
  withdrawButton: { alignItems: 'center', borderColor: colors.line, borderWidth: 1, justifyContent: 'center', marginTop: 6, minHeight: 42 },
  withdrawButtonText: { color: colors.muted, fontWeight: '800' },
});
