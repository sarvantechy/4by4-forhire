import type { CategoryResponse, ListingResponse } from '@4by4/api-client';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Animated,
  ActivityIndicator,
  Easing,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { translate } from '@4by4/i18n';

import { apiClient } from '@/services/api';
import { categoryColor, colors, radius } from '@/theme';
import { OpenMap } from '@/components/OpenMap';
import { OutageScreen } from '@/components/OutageScreen';
import { useLocale } from '@/services/localeStore';
import { getAccessToken } from '@/services/sessionStore';
import { hasResolvedLocation, setLocation, useLocation } from '@/services/locationStore';

type IconName = keyof typeof Ionicons.glyphMap;
type ListingTab = 'item' | 'service';

const MAP_LAYER_HEIGHT = 380;

const MODE_GRADIENTS: Record<ListingTab, [string, string]> = {
  item: ['#FFE066', '#FFB800'],
  service: ['#4DF2A6', '#0BB768'],
};
const MODE_ACCENT: Record<ListingTab, string> = {
  item: '#FFB800',
  service: '#0BB768',
};

const CATEGORY_ICONS: Record<string, IconName> = {
  'cleaning-home': 'sparkles-outline',
  'construction-labour': 'construct-outline',
  'electronics-photography': 'camera-outline',
  'events-functions': 'musical-notes-outline',
  'fashion-accessories': 'shirt-outline',
  'garden-farm': 'leaf-outline',
  'home-office': 'desktop-outline',
  'labour-work-services': 'people-outline',
  'tools-repair': 'hammer-outline',
  'travel-outdoor': 'bicycle-outline',
};

async function detectDeviceLocation(): Promise<void> {
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') return;
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    let locality = 'Current location';
    try {
      const [place] = await Location.reverseGeocodeAsync({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
      if (place) {
        locality = [place.city ?? place.subregion, place.region].filter(Boolean).join(', ') || locality;
      }
    } catch {
      // Keep the generic label if reverse geocoding fails.
    }
    setLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude, locality });
  } catch {
    // Keep the default Tamil Nadu location if detection is unavailable.
  }
}

function categoryIcon(slug: string): IconName {
  return CATEGORY_ICONS[slug] ?? 'pricetag-outline';
}

/** A light, low-opacity tint of the category color for card backgrounds. */
function categoryTint(slug: string | null | undefined): string {
  return `${categoryColor(slug)}1F`;
}

function priceLabel(listing: ListingResponse): string {
  const price = listing.prices[0];
  if (!price) return 'Price unavailable';
  return `Rs. ${Math.round(price.amount_minor / 100).toLocaleString('en-IN')} / ${price.unit}`;
}

function useRevealAnimation(delay: number) {
  const [value] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(value, { delay, duration: 520, toValue: 1, useNativeDriver: true }).start();
  }, [delay, value]);
  return {
    opacity: value,
    transform: [
      {
        translateY: value.interpolate({ inputRange: [0, 1], outputRange: [22, 0] }),
      },
    ],
  };
}

