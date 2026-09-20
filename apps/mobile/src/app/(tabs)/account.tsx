import type { ListingResponse, UserResponse } from '@4by4/api-client';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { translate } from '@4by4/i18n';

import { apiClient } from '@/services/api';
import { clearSession, getAccessToken } from '@/services/sessionStore';
import { useLocale } from '@/services/localeStore';
import { PhotoCollageBackdrop } from '@/components/PhotoCollageBackdrop';
import { colors } from '@/theme';
import { ListSkeleton } from '@/components/Skeleton';

const NEXT_ACTION: Record<string, { action: 'publish' | 'pause' | 'resume' | 'archive'; label: string } | undefined> = {
  active: { action: 'pause', label: 'Pause' },
  archived: undefined,
  draft: { action: 'publish', label: 'Publish' },
  paused: { action: 'resume', label: 'Resume' },
  pending_checks: undefined,
  under_review: undefined,
};

function priceLabel(listing: ListingResponse): string {
  const price = listing.prices[0];
  if (!price) return 'Price unavailable';
  return `Rs. ${Math.round(price.amount_minor / 100).toLocaleString('en-IN')} / ${price.unit}`;
}

export default function AccountScreen() {
  const locale = useLocale();
  const [user, setUser] = useState<UserResponse | null>(null);
  const [listings, setListings] = useState<ListingResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) {
      setUser(null);
      setListings([]);
      setLoading(false);
      return;
    }
    try {
      const [me, myListings] = await Promise.all([
        apiClient.getCurrentUser(token),
        apiClient.getMyListings(token),
      ]);
      setUser(me);
      setListings(myListings);
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load your account.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional mount-time fetch, also reused by pull-to-refresh
    load();
  }, [load]);

  async function transition(listingId: string, action: 'publish' | 'pause' | 'resume' | 'archive') {
    const token = await getAccessToken();
    if (!token) return;
    try {
      await apiClient.transitionListing(listingId, action, undefined, token);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to update this listing.');
    }
  }

  async function signOut() {
    const token = await getAccessToken();
    try {
      if (token) {
        await apiClient.logout(undefined, token);
      }
    } catch {
      // The session may already be invalid server-side; clear it locally regardless.
    }
    await clearSession();
    setUser(null);
    setListings([]);
  }

  if (loading) {
    return (
      <View style={styles.root}>
        <PhotoCollageBackdrop />
        <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
          <ListSkeleton rows={3} />
        </SafeAreaView>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.root}>
        <PhotoCollageBackdrop />
        <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
        <View style={styles.signedOut}>
          <View style={styles.badgeRow}>
            <View style={styles.brandBadge}>
              <Ionicons name="cube" size={16} color={colors.ink} />
            </View>
            <Text style={styles.brandBadgeText}>4by4 For Hire</Text>
          </View>

          <LinearGradient colors={['#0BB768', '#087F75']} end={{ x: 1, y: 1 }} start={{ x: 0, y: 0 }} style={styles.heroCard}>
            <View style={styles.heroIconRing}>
              <Ionicons name="person" size={30} color={colors.surface} />
            </View>
            <Text accessibilityRole="header" style={styles.heroTitle}>Your 4×4 account</Text>
            <Text style={styles.heroSubtitle}>Track listings, bookings, and offers in one place.</Text>
          </LinearGradient>

          <View style={styles.perksRow}>
            <View style={styles.perkCard}>
              <View style={[styles.perkIconRing, { backgroundColor: '#FFF3D6' }]}>
                <Ionicons name="pricetag-outline" size={18} color="#FFB800" />
              </View>
              <Text style={styles.perkText}>List & earn</Text>
            </View>
            <View style={styles.perkCard}>
              <View style={[styles.perkIconRing, { backgroundColor: '#DFF7EE' }]}>
                <Ionicons name="calendar-outline" size={18} color="#0BB768" />
              </View>
              <Text style={styles.perkText}>Manage bookings</Text>
            </View>
            <View style={styles.perkCard}>
              <View style={[styles.perkIconRing, { backgroundColor: '#E1EBFF' }]}>
                <Ionicons name="chatbubbles-outline" size={18} color="#3B82F6" />
              </View>
              <Text style={styles.perkText}>Chat safely</Text>
            </View>
          </View>

          <Pressable onPress={() => router.push('/login')} style={styles.signInButton}>
            <Text style={styles.signInButtonText}>Sign in / create account</Text>
          </Pressable>
          <Text style={styles.signedOutHint}>New here? Creating an account takes less than a minute.</Text>
        </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <PhotoCollageBackdrop />
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <FlatList
        contentContainerStyle={styles.content}
        data={listings}
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
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <View>
                <Text style={styles.eyebrow}>Signed in</Text>
                <Text accessibilityRole="header" style={styles.title}>{user.display_name}</Text>
                <Text style={styles.listingCount}>
                  {listings.length} {listings.length === 1 ? 'listing' : 'listings'} posted
                </Text>
              </View>
              <Pressable onPress={signOut} style={styles.signOut}>
                <Text style={styles.signOutText}>Sign out</Text>
              </Pressable>
            </View>
            <Pressable onPress={() => router.push('/edit-profile')} style={styles.editProfileRow}>
              <Ionicons name="person-circle-outline" size={20} color={colors.teal} />
              <Text style={styles.editProfileText}>Edit profile</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.muted} />
            </Pressable>
            <Pressable onPress={() => router.push('/notifications')} style={styles.editProfileRow}>
              <Ionicons name="chatbubbles-outline" size={20} color={colors.teal} />
              <Text style={styles.editProfileText}>{translate(locale, 'notifications.title')}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.muted} />
            </Pressable>
            <Pressable onPress={() => router.push('/offers')} style={styles.editProfileRow}>
              <Ionicons name="pricetag-outline" size={20} color={colors.teal} />
              <Text style={styles.editProfileText}>My offers</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.muted} />
            </Pressable>
            <Pressable onPress={() => router.push('/stores')} style={styles.editProfileRow}>
              <Ionicons name="storefront-outline" size={20} color={colors.teal} />
              <Text style={styles.editProfileText}>My stores</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.muted} />
            </Pressable>
            <Pressable onPress={() => router.push('/blocked-users')} style={styles.editProfileRow}>
              <Ionicons name="hand-left-outline" size={20} color={colors.teal} />
              <Text style={styles.editProfileText}>Blocked users</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.muted} />
            </Pressable>
            <Pressable onPress={() => router.push('/about')} style={styles.editProfileRow}>
              <Ionicons name="information-circle-outline" size={20} color={colors.teal} />
              <Text style={styles.editProfileText}>About this app</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.muted} />
            </Pressable>
            {!user.profile_complete ? (
              <View style={styles.completeBanner}>
                <Ionicons name="alert-circle" size={18} color={colors.ink} />
                <Text style={styles.completeBannerText}>
                  Complete your profile (locality and address) before listing anything.
                </Text>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="pricetags-outline" size={28} color={colors.signal} />
            <Text style={styles.emptyTitle}>No listings yet</Text>
            <Text style={styles.message}>
              {error || 'Use "List item" below to publish an item or offer your work.'}
            </Text>
            <Link href="/list-item" style={styles.emptyAction}>List something</Link>
          </View>
        }
        renderItem={({ item }) => {
          const next = NEXT_ACTION[item.status];
          return (
            <Pressable onPress={() => router.push(`/listing/${item.id}`)} style={styles.card}>
              <View style={styles.cardRow}>
                {item.images[0] ? (
                  <Image source={{ uri: item.images[0].url }} style={styles.cardImage} />
                ) : (
                  <View style={styles.cardImageFallback}>
                    <Ionicons name="image-outline" size={22} color={colors.muted} />
                  </View>
                )}
                <View style={styles.cardBody}>
                  <View style={styles.cardTop}>
                    <Text numberOfLines={1} style={styles.cardTitle}>{item.title}</Text>
                    <Text style={styles.status}>{item.status.replace('_', ' ')}</Text>
                  </View>
                  <Text style={styles.price}>{priceLabel(item)}</Text>
                  <Text style={styles.editHint}>Tap to view or edit this listing</Text>
                </View>
              </View>
              {next ? (
                <Pressable
                  onPress={(event) => {
                    event.stopPropagation();
                    transition(item.id, next.action);
                  }}
                  style={styles.actionButton}
                >
                  <Text style={styles.actionButtonText}>{next.label}</Text>
                </Pressable>
              ) : null}
              {item.status !== 'archived' ? (
                <Pressable
                  onPress={(event) => {
                    event.stopPropagation();
                    transition(item.id, 'archive');
                  }}
                  style={styles.archiveButton}
                >
                  <Text style={styles.archiveButtonText}>Archive</Text>
                </Pressable>
              ) : null}
            </Pressable>
          );
        }}
      />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: colors.ink, flex: 1 },
  safeArea: { flex: 1 },
  loading: { marginTop: 60 },
  content: { padding: 20, paddingBottom: 90 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 18 },
  eyebrow: { color: colors.signal, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  title: { color: colors.ink, fontSize: 26, fontWeight: '900', marginTop: 4 },
  listingCount: { color: colors.muted, fontSize: 12, fontWeight: '700', marginTop: 4 },
  signOut: { alignSelf: 'flex-start', paddingVertical: 8 },
  signOutText: { color: colors.danger, fontSize: 13, fontWeight: '800' },
  editProfileRow: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    padding: 12,
  },
  editProfileText: { color: colors.ink, flex: 1, fontSize: 14, fontWeight: '800' },
  completeBanner: {
    alignItems: 'center',
    backgroundColor: colors.signal,
    borderRadius: 12,
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
    padding: 12,
  },
  completeBannerText: { color: colors.ink, flex: 1, fontSize: 12, fontWeight: '700' },
  signedOut: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: 24 },
  badgeRow: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 6,
    marginBottom: 18,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  brandBadge: {
    alignItems: 'center',
    backgroundColor: colors.signal,
    borderRadius: 999,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  brandBadgeText: { color: colors.ink, fontSize: 12, fontWeight: '900' },
  heroCard: {
    alignItems: 'center',
    borderRadius: 24,
    elevation: 8,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    width: '100%',
  },
  heroIconRing: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    borderRadius: 32,
    height: 64,
    justifyContent: 'center',
    marginBottom: 14,
    width: 64,
  },
  heroTitle: { color: colors.surface, fontSize: 21, fontWeight: '900', textAlign: 'center' },
  heroSubtitle: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
    textAlign: 'center',
  },
  perksRow: { flexDirection: 'row', gap: 10, marginTop: 18, width: '100%' },
  perkCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    elevation: 3,
    flex: 1,
    gap: 6,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { height: 3, width: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
  },
  perkIconRing: {
    alignItems: 'center',
    borderRadius: 20,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  perkText: { color: colors.ink, fontSize: 11, fontWeight: '800', textAlign: 'center' },
  message: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: 8, textAlign: 'center' },
  signInButton: {
    alignItems: 'center',
    backgroundColor: colors.signal,
    borderRadius: 14,
    elevation: 6,
    justifyContent: 'center',
    marginTop: 22,
    minHeight: 52,
    paddingHorizontal: 24,
    shadowColor: '#000',
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    width: '100%',
  },
  signInButtonText: { color: colors.ink, fontSize: 15, fontWeight: '900' },
  signedOutHint: {
    color: colors.surface,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 14,
    textAlign: 'center',
  },
  empty: { alignItems: 'center', padding: 30 },
  emptyTitle: { color: colors.ink, fontSize: 16, fontWeight: '900', marginTop: 10 },
  emptyAction: { color: colors.teal, fontSize: 14, fontWeight: '800', marginTop: 14 },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
    padding: 12,
  },
  cardRow: { flexDirection: 'row', gap: 12 },
  cardImage: { backgroundColor: colors.paper, borderRadius: 12, height: 72, width: 72 },
  cardImageFallback: {
    alignItems: 'center',
    backgroundColor: colors.paper,
    borderRadius: 12,
    height: 72,
    justifyContent: 'center',
    width: 72,
  },
  cardBody: { flex: 1, justifyContent: 'center' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between' },
  cardTitle: { color: colors.ink, flex: 1, fontSize: 16, fontWeight: '800' },
  status: { color: colors.teal, fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  price: { color: colors.ink, fontSize: 14, fontWeight: '700', marginTop: 6 },
  editHint: { color: colors.muted, fontSize: 11, fontWeight: '600', marginTop: 4 },
  actionButton: {
    alignItems: 'center',
    backgroundColor: colors.signal,
    justifyContent: 'center',
    marginTop: 12,
    minHeight: 42,
  },
  actionButtonText: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  archiveButton: { alignItems: 'center', marginTop: 8, minHeight: 32 },
  archiveButtonText: { color: colors.danger, fontSize: 12, fontWeight: '700' },
});

