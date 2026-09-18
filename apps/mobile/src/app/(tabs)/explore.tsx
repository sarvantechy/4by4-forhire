import type { ListingResponse, QuoteRequest } from '@4by4/api-client';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { apiClient } from '@/services/api';
import { getAccessToken } from '@/services/sessionStore';
import { colors } from '@/theme';

function priceLabel(listing: ListingResponse): string {
  const price = listing.prices[0];
  if (!price) return 'Price unavailable';
  return `Rs. ${Math.round(price.amount_minor / 100).toLocaleString('en-IN')} / ${price.unit}`;
}

export default function ExploreScreen() {
  const [query, setQuery] = useState('');
  const [listings, setListings] = useState<ListingResponse[]>([]);
  const [bookingListingId, setBookingListingId] = useState('');
  const [startsOn, setStartsOn] = useState('');
  const [endsOn, setEndsOn] = useState('');
  const [bookingBusy, setBookingBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load(search?: string) {
    setLoading(true);
    try {
      setListings(await apiClient.searchListings(search));
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load inventory.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    apiClient.searchListings()
      .then((items) => active && setListings(items))
      .catch((caught) => active && setError(caught instanceof Error ? caught.message : 'Unable to load inventory.'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  async function requestBooking(listing: ListingResponse) {
    const token = await getAccessToken();
    const unit = listing.prices[0]?.unit;
    if (!token) {
      setError('Sign in from Account before requesting a booking.');
      return;
    }
    if (!startsOn || !endsOn || !['hour', 'day', 'week', 'month'].includes(unit ?? '')) {
      setError('Enter valid start and end dates as YYYY-MM-DD.');
      return;
    }
    setBookingBusy(true);
    setError('');
    setNotice('');
    try {
      const quote = await apiClient.createQuote(listing.id, {
        ends_at: new Date(`${endsOn}T17:00:00`).toISOString(),
        quantity: 1,
        starts_at: new Date(`${startsOn}T09:00:00`).toISOString(),
        unit: unit as QuoteRequest['unit'],
      }, undefined, token);
      const booking = await apiClient.createBooking({
        fulfillment_method: 'pickup',
        quote_id: quote.id,
      }, undefined, token);
      setNotice(`${booking.public_number} sent to the owner.`);
      setBookingListingId('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to request this booking.');
    } finally {
      setBookingBusy(false);
    }
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Kanyakumari pilot</Text>
        <Text accessibilityRole="header" style={styles.title}>Explore rentals</Text>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={20} color={colors.muted} />
          <TextInput
            onChangeText={setQuery}
            onSubmitEditing={() => load(query)}
            placeholder="Search approved inventory"
            placeholderTextColor={colors.muted}
            returnKeyType="search"
            style={styles.input}
            value={query}
          />
          <Pressable accessibilityLabel="Search" onPress={() => load(query)}>
            <Ionicons name="arrow-forward-circle" size={28} color={colors.teal} />
          </Pressable>
        </View>
      </View>
      {loading ? (
        <ActivityIndicator color={colors.teal} size="large" style={styles.loading} />
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={listings}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="search-outline" size={30} color={colors.teal} />
              <Text style={styles.emptyTitle}>No active listings</Text>
              <Text style={styles.emptyMessage}>{error || 'Try another search or list an item nearby.'}</Text>
            </View>
          }
          ListHeaderComponent={notice ? <Text style={styles.notice}>{notice}</Text> : null}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardVisual}>
                <Ionicons name="cube-outline" size={32} color={colors.surface} />
                <Text style={styles.category}>{item.category.name}</Text>
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text numberOfLines={2} style={styles.description}>{item.description}</Text>
                <View style={styles.meta}>
                  <Ionicons name="location-outline" size={15} color={colors.teal} />
                  <Text style={styles.locality}>{item.public_locality}</Text>
                </View>
                <Text style={styles.price}>{priceLabel(item)}</Text>
                {bookingListingId === item.id ? (
                  <View style={styles.bookingForm}>
                    <TextInput
                      onChangeText={setStartsOn}
                      placeholder="Start YYYY-MM-DD"
                      placeholderTextColor={colors.muted}
                      style={styles.dateInput}
                      value={startsOn}
                    />
                    <TextInput
                      onChangeText={setEndsOn}
                      placeholder="End YYYY-MM-DD"
                      placeholderTextColor={colors.muted}
                      style={styles.dateInput}
                      value={endsOn}
                    />
                    <Pressable disabled={bookingBusy} onPress={() => requestBooking(item)} style={styles.bookButton}>
                      {bookingBusy ? <ActivityIndicator color={colors.ink} /> : <Text style={styles.bookButtonText}>Send request</Text>}
                    </Pressable>
                  </View>
                ) : (
                  <Pressable onPress={() => setBookingListingId(item.id)} style={styles.bookButton}>
                    <Ionicons name="calendar-outline" size={18} color={colors.ink} />
                    <Text style={styles.bookButtonText}>Request dates</Text>
                  </Pressable>
                )}
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.paper },
  header: { paddingHorizontal: 20, paddingTop: 24 },
  eyebrow: { color: colors.teal, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  title: { color: colors.ink, fontSize: 32, fontWeight: '900', marginTop: 4 },
  searchBox: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 9,
    marginTop: 20,
    minHeight: 52,
    paddingHorizontal: 14,
  },
  input: { color: colors.ink, flex: 1, fontSize: 15 },
  loading: { marginTop: 60 },
  list: { gap: 14, padding: 20 },
  card: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1 },
  cardVisual: {
    alignItems: 'flex-end',
    backgroundColor: '#1C3430',
    flexDirection: 'row',
    gap: 10,
    minHeight: 110,
    padding: 16,
  },
  category: { color: colors.surface, fontSize: 13, fontWeight: '800' },
  cardBody: { gap: 8, padding: 16 },
  cardTitle: { color: colors.ink, fontSize: 19, fontWeight: '900' },
  description: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  meta: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  locality: { color: colors.muted, fontSize: 12 },
  price: { color: colors.ink, fontSize: 16, fontWeight: '900' },
  bookingForm: { gap: 8, marginTop: 4 },
  dateInput: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    color: colors.ink,
    minHeight: 46,
    paddingHorizontal: 12,
  },
  bookButton: {
    alignItems: 'center',
    backgroundColor: colors.signal,
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    minHeight: 46,
  },
  bookButtonText: { color: colors.ink, fontWeight: '900' },
  notice: {
    backgroundColor: '#E8F6F3',
    borderLeftColor: colors.teal,
    borderLeftWidth: 3,
    color: colors.teal,
    marginBottom: 12,
    padding: 12,
  },
  empty: { alignItems: 'center', gap: 9, marginTop: 60, padding: 30 },
  emptyTitle: { color: colors.ink, fontSize: 20, fontWeight: '900' },
  emptyMessage: { color: colors.muted, textAlign: 'center' },
});