/** Periodic left-to-right shine sweep revealed across the brand lockup. */
function useBrandShine() {
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(1400),
        Animated.timing(progress, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
        Animated.delay(700),
        Animated.timing(progress, { toValue: 0, duration: 0, useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [progress]);
  return progress;
}

export default function HomeScreen() {
  const locale = useLocale();
  const location = useLocation();
  const brandShine = useBrandShine();
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [listings, setListings] = useState<ListingResponse[]>([]);
  const [tab, setTab] = useState<ListingTab>('item');
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ListingResponse[]>([]);
  const [searching, setSearching] = useState(false);

  const categoryAnim = useRevealAnimation(140);
  const nearbyAnim = useRevealAnimation(260);
  const accent = MODE_ACCENT[tab];

  function loadHome() {
    setLoading(true);
    setLoadFailed(false);
    let active = true;
    getAccessToken()
      .then((token) =>
        Promise.all([apiClient.getCategories(), apiClient.searchListings({ limit: 24 }, token ?? undefined)]),
      )
      .then(([categoryItems, listingItems]) => {
        if (!active) return;
        setCategories(categoryItems);
        setListings(listingItems);
      })
      .catch(() => active && setLoadFailed(true))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }

  useEffect(loadHome, []);

  useEffect(() => {
    if (!hasResolvedLocation()) {
      detectDeviceLocation();
    }
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    let active = true;
    setSearching(true);
    const timer = setTimeout(() => {
      getAccessToken()
        .then((token) => apiClient.searchListings({ query: trimmed, limit: 8 }, token ?? undefined))
        .then((results) => active && setSearchResults(results))
        .catch(() => active && setSearchResults([]))
        .finally(() => active && setSearching(false));
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);

  const filteredListings = useMemo(
    () => listings.filter((item) => item.listing_type === tab),
    [listings, tab],
  );
  const mapListings = useMemo(
    () => filteredListings.filter((item) => item.latitude != null && item.longitude != null).slice(0, 10),
    [filteredListings],
  );

  function goToSearchResult(id: string) {
    setQuery('');
    setSearchResults([]);
    router.push(`/listing/${id}`);
  }

  function submitSearch() {
    if (searchResults.length > 0) {
      goToSearchResult(searchResults[0].id);
      return;
    }
    if (query.trim().length > 0) {
      router.push({ pathname: '/explore', params: { q: query.trim() } });
    }
  }

  function goToExploreSearch() {
    router.push({ pathname: '/explore', params: { q: query.trim() } });
  }

  if (loadFailed && !loading && categories.length === 0 && listings.length === 0) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
        <OutageScreen onRetry={loadHome} />
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.root}>
      <Pressable
        accessibilityLabel="Open full map"
        onPress={() => router.push({ pathname: '/map', params: { tab } })}
        style={styles.mapPressable}
      >
        <OpenMap
          center={location}
          interactive={false}
          markers={mapListings.map((item) => ({
            color: accent,
            coordinate: { latitude: item.latitude ?? 0, longitude: item.longitude ?? 0 },
            id: item.id,
          }))}
          style={styles.mapLayer}
          zoom={11}
        />
        <View pointerEvents="none" style={styles.mapScrim} />
      </Pressable>

      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.mapHeaderSpace}>
            <View style={styles.header}>
              <View style={styles.brandColumn}>
                <View style={styles.brandWrap}>
                  <Text style={styles.brandOnMap}>
                    <Text style={styles.brandAccent}>4×4</Text>
                    <Text> FOR HIRE</Text>
                  </Text>
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      styles.brandShineClip,
                      { width: brandShine.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
                    ]}
                  >
                    <Text style={styles.brandOnMap} numberOfLines={1}>
                      <Text style={styles.brandAccent}>4×4</Text>
                      <Text style={styles.brandShineText}> FOR HIRE</Text>
                    </Text>
                  </Animated.View>
                </View>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push('/location-picker')}
                  style={styles.locationRow}
                >
                  <Ionicons name="location-outline" size={15} color={colors.surface} />
                  <Text style={styles.locationOnMap} numberOfLines={1}>{location.locality}</Text>
                  <Text style={styles.changeLocationText}>{translate(locale, 'home.changeLocation')}</Text>
                </Pressable>
              </View>
              <View style={styles.modeToggle}>
                {renderModeSegment('item', translate(locale, 'home.rent'), 'pricetag-outline', 'pricetag')}
                {renderModeSegment('service', translate(locale, 'home.services'), 'briefcase-outline', 'briefcase')}
              </View>
            </View>

            <View style={styles.mapCopy}>
              <Text style={[styles.pilotLabel, { color: accent }]}>{translate(locale, 'home.tamilNaduTagline')}</Text>
              <Text accessibilityRole="header" style={styles.heroTitle}>
                {translate(locale, 'home.heroTitle')}
              </Text>
            </View>

            <View style={styles.searchWrapper}>
              <View style={[styles.searchBox, { borderColor: accent }]}>
                <Ionicons name="search" size={20} color={accent} />
                <TextInput
                  onChangeText={setQuery}
                  onSubmitEditing={submitSearch}
                  placeholder={translate(locale, 'home.searchPlaceholder')}
                  placeholderTextColor={colors.muted}
                  returnKeyType="search"
                  style={styles.searchInput}
                  value={query}
                />
                {searching ? <ActivityIndicator color={accent} size="small" /> : null}
                <Pressable
                  accessibilityLabel="Open notifications"
                  onPress={() => router.push('/notifications')}
                  style={styles.iconButton}
                >
                  <Ionicons name="notifications-outline" size={20} color={colors.ink} />
                </Pressable>
              </View>

              {searchResults.length > 0 ? (
                <View style={styles.searchResults}>
                  {searchResults.slice(0, 4).map((item) => (
                    <Pressable
                      key={item.id}
                      onPress={() => goToSearchResult(item.id)}
                      style={styles.searchResultRow}
                    >
                      {item.images[0] ? (
                        <Image source={{ uri: item.images[0].url }} style={styles.searchResultImage} />
                      ) : (
                        <View style={styles.searchResultImageFallback}>
                          <Ionicons name="cube-outline" size={18} color={colors.surface} />
                        </View>
                      )}
                      <View style={styles.searchResultCopy}>
                        <Text numberOfLines={1} style={styles.searchResultTitle}>{item.title}</Text>
                        <Text style={styles.searchResultPrice}>{priceLabel(item)}</Text>
                      </View>
                    </Pressable>
                  ))}
                  {searchResults.length > 4 ? (
                    <Pressable onPress={goToExploreSearch} style={styles.searchMoreRow}>
                      <Text style={styles.searchMoreText}>
                        See {searchResults.length - 4} more in Explore
                      </Text>
                      <Ionicons name="chevron-forward" size={14} color={colors.teal} />
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
            </View>
          </View>

          <View style={styles.sheet}>
            <Animated.View style={categoryAnim}>
              <View style={styles.sectionHeading}>
                <View>
                  <Text style={[styles.eyebrow, { color: accent }]}>{translate(locale, 'home.browseLocally')}</Text>
                  <Text style={styles.sectionTitle}>{translate(locale, 'home.popularCategories')}</Text>
                </View>
                <Pressable onPress={() => router.push('/explore')}>
                  <Text style={styles.viewAll}>{translate(locale, 'home.viewAll')}</Text>
                </Pressable>
              </View>

              {loading ? (
                <ActivityIndicator color={accent} style={styles.categoryLoading} />
              ) : (
                <View style={styles.categoryGrid}>
                  {categories.slice(0, 8).map((category) => (
                    <Pressable
                      accessibilityRole="button"
                      key={category.id}
                      onPress={() => router.push({ pathname: '/explore', params: { category: category.slug } })}
                      style={[styles.categoryTile, { backgroundColor: categoryTint(category.slug) }]}
                    >
                      <View style={[styles.categoryIconBadge, { backgroundColor: categoryColor(category.slug) }]}>
                        <Ionicons name={categoryIcon(category.slug)} size={22} color={colors.surface} />
                      </View>
                      <Text style={styles.categoryName}>{category.name}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </Animated.View>

            <Animated.View style={nearbyAnim}>
              <View style={styles.sectionHeading}>
                <View>
                  <Text style={[styles.eyebrow, { color: accent }]}>
                    {translate(locale, tab === 'item' ? 'home.availableAroundYou' : 'home.readyToWorkNearby')}
                  </Text>
                  <Text style={styles.sectionTitle}>
                    {translate(locale, tab === 'item' ? 'home.nearbyItems' : 'home.nearbyServices')}
                  </Text>
                </View>
              </View>

              {filteredListings.length === 0 && !loading ? (
                <View style={styles.emptyState}>
                  <View style={[styles.emptyIcon, { backgroundColor: accent }]}>
                    <Ionicons name="locate-outline" size={26} color={colors.ink} />
                  </View>
                  <View style={styles.emptyCopy}>
                    <Text style={styles.emptyTitle}>{translate(locale, 'home.nearbyEmpty')}</Text>
                    <Text style={styles.emptyMessage}>
                      Local inventory will appear here as owners publish approved items.
                    </Text>
                  </View>
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.nearbyRow}>
                  {filteredListings.slice(0, 8).map((item) => (
                    <Pressable key={item.id} onPress={() => router.push(`/listing/${item.id}`)} style={styles.nearbyCard}>
                      {item.images[0] ? (
                        <Image source={{ uri: item.images[0].url }} style={styles.nearbyImage} />
                      ) : (
                        <View style={styles.nearbyImageFallback}>
                          <Ionicons
                            name={item.listing_type === 'service' ? 'person-outline' : 'cube-outline'}
                            size={24}
                            color={colors.surface}
                          />
                        </View>
                      )}
                      <View style={[styles.nearbyBadge, { backgroundColor: categoryColor(item.category?.slug) }]}>
                        <Text style={styles.nearbyBadgeText}>{item.listing_type === 'service' ? 'Service' : 'Rent'}</Text>
                      </View>
                      <Text numberOfLines={1} style={styles.nearbyTitle}>{item.title}</Text>
                      <Text style={styles.nearbyPrice}>{priceLabel(item)}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              )}
            </Animated.View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );

  function renderModeSegment(mode: ListingTab, label: string, icon: IconName, activeIcon: IconName) {
    const active = tab === mode;
    const inner = (
      <>
        <Ionicons name={active ? activeIcon : icon} size={13} color={active ? colors.ink : colors.surface} />
        <Text style={[styles.modeSegmentText, active && styles.modeSegmentTextActive]}>{label}</Text>
      </>
    );
    if (active) {
      return (
        <Pressable key={mode} onPress={() => setTab(mode)}>
          <LinearGradient
            colors={MODE_GRADIENTS[mode]}
            end={{ x: 1, y: 1 }}
            start={{ x: 0, y: 0 }}
            style={styles.modeSegmentActive}
          >
            {inner}
          </LinearGradient>
        </Pressable>
      );
    }
    return (
      <Pressable key={mode} onPress={() => setTab(mode)} style={styles.modeSegmentInactive}>
        {inner}
      </Pressable>
    );
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  mapPressable: { height: MAP_LAYER_HEIGHT, left: 0, position: 'absolute', right: 0, top: 0 },
  mapLayer: { bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 },
  mapScrim: {
    backgroundColor: 'rgba(8, 20, 18, 0.32)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  safeArea: { flex: 1 },
  content: { paddingBottom: 132 },
  mapHeaderSpace: {
    minHeight: MAP_LAYER_HEIGHT - 34,
    justifyContent: 'space-between',
    paddingBottom: radius.lg + 10,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  brandWrap: { position: 'relative' },
  brandOnMap: { color: colors.surface, fontSize: 17, fontWeight: '900' },
  brandAccent: { color: '#FFD23F' },
  brandShineClip: { bottom: 0, left: 0, overflow: 'hidden', position: 'absolute', top: 0 },
  brandShineText: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(255, 255, 255, 0.85)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  brandColumn: { flexShrink: 1 },
  locationRow: { alignItems: 'center', flexDirection: 'row', gap: 4, marginTop: 4, maxWidth: 220 },
  locationOnMap: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600', flexShrink: 1 },
  changeLocationText: { color: colors.signal, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  iconButton: {
    alignItems: 'center',
    backgroundColor: colors.paper,
    borderRadius: radius.pill,
    height: 36,
    justifyContent: 'center',
    marginLeft: 6,
    width: 36,
  },
  modeToggle: {
    backgroundColor: 'rgba(10, 25, 22, 0.45)',
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 3,
    padding: 3,
  },
  modeSegmentActive: {
    alignItems: 'center',
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: 5,
    minHeight: 30,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  modeSegmentInactive: {
    alignItems: 'center',
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: 5,
    minHeight: 30,
    paddingHorizontal: 12,
  },
  modeSegmentText: { color: colors.surface, fontSize: 12, fontWeight: '800' },
  modeSegmentTextActive: { color: colors.ink },
  mapCopy: { paddingHorizontal: 22, paddingTop: 8 },
  pilotLabel: {
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  heroTitle: { color: colors.surface, fontSize: 30, fontWeight: '900', marginTop: 6 },
  searchWrapper: { marginTop: 18, marginHorizontal: 20 },
  searchBox: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 2,
    flexDirection: 'row',
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 18,
    paddingRight: 8,
  },
  searchInput: { color: colors.ink, flex: 1, fontSize: 15 },
  searchResults: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    marginTop: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
  },
  searchResultRow: {
    alignItems: 'center',
    borderBottomColor: colors.line,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 10,
    padding: 10,
  },
  searchResultImage: { borderRadius: radius.sm, height: 40, width: 40 },
  searchResultImageFallback: {
    alignItems: 'center',
    backgroundColor: '#1C3430',
    borderRadius: radius.sm,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  searchResultCopy: { flex: 1 },
  searchResultTitle: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  searchResultPrice: { color: colors.teal, fontSize: 12, fontWeight: '600', marginTop: 2 },
  searchMoreRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
    paddingVertical: 12,
  },
  searchMoreText: { color: colors.teal, fontSize: 13, fontWeight: '800' },
  sheet: {
    backgroundColor: colors.paper,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    marginTop: -radius.lg,
    paddingTop: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  sectionHeading: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  eyebrow: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  sectionTitle: { color: colors.ink, fontSize: 22, fontWeight: '900', marginTop: 4 },
  viewAll: { color: colors.teal, fontSize: 14, fontWeight: '800' },
  categoryLoading: { marginTop: 24 },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  categoryTile: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 6,
    minHeight: 76,
    padding: 10,
    width: '48%',
  },
  categoryIconBadge: {
    alignItems: 'center',
    borderRadius: radius.sm,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  categoryName: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  nearbyRow: { gap: 12, paddingHorizontal: 20, paddingTop: 14 },
  nearbyCard: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: 'hidden',
    width: 152,
  },
  nearbyImage: { height: 88, width: '100%' },
  nearbyImageFallback: {
    alignItems: 'center',
    backgroundColor: '#1C3430',
    height: 88,
    justifyContent: 'center',
    width: '100%',
  },
  nearbyBadge: {
    borderRadius: radius.pill,
    left: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    position: 'absolute',
    top: 8,
  },
  nearbyBadgeText: { color: colors.surface, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  nearbyTitle: { color: colors.ink, fontSize: 13, fontWeight: '800', paddingHorizontal: 10, paddingTop: 8 },
  nearbyPrice: { color: colors.teal, fontSize: 12, fontWeight: '700', paddingBottom: 10, paddingHorizontal: 10, paddingTop: 2 },
  emptyState: {
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 16,
    marginHorizontal: 20,
    marginTop: 14,
    padding: 18,
  },
  emptyIcon: {
    alignItems: 'center',
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  emptyCopy: { flex: 1 },
  emptyTitle: { color: colors.ink, fontSize: 17, fontWeight: '800' },
  emptyMessage: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 5 },
});

