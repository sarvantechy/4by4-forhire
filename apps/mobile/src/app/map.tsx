import type { ListingResponse } from '@4by4/api-client';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OpenMap } from '@/components/OpenMap';
import { apiClient } from '@/services/api';
import { useLocation } from '@/services/locationStore';
import { categoryColor, colors, radius } from '@/theme';

type ListingTab = 'item' | 'service';

function priceLabel(listing: ListingResponse): string {
  const price = listing.prices[0];
  if (!price) return 'Price unavailable';
  return `Rs. ${Math.round(price.amount_minor / 100).toLocaleString('en-IN')} / ${price.unit}`;
}

function openListing(id: string) {
  router.push(`/listing/${id}`);
}

/** Full-screen interactive map of nearby listings. Tap a pin to preview it, tap the preview to open the listing. */
export default function MapScreen() {
  const params = useLocalSearchParams<{ tab?: ListingTab }>();
  const tab = params.tab === 'service' ? 'service' : 'item';
  const location = useLocation();
  const [listings, setListings] = useState<ListingResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ListingResponse | null>(null);

  useEffect(() => {
    let active = true;
    apiClient
      .searchListings({ limit: 60 })
      .then((items) => active && setListings(items))
      .catch(() => active && setListings([]))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const pins = useMemo(
    () =>
      listings.filter(
        (item) => item.listing_type === tab && item.latitude != null && item.longitude != null,
      ),
    [listings, tab],
  );

  return (
    <View style={styles.root}>
      <OpenMap
        center={location}
        markers={pins.map((item) => ({
          color: categoryColor(item.category?.slug),
          coordinate: { latitude: item.latitude ?? 0, longitude: item.longitude ?? 0 },
          id: item.id,
          onPress: () => setSelected(item),
        }))}
        style={styles.map}
        zoom={11}
      />

      <SafeAreaView edges={['top']} style={styles.topOverlay} pointerEvents="box-none">
        <Pressable accessibilityLabel="Close map" onPress={() => router.back()} style={styles.backButton}>
          <Ionicons color={colors.ink} name="close" size={20} />
        </Pressable>
        {loading ? (
          <View style={styles.loadingPill}>
            <ActivityIndicator color={colors.teal} size="small" />
          </View>
        ) : null}
      </SafeAreaView>

      {selected ? (
        <SafeAreaView edges={['bottom']} style={styles.previewWrapper}>
          <Pressable onPress={() => openListing(selected.id)} style={styles.previewCard}>
            {selected.images[0] ? (
              <Image source={{ uri: selected.images[0].url }} style={styles.previewImage} />
            ) : (
              <View style={styles.previewImageFallback}>
                <Ionicons color={colors.surface} name="cube-outline" size={20} />
              </View>
            )}
            <View style={styles.previewCopy}>
              <Text numberOfLines={1} style={styles.previewTitle}>{selected.title}</Text>
              <Text style={styles.previewPrice}>{priceLabel(selected)}</Text>
            </View>
            <View style={styles.previewAction}>
              <Text style={styles.previewActionText}>View</Text>
              <Ionicons color={colors.teal} name="chevron-forward" size={16} />
            </View>
          </Pressable>
        </SafeAreaView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  map: { bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 },
  topOverlay: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    height: 40,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    width: 40,
  },
  loadingPill: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  previewWrapper: { bottom: 0, left: 0, position: 'absolute', right: 0, padding: 16 },
  previewCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
  },
  previewImage: { borderRadius: radius.sm, height: 52, width: 52 },
  previewImageFallback: {
    alignItems: 'center',
    backgroundColor: '#1C3430',
    borderRadius: radius.sm,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  previewCopy: { flex: 1 },
  previewTitle: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  previewPrice: { color: colors.teal, fontSize: 12, fontWeight: '700', marginTop: 2 },
  previewAction: { alignItems: 'center', flexDirection: 'row', gap: 2 },
  previewActionText: { color: colors.teal, fontSize: 13, fontWeight: '900' },
});
