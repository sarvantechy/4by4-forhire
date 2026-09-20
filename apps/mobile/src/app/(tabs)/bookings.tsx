import type { BookingResponse, UserResponse } from '@4by4/api-client';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from '@/components/GradientBackground';

import { apiClient } from '@/services/api';
import { getAccessToken } from '@/services/sessionStore';
import { colors, radius } from '@/theme';
import { ListSkeleton } from '@/components/Skeleton';

function rupees(amountMinor: number): string {
  return `Rs. ${Math.round(amountMinor / 100).toLocaleString('en-IN')}`;
}

function dateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function statusColor(status: string): string {
  if (status === 'completed') return colors.teal;
  if (['rejected', 'cancelled'].includes(status)) return colors.danger;
  if (['requested', 'ready_for_handover', 'return_pending', 'inspection', 'overdue'].includes(status)) {
    return colors.signal;
  }
  return colors.ink;
}

export default function BookingsScreen() {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [bookings, setBookings] = useState<BookingResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getAccessToken()
      .then(async (accessToken) => {
        if (!accessToken) throw new Error('Sign in from Account to view bookings.');
        const [profile, items] = await Promise.all([
          apiClient.getCurrentUser(accessToken),
          apiClient.listBookings(accessToken),
        ]);
        if (!active) return;
        setUser(profile);
        setBookings(items);
      })
      .catch((error_) => active && setError(error_ instanceof Error ? error_.message : 'Unable to load bookings.'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ListSkeleton rows={3} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Renting and lending</Text>
        <Text accessibilityRole="header" style={styles.title}>Bookings</Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        contentContainerStyle={styles.list}
        data={bookings}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="calendar-outline" size={34} color={colors.signal} />
            <Text style={styles.emptyTitle}>No bookings to show</Text>
            <Text style={styles.emptyMessage}>Request dates from an active listing to begin.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const isOwner = user?.id === item.owner_user_id;
          return (
            <Pressable onPress={() => router.push(`/booking/${item.id}`)} style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.bookingNumber}>{item.public_number}</Text>
                <Text style={[styles.status, { color: statusColor(item.status) }]}>
                  {item.status.replaceAll('_', ' ')}
                </Text>
              </View>
              <View style={styles.cardMain}>
                {item.listing_image_url ? (
                  <Image source={{ uri: item.listing_image_url }} style={styles.thumb} />
                ) : (
                  <View style={[styles.thumb, styles.thumbFallback]}>
                    <Ionicons name="image-outline" size={20} color={colors.muted} />
                  </View>
                )}
                <View style={styles.cardMainText}>
                  {item.listing_title ? (
                    <Text numberOfLines={1} style={styles.listingTitle}>{item.listing_title}</Text>
                  ) : null}
                  <Text style={styles.role}>{isOwner ? 'Lending' : 'Renting'}</Text>
                  <View style={styles.cardBottom}>
                    <Text style={styles.dates}>{dateLabel(item.starts_at)} \u2013 {dateLabel(item.ends_at)}</Text>
                    <Text style={styles.amount}>{rupees(item.rental_charge_minor)}</Text>
                  </View>
                </View>
              </View>
              <Ionicons color={colors.muted} name="chevron-forward" size={18} style={styles.chevron} />
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.paper },
  header: { paddingHorizontal: 20, paddingTop: 20 },
  eyebrow: { color: colors.signal, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  title: { color: colors.ink, fontSize: 28, fontWeight: '900', marginTop: 4 },
  list: { padding: 20, paddingBottom: 110, gap: 10 },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    gap: 6,
    padding: 16,
    paddingRight: 34,
  },
  cardTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  bookingNumber: { color: colors.ink, fontSize: 15, fontWeight: '900' },
  status: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  cardMain: { flexDirection: 'row', gap: 12, marginTop: 6 },
  thumb: { borderRadius: radius.sm, height: 64, width: 64 },
  thumbFallback: {
    alignItems: 'center',
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderWidth: 1,
    justifyContent: 'center',
  },
  cardMainText: { flex: 1, gap: 2, justifyContent: 'center' },
  listingTitle: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  role: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  cardBottom: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  dates: { color: colors.muted, fontSize: 13 },
  amount: { color: colors.ink, fontSize: 16, fontWeight: '900' },
  chevron: { position: 'absolute', right: 14, top: '50%', marginTop: -9 },
  error: {
    backgroundColor: '#FFF2F0',
    borderLeftColor: colors.danger,
    borderLeftWidth: 3,
    color: colors.danger,
    marginHorizontal: 20,
    marginTop: 14,
    padding: 12,
  },
  empty: { alignItems: 'center', gap: 10, marginTop: 90, padding: 28 },
  emptyTitle: { color: colors.ink, fontSize: 21, fontWeight: '900' },
  emptyMessage: { color: colors.muted, lineHeight: 21, textAlign: 'center' },
});

