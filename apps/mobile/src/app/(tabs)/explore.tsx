import type { CategoryResponse, ListingResponse, QuoteRequest } from '@4by4/api-client';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from '@/components/GradientBackground';
import { translate } from '@4by4/i18n';

import { OpenMap } from '@/components/OpenMap';
import { apiClient } from '@/services/api';
import { useLocale } from '@/services/localeStore';
import { getAccessToken } from '@/services/sessionStore';
import { categoryColor, colors, radius } from '@/theme';
import { ListSkeleton } from '@/components/Skeleton';
import { SignInGate } from '@/components/SignInGate';

type ViewMode = 'list' | 'map';
type SortMode = 'newest' | 'price_low' | 'price_high';
type ListingTab = 'item' | 'service';
type PostedWithin = 'any' | 'today' | 'week' | 'month';
type IconName = keyof typeof Ionicons.glyphMap;

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

function categoryIcon(slug: string): IconName {
  return CATEGORY_ICONS[slug] ?? 'pricetag-outline';
}

const MODE_ACCENT: Record<ListingTab, string> = {
  item: '#FFB800',
  service: '#0BB768',
};

const POSTED_WITHIN_MS: Record<Exclude<PostedWithin, 'any'>, number> = {
  today: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
};

const POSTED_WITHIN_OPTIONS: { value: PostedWithin; labelKey: 'explore.anyTime' | 'explore.today' | 'explore.thisWeek' | 'explore.thisMonth' }[] = [
  { value: 'any', labelKey: 'explore.anyTime' },
  { value: 'today', labelKey: 'explore.today' },
  { value: 'week', labelKey: 'explore.thisWeek' },
  { value: 'month', labelKey: 'explore.thisMonth' },
];

const NAGERCOIL_CENTER = { latitude: 8.1833, longitude: 77.4119 };

function priceLabel(listing: ListingResponse): string {
  const price = listing.prices[0];
  if (!price) return 'Price unavailable';
  return `Rs. ${Math.round(price.amount_minor / 100).toLocaleString('en-IN')} / ${price.unit}`;
}

function nextSortMode(mode: SortMode): SortMode {
  if (mode === 'newest') return 'price_low';
  if (mode === 'price_low') return 'price_high';
  return 'newest';
}

function sortModeLabelKey(mode: SortMode): 'explore.newest' | 'explore.priceLow' | 'explore.priceHigh' {
  if (mode === 'newest') return 'explore.newest';
  if (mode === 'price_low') return 'explore.priceLow';
  return 'explore.priceHigh';
}

function defaultBookingStart(): Date {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(9, 0, 0, 0);
  return date;
}

function defaultBookingEnd(start: Date): Date {
  const date = new Date(start);
  date.setDate(date.getDate() + 1);
  date.setHours(17, 0, 0, 0);
  return date;
}

function mergePickerValue(base: Date, selected: Date, mode: 'date' | 'time'): Date {
  const merged = new Date(base);
  if (mode === 'date') {
    merged.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
  } else {
    merged.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
  }
  return merged;
}

function bookingDateLabel(date: Date): string {
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function bookingTimeLabel(date: Date): string {
  return date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}

export default function ExploreScreen() {
  const locale = useLocale();
  const params = useLocalSearchParams<{ category?: string; q?: string }>();
  const hasBootstrapped = useRef(false);
  const isFirstFocus = useRef(true);
  const [query, setQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [tab, setTab] = useState<ListingTab>('item');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [postedWithin, setPostedWithin] = useState<PostedWithin>('any');
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [selectedCategorySlug, setSelectedCategorySlug] = useState<string | null>(null);
  const [listings, setListings] = useState<ListingResponse[]>([]);
  const [selectedMapListing, setSelectedMapListing] = useState<ListingResponse | null>(null);
  const [bookingListingId, setBookingListingId] = useState('');
  const [bookingStart, setBookingStart] = useState<Date>(defaultBookingStart);
  const [bookingEnd, setBookingEnd] = useState<Date>(() => defaultBookingEnd(defaultBookingStart()));
  const [bookingQuantity, setBookingQuantity] = useState('1');
  const [activePicker, setActivePicker] = useState<{ field: 'start' | 'end'; mode: 'date' | 'time' } | null>(null);
  const [bookingBusy, setBookingBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const accent = MODE_ACCENT[tab];

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getAccessToken().then(async (token) => {
        if (!token) {
          if (active) {
            setSignedIn(false);
            setCurrentUserId(null);
          }
          return;
        }
        try {
          const user = await apiClient.getCurrentUser(token);
          if (active) {
            setCurrentUserId(user.id);
            setSignedIn(true);
          }
        } catch {
          if (active) setSignedIn(false);
        }
      });
      // Skip the very first focus: the mount-time bootstrap effect already loads listings.
      if (isFirstFocus.current) {
        isFirstFocus.current = false;
      } else {
        load(query, selectedCategorySlug);
      }
      return () => {
        active = false;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh listings on tab focus, e.g. after publishing
    }, [query, selectedCategorySlug]),
  );

  async function load(search: string, categorySlug: string | null) {
    setLoading(true);
    try {
      const category = categories.find((item) => item.slug === categorySlug);
      const token = await getAccessToken();
      setListings(
        await apiClient.searchListings(
          { categoryId: category?.id, limit: 40, query: search || undefined },
          token ?? undefined,
        ),
      );
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load inventory.');
    } finally {
      setLoading(false);
    }
  }

  function selectCategory(slug: string | null) {
    setSelectedCategorySlug(slug);
    load(query, slug);
  }

  useEffect(() => {
    let active = true;
    async function bootstrap() {
      try {
        const items = await apiClient.getCategories();
        if (!active) return;
        setCategories(items);
        const initialSlug = params.category ?? null;
        const initialQuery = params.q ?? '';
        setSelectedCategorySlug(initialSlug);
        setQuery(initialQuery);
        const category = items.find((entry) => entry.slug === initialSlug);
        const token = await getAccessToken();
        const results = await apiClient.searchListings(
          {
            categoryId: category?.id,
            limit: 40,
            query: initialQuery || undefined,
          },
          token ?? undefined,
        );
        if (active) setListings(results);
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : 'Unable to load inventory.');
      } finally {
        if (active) setLoading(false);
      }
    }
    bootstrap();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional one-time load using the initial deep-link params
  }, []);

  useEffect(() => {
    if (!hasBootstrapped.current) {
      hasBootstrapped.current = true;
      return;
    }
    if (categories.length === 0) return;
    const nextSlug = params.category ?? null;
    if (nextSlug === selectedCategorySlug) return;
    selectCategory(nextSlug);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-apply only when the navigation param changes
  }, [params.category]);

  const filteredListings = useMemo(() => {
    const min = Number(minPrice);
    const max = Number(maxPrice);
    const cutoff = postedWithin === 'any' ? null : Date.now() - POSTED_WITHIN_MS[postedWithin];
    const filtered = listings.filter((item) => {
      if (item.listing_type !== tab) return false;
      const amount = (item.prices[0]?.amount_minor ?? 0) / 100;
      if (minPrice && !Number.isNaN(min) && amount < min) return false;
      if (maxPrice && !Number.isNaN(max) && amount > max) return false;
      if (cutoff !== null && new Date(item.created_at).getTime() < cutoff) return false;
      return true;
    });
    if (sortMode === 'price_low') {
      return [...filtered].sort((a, b) => (a.prices[0]?.amount_minor ?? 0) - (b.prices[0]?.amount_minor ?? 0));
    }
    if (sortMode === 'price_high') {
      return [...filtered].sort((a, b) => (b.prices[0]?.amount_minor ?? 0) - (a.prices[0]?.amount_minor ?? 0));
    }
    return filtered;
  }, [listings, sortMode, tab, minPrice, maxPrice, postedWithin]);
  const mapListings = useMemo(
    () => filteredListings.filter((item) => item.latitude != null && item.longitude != null),
    [filteredListings],
  );

  async function requestBooking(listing: ListingResponse) {
    const token = await getAccessToken();
    const unit = listing.prices[0]?.unit;
    if (!token) {
      setError('Sign in from Account before requesting a booking.');
      return;
    }
    if (listing.owner_user_id === currentUserId) {
      setError('You cannot book your own listing.');
      setBookingListingId('');
      return;
    }
    const quantity = Number(bookingQuantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > listing.quantity) {
      setError(`Choose a quantity between 1 and ${listing.quantity}.`);
      return;
    }
    if (bookingEnd.getTime() <= bookingStart.getTime() || !['hour', 'day', 'week', 'month'].includes(unit ?? '')) {
      setError('Pick an end date and time after the start.');
      return;
    }
    setBookingBusy(true);
    setError('');
    setNotice('');
    try {
      const quote = await apiClient.createQuote(listing.id, {
        ends_at: bookingEnd.toISOString(),
        quantity,
        starts_at: bookingStart.toISOString(),
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

  function openBooking(listing: ListingResponse) {
    if (listing.owner_user_id === currentUserId) return;
    const start = defaultBookingStart();
    setBookingStart(start);
    setBookingEnd(defaultBookingEnd(start));
    setBookingQuantity('1');
    setActivePicker(null);
    setBookingListingId(listing.id);
  }

  const resultsCount = viewMode === 'map' ? mapListings.length : filteredListings.length;
  const activeFilterCount = (minPrice ? 1 : 0) + (maxPrice ? 1 : 0) + (postedWithin !== 'any' ? 1 : 0);

  function clearFilters() {
    setMinPrice('');
    setMaxPrice('');
    setPostedWithin('any');
  }

  if (signedIn === null) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
        <ActivityIndicator color={colors.teal} style={styles.gateSpinner} />
      </SafeAreaView>
    );
  }

  if (!signedIn) {
    return (
      <SignInGate
        icon="search"
        subtitle="Browse tools, equipment, and services near you after signing in to your 4by4 account."
        title="Sign in to explore listings"
      />
    );
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text accessibilityRole="header" style={styles.title}>{translate(locale, 'explore.title')}</Text>
          <View style={styles.modeToggle}>
            <Pressable
              onPress={() => setTab('item')}
              style={[styles.modeSegment, tab === 'item' && { backgroundColor: MODE_ACCENT.item }]}
            >
              <Ionicons name="pricetag-outline" size={13} color={tab === 'item' ? colors.ink : colors.muted} />
              <Text style={[styles.modeSegmentText, tab === 'item' && styles.modeSegmentTextActive]}>
                {translate(locale, 'home.rent')}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setTab('service')}
              style={[styles.modeSegment, tab === 'service' && { backgroundColor: MODE_ACCENT.service }]}
            >
              <Ionicons name="briefcase-outline" size={13} color={tab === 'service' ? colors.ink : colors.muted} />
              <Text style={[styles.modeSegmentText, tab === 'service' && styles.modeSegmentTextActive]}>
                {translate(locale, 'home.services')}
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={[styles.searchBox, { borderColor: accent }]}>
          <Ionicons name="search" size={19} color={colors.muted} />
          <TextInput
            onChangeText={setQuery}
            onSubmitEditing={() => load(query, selectedCategorySlug)}
            placeholder={translate(locale, 'explore.searchPlaceholder')}
            placeholderTextColor={colors.muted}
            returnKeyType="search"
            style={styles.input}
            value={query}
          />
          <View style={styles.searchDivider} />
          <Pressable
            accessibilityLabel="List view"
            onPress={() => setViewMode('list')}
            style={[styles.searchIconButton, viewMode === 'list' && styles.searchIconButtonActive]}
          >
            <Ionicons name="list-outline" size={17} color={viewMode === 'list' ? colors.ink : colors.muted} />
          </Pressable>
          <Pressable
            accessibilityLabel="Map view"
            onPress={() => setViewMode('map')}
            style={[styles.searchIconButton, viewMode === 'map' && styles.searchIconButtonActive]}
          >
            <Ionicons name="map-outline" size={17} color={viewMode === 'map' ? colors.ink : colors.muted} />
          </Pressable>
        </View>

        <View style={styles.categoryRow}>
          <ScrollView
            contentContainerStyle={styles.categoryChipRow}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoryChipScroll}
          >
            <Pressable
              onPress={() => selectCategory(null)}
              style={[styles.categoryChip, !selectedCategorySlug && styles.categoryChipActive]}
            >
              <Ionicons
                name="apps-outline"
                size={14}
                color={!selectedCategorySlug ? colors.surface : colors.muted}
              />
              <Text style={[styles.categoryChipText, !selectedCategorySlug && styles.categoryChipTextActive]}>All</Text>
            </Pressable>
            {categories.map((category) => {
              const active = category.slug === selectedCategorySlug;
              return (
                <Pressable
                  key={category.id}
                  onPress={() => selectCategory(active ? null : category.slug)}
                  style={[
                    styles.categoryChip,
                    { borderColor: categoryColor(category.slug) },
                    active && { backgroundColor: categoryColor(category.slug) },
                  ]}
                >
                  <Ionicons
                    name={categoryIcon(category.slug)}
                    size={14}
                    color={active ? colors.surface : categoryColor(category.slug)}
                  />
                  <Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]}>{category.name}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <Pressable
            accessibilityLabel="Filters"
            onPress={() => setFiltersOpen(true)}
            style={[styles.filtersIconButton, activeFilterCount > 0 && { backgroundColor: accent, borderColor: accent }]}
          >
            <Ionicons name="options-outline" size={18} color={colors.ink} />
            {activeFilterCount > 0 ? (
              <View style={styles.filterCountBadge}>
                <Text style={styles.filterCountBadgeText}>{activeFilterCount}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.metaText}>{resultsCount} nearby</Text>
          <Pressable onPress={() => setSortMode(nextSortMode(sortMode))} style={styles.metaSortButton}>
            <Ionicons name="swap-vertical" size={13} color={colors.muted} />
            <Text style={styles.metaSortText}>{translate(locale, sortModeLabelKey(sortMode))}</Text>
          </Pressable>
        </View>
      </View>
      {loading ? (
        <ListSkeleton />
      ) : viewMode === 'map' ? (
        <View style={styles.mapContainer}>
          <OpenMap
            center={NAGERCOIL_CENTER}
            markers={mapListings.map((item) => ({
              color: categoryColor(item.category.slug),
              coordinate: { latitude: item.latitude ?? 0, longitude: item.longitude ?? 0 },
              id: item.id,
              onPress: () => setSelectedMapListing(item),
            }))}
            style={styles.map}
            zoom={11}
          />
          {selectedMapListing ? (
            <Pressable
              onPress={() => router.push(`/listing/${selectedMapListing.id}`)}
              style={styles.mapPreview}
            >
              <View style={styles.mapPreviewCopy}>
                <Text numberOfLines={1} style={styles.calloutTitle}>{selectedMapListing.title}</Text>
                <Text style={styles.calloutPrice}>{priceLabel(selectedMapListing)}</Text>
                <Text numberOfLines={1} style={styles.calloutLocality}>{selectedMapListing.public_locality}</Text>
              </View>
              <View style={styles.mapPreviewAction}>
                <Text style={styles.mapPreviewActionText}>
                  {selectedMapListing.owner_user_id === currentUserId ? 'View' : 'View / book'}
                </Text>
                <Ionicons color={colors.teal} name="chevron-forward" size={16} />
              </View>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <FlatList
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={styles.list}
          data={filteredListings}
          keyExtractor={(item) => item.id}
          numColumns={2}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="search-outline" size={30} color={colors.signal} />
              <Text style={styles.emptyTitle}>{translate(locale, 'explore.noListings')}</Text>
              <Text style={styles.emptyMessage}>{error || 'Try another search or list an item nearby.'}</Text>
            </View>
          }
          ListHeaderComponent={notice ? <Text style={styles.notice}>{notice}</Text> : null}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Pressable onPress={() => router.push(`/listing/${item.id}`)}>
                <View style={styles.cardImageWrap}>
                  {item.images[0] ? (
                    <Image source={{ uri: item.images[0].url }} style={styles.cardImage} />
                  ) : (
                    <View style={[styles.cardImageFallback, { backgroundColor: categoryColor(item.category.slug) }]}>
                      <Ionicons
                        name={item.listing_type === 'service' ? 'person-outline' : 'cube-outline'}
                        size={26}
                        color={colors.surface}
                      />
                    </View>
                  )}
                  <View style={[styles.cardCategoryPill, { backgroundColor: categoryColor(item.category.slug) }]}>
                    <Text numberOfLines={1} style={styles.cardCategoryPillText}>{item.category.name}</Text>
                  </View>
                  {item.listing_type === 'service' ? (
                    <View style={styles.cardServicePill}>
                      <Text style={styles.cardServicePillText}>Now</Text>
                    </View>
                  ) : null}
                  <View style={styles.cardPricePill}>
                    <Text style={styles.cardPricePillText}>{priceLabel(item)}</Text>
                  </View>
                </View>
                <View style={styles.cardBody}>
                  <Text numberOfLines={1} style={styles.cardTitle}>{item.title}</Text>
                  <View style={styles.meta}>
                    <Ionicons name="location-outline" size={11} color={colors.muted} />
                    <Text numberOfLines={1} style={styles.locality}>{item.public_locality}</Text>
                  </View>
                </View>
              </Pressable>
              {bookingListingId === item.id ? (
                <View style={styles.bookingForm}>
                  <Text style={styles.bookingLabel}>Starts</Text>
                  <View style={styles.pickerRow}>
                    <Pressable onPress={() => setActivePicker({ field: 'start', mode: 'date' })} style={styles.pickerButton}>
                      <Ionicons color={colors.teal} name="calendar-outline" size={14} />
                      <Text style={styles.pickerButtonText}>{bookingDateLabel(bookingStart)}</Text>
                    </Pressable>
                    <Pressable onPress={() => setActivePicker({ field: 'start', mode: 'time' })} style={styles.pickerButton}>
                      <Ionicons color={colors.teal} name="time-outline" size={14} />
                      <Text style={styles.pickerButtonText}>{bookingTimeLabel(bookingStart)}</Text>
                    </Pressable>
                  </View>
                  <Text style={styles.bookingLabel}>Ends</Text>
                  <View style={styles.pickerRow}>
                    <Pressable onPress={() => setActivePicker({ field: 'end', mode: 'date' })} style={styles.pickerButton}>
                      <Ionicons color={colors.teal} name="calendar-outline" size={14} />
                      <Text style={styles.pickerButtonText}>{bookingDateLabel(bookingEnd)}</Text>
                    </Pressable>
                    <Pressable onPress={() => setActivePicker({ field: 'end', mode: 'time' })} style={styles.pickerButton}>
                      <Ionicons color={colors.teal} name="time-outline" size={14} />
                      <Text style={styles.pickerButtonText}>{bookingTimeLabel(bookingEnd)}</Text>
                    </Pressable>
                  </View>
                  {activePicker ? (
                    <DateTimePicker
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      mode={activePicker.mode}
                      onDismiss={() => setActivePicker(null)}
                      onValueChange={(_event, selected) => {
                        if (Platform.OS !== 'ios') setActivePicker(null);
                        const setter = activePicker.field === 'start' ? setBookingStart : setBookingEnd;
                        setter((current) => mergePickerValue(current, selected, activePicker.mode));
                      }}
                      value={activePicker.field === 'start' ? bookingStart : bookingEnd}
                    />
                  ) : null}
                  {activePicker && Platform.OS === 'ios' ? (
                    <Pressable onPress={() => setActivePicker(null)} style={styles.pickerDone}>
                      <Text style={styles.pickerDoneText}>Done</Text>
                    </Pressable>
                  ) : null}
                  <Text style={styles.bookingLabel}>Quantity available: {item.quantity}</Text>
                  <TextInput
                    keyboardType="number-pad"
                    onChangeText={setBookingQuantity}
                    placeholder="Quantity"
                    placeholderTextColor={colors.muted}
                    style={styles.dateInput}
                    value={bookingQuantity}
                  />
                  <View style={styles.actionRow}>
                    <Pressable
                      onPress={() => setBookingListingId('')}
                      style={styles.cancelButton}
                    >
                      <Text style={styles.cancelButtonText}>{translate(locale, 'listing.cancel')}</Text>
                    </Pressable>
                    <Pressable
                      disabled={bookingBusy}
                      onPress={() => requestBooking(item)}
                      style={[styles.iconAction, { backgroundColor: categoryColor(item.category.slug), flex: 1 }]}
                    >
                      {bookingBusy ? (
                        <ActivityIndicator color={colors.surface} />
                      ) : (
                        <Text style={styles.iconActionText}>{translate(locale, 'listing.sendRequest')}</Text>
                      )}
                    </Pressable>
                  </View>
                </View>
              ) : item.owner_user_id === currentUserId ? (
                <View style={styles.ownerListingRow}>
                  <Ionicons color={colors.teal} name="person-circle-outline" size={15} />
                  <Text style={styles.ownerListingText}>Your listing</Text>
                </View>
              ) : (
                <View style={styles.cardActions}>
                  <Pressable
                    accessibilityLabel="Request dates"
                    onPress={() => openBooking(item)}
                    style={[styles.iconAction, { backgroundColor: categoryColor(item.category.slug) }]}
                  >
                    <Ionicons name="calendar-outline" size={15} color={colors.surface} />
                    <Text style={styles.iconActionText}>Book</Text>
                  </Pressable>
                  <Pressable
                    accessibilityLabel="Chat with owner"
                    onPress={() => router.push({
                      pathname: '/listing-chat',
                      params: { listingId: item.id, title: item.title },
                    })}
                    style={styles.iconActionOutline}
                  >
                    <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.ink} />
                  </Pressable>
                </View>
              )}
            </View>
          )}
        />
      )}

      <Modal
        animationType="slide"
        onRequestClose={() => setFiltersOpen(false)}
        transparent
        visible={filtersOpen}
      >
        <View style={styles.modalRoot}>
          <Pressable accessibilityLabel="Close filters" onPress={() => setFiltersOpen(false)} style={styles.sheetBackdrop} />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{translate(locale, 'explore.filters')}</Text>
            <Text style={styles.filterLabel}>{translate(locale, 'explore.budget')}</Text>
            <View style={styles.filterBudgetRow}>
              <TextInput
                keyboardType="numeric"
                onChangeText={setMinPrice}
                placeholder={translate(locale, 'explore.minPrice')}
                placeholderTextColor={colors.muted}
                style={styles.filterBudgetInput}
                value={minPrice}
              />
              <TextInput
                keyboardType="numeric"
                onChangeText={setMaxPrice}
                placeholder={translate(locale, 'explore.maxPrice')}
                placeholderTextColor={colors.muted}
                style={styles.filterBudgetInput}
                value={maxPrice}
              />
            </View>
            <Text style={styles.filterLabel}>{translate(locale, 'explore.postedWithin')}</Text>
            <View style={styles.filterChipRow}>
              {POSTED_WITHIN_OPTIONS.map((option) => (
                <Pressable
                  key={option.value}
                  onPress={() => setPostedWithin(option.value)}
                  style={[styles.filterChip, postedWithin === option.value && { backgroundColor: accent, borderColor: accent }]}
                >
                  <Text style={styles.filterChipText}>{translate(locale, option.labelKey)}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.sheetActions}>
              <Pressable onPress={clearFilters} style={styles.filterClearButton}>
                <Text style={styles.filterClearText}>{translate(locale, 'explore.clearFilters')}</Text>
              </Pressable>
              <Pressable
                onPress={() => setFiltersOpen(false)}
                style={[styles.sheetApplyButton, { backgroundColor: accent }]}
              >
                <Text style={styles.sheetApplyText}>Apply</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.paper },
  gateSpinner: { marginTop: 60 },
  header: { paddingHorizontal: 20, paddingTop: 8 },
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  title: { color: colors.ink, fontSize: 22, fontWeight: '900', flexShrink: 1 },
  modeToggle: {
    backgroundColor: colors.line,
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: 2,
    padding: 3,
  },
  modeSegment: {
    alignItems: 'center',
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: 4,
    minHeight: 28,
    paddingHorizontal: 10,
  },
  modeSegmentText: { color: colors.muted, fontSize: 11, fontWeight: '800' },
  modeSegmentTextActive: { color: colors.ink },
  searchBox: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 9,
    marginTop: 12,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingRight: 6,
  },
  input: { color: colors.ink, flex: 1, fontSize: 15 },
  searchDivider: { backgroundColor: colors.line, height: 22, width: StyleSheet.hairlineWidth },
  searchIconButton: { alignItems: 'center', borderRadius: radius.pill, height: 34, justifyContent: 'center', width: 34 },
  searchIconButtonActive: { backgroundColor: colors.paper },
  categoryRow: { alignItems: 'center', flexDirection: 'row', gap: 8, marginTop: 10 },
  categoryChipScroll: { flex: 1 },
  categoryChipRow: { gap: 6, paddingRight: 12 },
  categoryChip: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    justifyContent: 'center',
    minHeight: 34,
    paddingHorizontal: 14,
  },
  categoryChipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  categoryChipText: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  categoryChipTextActive: { color: colors.surface },
  filtersIconButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  filterCountBadge: {
    alignItems: 'center',
    backgroundColor: colors.ink,
    borderRadius: radius.pill,
    height: 16,
    justifyContent: 'center',
    minWidth: 16,
    paddingHorizontal: 3,
    position: 'absolute',
    right: -4,
    top: -4,
  },
  filterCountBadgeText: { color: colors.surface, fontSize: 10, fontWeight: '900' },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  metaText: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  metaSortButton: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  metaSortText: { color: colors.muted, fontSize: 12, fontWeight: '800' },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  sheetBackdrop: {
    backgroundColor: 'rgba(8, 20, 18, 0.45)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    gap: 10,
    padding: 20,
    paddingBottom: 28,
  },
  sheetHandle: {
    alignSelf: 'center',
    backgroundColor: colors.line,
    borderRadius: 3,
    height: 4,
    marginBottom: 4,
    width: 40,
  },
  sheetTitle: { color: colors.ink, fontSize: 18, fontWeight: '900' },
  sheetActions: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  sheetApplyButton: { borderRadius: radius.pill, paddingHorizontal: 22, paddingVertical: 10 },
  sheetApplyText: { color: colors.ink, fontSize: 13, fontWeight: '900' },
  filterLabel: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  filterBudgetRow: { flexDirection: 'row', gap: 8 },
  filterBudgetInput: {
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: radius.sm,
    borderWidth: 1,
    color: colors.ink,
    flex: 1,
    fontSize: 13,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  filterChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  filterChip: {
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  filterChipText: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  filterClearButton: { alignSelf: 'flex-start' },
  filterClearText: { color: colors.muted, fontSize: 12, fontWeight: '800' },
  loading: { marginTop: 60 },
  mapContainer: { flex: 1 },
  map: { flex: 1 },
  mapPreview: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.md,
    borderWidth: 1,
    bottom: 18,
    elevation: 4,
    flexDirection: 'row',
    left: 16,
    padding: 12,
    position: 'absolute',
    right: 16,
  },
  mapPreviewCopy: { flex: 1, gap: 3 },
  mapPreviewAction: { alignItems: 'center', flexDirection: 'row', gap: 3 },
  mapPreviewActionText: { color: colors.teal, fontSize: 12, fontWeight: '900' },
  calloutTitle: { color: colors.ink, fontSize: 14, fontWeight: '900' },
  calloutPrice: { color: colors.teal, fontSize: 13, fontWeight: '700' },
  calloutLocality: { color: colors.muted, fontSize: 11 },
  list: { padding: 16, paddingBottom: 120 },
  columnWrapper: { gap: 12, marginBottom: 14 },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: 'hidden',
    width: '48%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  cardImageWrap: {
    aspectRatio: 1.15,
    backgroundColor: '#1C3430',
    width: '100%',
  },
  cardImage: { height: '100%', width: '100%' },
  cardImageFallback: {
    alignItems: 'center',
    height: '100%',
    justifyContent: 'center',
    width: '100%',
  },
  cardCategoryPill: {
    borderRadius: radius.pill,
    left: 8,
    maxWidth: '70%',
    paddingHorizontal: 8,
    paddingVertical: 3,
    position: 'absolute',
    top: 8,
  },
  cardCategoryPillText: { color: colors.surface, fontSize: 10, fontWeight: '800' },
  cardServicePill: {
    backgroundColor: colors.signal,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
    position: 'absolute',
    right: 8,
    top: 8,
  },
  cardServicePillText: { color: colors.ink, fontSize: 10, fontWeight: '900' },
  cardPricePill: {
    backgroundColor: 'rgba(8, 20, 18, 0.72)',
    borderRadius: radius.sm,
    bottom: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    position: 'absolute',
  },
  cardPricePillText: { color: colors.surface, fontSize: 12, fontWeight: '900' },
  cardBody: { gap: 4, padding: 10 },
  cardTitle: { color: colors.ink, fontSize: 13, fontWeight: '900' },
  meta: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  locality: { color: colors.muted, flexShrink: 1, fontSize: 11 },
  bookingForm: { gap: 8, padding: 10, paddingTop: 0 },
  bookingLabel: { color: colors.ink, fontSize: 11, fontWeight: '800' },
  pickerRow: { flexDirection: 'row', gap: 6 },
  pickerButton: {
    alignItems: 'center',
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: radius.sm,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
    minHeight: 38,
  },
  pickerButtonText: { color: colors.ink, fontSize: 11, fontWeight: '700' },
  pickerDone: { alignItems: 'center', paddingVertical: 6 },
  pickerDoneText: { color: colors.teal, fontSize: 12, fontWeight: '900' },
  dateInput: {
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: radius.sm,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 12,
    minHeight: 38,
    paddingHorizontal: 10,
  },
  actionRow: { flexDirection: 'row', gap: 8 },
  cardActions: { flexDirection: 'row', gap: 6, padding: 10, paddingTop: 0 },
  ownerListingRow: { alignItems: 'center', flexDirection: 'row', gap: 5, padding: 10, paddingTop: 0 },
  ownerListingText: { color: colors.teal, fontSize: 12, fontWeight: '800' },
  iconAction: {
    alignItems: 'center',
    borderRadius: radius.sm,
    flex: 1,
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
    minHeight: 34,
  },
  iconActionText: { color: colors.surface, fontSize: 12, fontWeight: '900' },
  iconActionOutline: {
    alignItems: 'center',
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: radius.sm,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 34,
    width: 34,
  },
  cancelButton: {
    alignItems: 'center',
    borderColor: colors.line,
    borderRadius: radius.sm,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 38,
    paddingHorizontal: 16,
  },
  cancelButtonText: { color: colors.muted, fontSize: 13, fontWeight: '800' },
  notice: {
    backgroundColor: '#FFF8E1',
    borderLeftColor: colors.signal,
    borderLeftWidth: 3,
    borderRadius: radius.sm,
    color: colors.ink,
    marginBottom: 12,
    padding: 12,
  },
  empty: { alignItems: 'center', gap: 9, marginTop: 60, padding: 30 },
  emptyTitle: { color: colors.ink, fontSize: 20, fontWeight: '900' },
  emptyMessage: { color: colors.muted, textAlign: 'center' },
});

