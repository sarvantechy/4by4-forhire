import type { BookingResponse, CategoryResponse, ListingResponse, ListingUpdateRequest, QuoteRequest, StoreOwnerResponse } from '@4by4/api-client';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { File as ExpoFile } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
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
import { DetailSkeleton } from '@/components/Skeleton';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CONDITIONS = ['new', 'like_new', 'good', 'fair'] as const;
const PRICE_UNITS = ['hour', 'day', 'week', 'month'] as const;
type Condition = (typeof CONDITIONS)[number];
type PriceUnit = (typeof PRICE_UNITS)[number];

function priceLine(unit: string, amountMinor: number): string {
  return `Rs. ${Math.round(amountMinor / 100).toLocaleString('en-IN')} / ${unit}`;
}

function titleCase(key: string): string {
  return key.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function attributeText(value: unknown): string {
  if (value == null) return '';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

function defaultStart(): Date {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(9, 0, 0, 0);
  return date;
}

function defaultEnd(start: Date): Date {
  const date = new Date(start);
  date.setDate(date.getDate() + 1);
  date.setHours(17, 0, 0, 0);
  return date;
}

function withDatePart(base: Date, next: Date): Date {
  const merged = new Date(base);
  merged.setFullYear(next.getFullYear(), next.getMonth(), next.getDate());
  return merged;
}

function withTimePart(base: Date, next: Date): Date {
  const merged = new Date(base);
  merged.setHours(next.getHours(), next.getMinutes(), 0, 0);
  return merged;
}

function formatDatePart(date: Date): string {
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', weekday: 'short', year: 'numeric' });
}

function formatTimePart(date: Date): string {
  return date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}

function estimatePeriods(unit: string, start: Date, end: Date): number {
  const minutes = Math.max(0, (end.getTime() - start.getTime()) / 60000);
  const perUnit: Record<string, number> = { day: 1440, hour: 60, month: 43200, week: 10080 };
  return Math.max(1, Math.ceil(minutes / (perUnit[unit] ?? 1440)));
}

export default function ListingDetailScreen() {
  const locale = useLocale();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [listing, setListing] = useState<ListingResponse | null>(null);
  const [relatedListings, setRelatedListings] = useState<ListingResponse[]>([]);
  const [activeImage, setActiveImage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [booking, setBooking] = useState(false);
  const [startDate, setStartDate] = useState<Date>(defaultStart);
  const [endDate, setEndDate] = useState<Date>(() => defaultEnd(defaultStart()));
  const [activePicker, setActivePicker] = useState<{ field: 'start' | 'end'; mode: 'date' | 'time' } | null>(null);
  const [bookingBusy, setBookingBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const [bargaining, setBargaining] = useState(false);
  const [offerStartsOn, setOfferStartsOn] = useState('');
  const [offerEndsOn, setOfferEndsOn] = useState('');
  const [offerAmount, setOfferAmount] = useState('');
  const [offerReason, setOfferReason] = useState('');
  const [offerBusy, setOfferBusy] = useState(false);
  const [bookingNote, setBookingNote] = useState('');

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [existingBooking, setExistingBooking] = useState<BookingResponse | null>(null);

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editLocality, setEditLocality] = useState('');
  const [editQuantity, setEditQuantity] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('');
  const [editCondition, setEditCondition] = useState<Condition>('good');
  const [editSkill, setEditSkill] = useState('');
  const [editPickup, setEditPickup] = useState(true);
  const [editDelivery, setEditDelivery] = useState(false);
  const [editLatitude, setEditLatitude] = useState('');
  const [editLongitude, setEditLongitude] = useState('');
  const [editPriceUnit, setEditPriceUnit] = useState<PriceUnit>('day');
  const [editPrice, setEditPrice] = useState('');
  const [editDeposit, setEditDeposit] = useState('');
  const [editStoreId, setEditStoreId] = useState<string | null>(null);
  const [editPhotos, setEditPhotos] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [stores, setStores] = useState<StoreOwnerResponse[]>([]);
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState('');

  useEffect(() => {
    let active = true;
    getAccessToken()
      .then((token) => apiClient.getListing(id, token ?? undefined))
      .then((result) => active && setListing(result))
      .catch((caught) => active && setError(caught instanceof Error ? caught.message : 'Unable to load this listing.'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    if (!listing) return;
    let active = true;
    apiClient.searchListings({ categoryId: listing.category.id, limit: 10 })
      .then((results) => active && setRelatedListings(results.filter((item) => item.id !== listing.id)))
      .catch(() => active && setRelatedListings([]));
    return () => {
      active = false;
    };
  }, [listing]);

  useEffect(() => {
    if (!listing) return;
    let active = true;
    getAccessToken().then(async (token) => {
      if (!token) return;
      try {
        const [profile, bookings, availableCategories, ownedStores] = await Promise.all([
          apiClient.getCurrentUser(token),
          apiClient.listBookings(token),
          apiClient.getCategories(),
          apiClient.listMyStores(token),
        ]);
        if (!active) return;
        setCurrentUserId(profile.id);
        setCategories(availableCategories);
        setStores(ownedStores.filter((store) => store.status === 'active'));
        const openStatuses = new Set(['requested', 'accepted', 'ready_for_handover', 'active', 'return_pending', 'inspection', 'overdue', 'disputed']);
        const match = bookings.find(
          (item) => item.listing_id === listing.id && item.renter_user_id === profile.id && openStatuses.has(item.status),
        );
        setExistingBooking(match ?? null);
      } catch {
        // Ignore — booking/owner context is a progressive enhancement, not required to view a listing.
      }
    });
    return () => {
      active = false;
    };
  }, [listing]);

  function openEdit() {
    if (!listing) return;
    setEditTitle(listing.title);
    setEditDescription(listing.description);
    setEditLocality(listing.public_locality);
    setEditQuantity(String(listing.quantity));
    setEditCategoryId(listing.category.id);
    setEditCondition(CONDITIONS.includes(listing.condition as Condition) ? listing.condition as Condition : 'good');
    setEditSkill(typeof listing.attributes?.skill === 'string' ? listing.attributes.skill : '');
    setEditPickup(listing.pickup_enabled);
    setEditDelivery(listing.delivery_enabled);
    setEditLatitude(String(listing.latitude ?? ''));
    setEditLongitude(String(listing.longitude ?? ''));
    setEditPriceUnit((listing.prices[0]?.unit as PriceUnit | undefined) ?? 'day');
    setEditPrice(String((listing.prices[0]?.amount_minor ?? 0) / 100));
    setEditDeposit(String((listing.prices[0]?.deposit_minor ?? 0) / 100));
    setEditStoreId(listing.store?.id ?? null);
    setEditPhotos([]);
    setEditError('');
    setEditing(true);
  }

  async function submitEdit() {
    if (!listing) return;
    const token = await getAccessToken();
    if (!token) {
      setEditError('Sign in from Account before editing this listing.');
      return;
    }
    const quantity = Number(editQuantity);
    const amount = Number(editPrice);
    const deposit = Number(editDeposit || '0');
    const latitude = Number(editLatitude);
    const longitude = Number(editLongitude);
    if (!editTitle.trim() || !editDescription.trim() || !editLocality.trim()) {
      setEditError('Title, description, and locality cannot be empty.');
      return;
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1000) {
      setEditError('Enter a quantity between 1 and 1000.');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(deposit) || deposit < 0) {
      setEditError('Enter a valid rental price and deposit.');
      return;
    }
    if (!editPickup && !editDelivery) {
      setEditError('Enable pickup or delivery.');
      return;
    }
    if (!editLatitude.trim() || !editLongitude.trim() || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setEditError('Choose a valid listing location.');
      return;
    }
    if (listing.listing_type === 'service' && editSkill.trim().length < 3) {
      setEditError('Describe the skill or work you are offering.');
      return;
    }
    setEditBusy(true);
    setEditError('');
    try {
      const payload: ListingUpdateRequest = {
        attributes: listing.listing_type === 'service'
          ? { ...listing.attributes, skill: editSkill.trim() }
          : listing.attributes,
        category_id: editCategoryId,
        condition: listing.listing_type === 'item' ? editCondition : undefined,
        delivery_enabled: editDelivery,
        title: editTitle.trim(),
        description: editDescription.trim(),
        latitude,
        longitude,
        pickup_enabled: editPickup,
        prices: [{
          amount_minor: Math.round(amount * 100),
          currency: 'INR',
          deposit_minor: Math.round(deposit * 100),
          unit: editPriceUnit,
        }],
        public_locality: editLocality.trim(),
        quantity,
        version: listing.version,
      };
      let updated = await apiClient.updateListing(listing.id, payload, undefined, token);
      if (editStoreId !== (listing.store?.id ?? null)) {
        updated = await apiClient.assignListingStore(listing.id, {
          listing_version: updated.version,
          store_id: editStoreId,
        }, undefined, token);
      }
      for (const photo of editPhotos) {
        updated = await apiClient.uploadListingImage(
          listing.id,
          new ExpoFile(photo.uri),
          undefined,
          token,
        );
      }
      setListing(updated);
      setEditing(false);
    } catch (caught) {
      setEditError(caught instanceof Error ? caught.message : 'Unable to update this listing.');
    } finally {
      setEditBusy(false);
    }
  }

  async function pickEditPhotos() {
    if (!listing) return;
    const maximumNewPhotos = 8 - listing.images.length;
    const remaining = maximumNewPhotos - editPhotos.length;
    if (remaining <= 0) {
      setEditError('A listing can have up to 8 photos.');
      return;
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setEditError('Photo library access is needed to add listing photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      mediaTypes: ['images'],
      quality: 0.7,
      selectionLimit: remaining,
    });
    if (!result.canceled) {
      setEditPhotos((current) => [...current, ...result.assets].slice(0, maximumNewPhotos));
    }
  }

  async function removeExistingImage(imageId: string) {
    if (!listing) return;
    const token = await getAccessToken();
    if (!token) return;
    setEditBusy(true);
    setEditError('');
    try {
      await apiClient.deleteListingImage(listing.id, imageId, undefined, token);
      setListing(await apiClient.getListing(listing.id, token));
    } catch (error_) {
      setEditError(error_ instanceof Error ? error_.message : 'Unable to remove this photo.');
    } finally {
      setEditBusy(false);
    }
  }

  async function requestBooking() {
    if (!listing) return;
    const token = await getAccessToken();
    const unit = listing.prices[0]?.unit;
    if (!token) {
      setError('Sign in from Account before requesting a booking.');
      return;
    }
    if (!['hour', 'day', 'week', 'month'].includes(unit ?? '') || endDate.getTime() <= startDate.getTime()) {
      setError('Pick an end date and time after the start.');
      return;
    }
    setBookingBusy(true);
    setError('');
    setNotice('');
    try {
      const quote = await apiClient.createQuote(listing.id, {
        ends_at: endDate.toISOString(),
        quantity: 1,
        starts_at: startDate.toISOString(),
        unit: unit as QuoteRequest['unit'],
      }, undefined, token);
      const created = await apiClient.createBooking({
        fulfillment_method: 'pickup',
        quote_id: quote.id,
        note: bookingNote.trim() || undefined,
      }, undefined, token);
      setNotice(`${created.public_number} sent to the owner.`);
      setExistingBooking(created);
      setBooking(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to request this booking.');
    } finally {
      setBookingBusy(false);
    }
  }

  async function submitOffer() {
    if (!listing) return;
    const token = await getAccessToken();
    const unit = listing.prices[0]?.unit;
    if (!token) {
      setError('Sign in from Account before making an offer.');
      return;
    }
    const amountRupees = Number(offerAmount);
    if (!offerStartsOn || !offerEndsOn || !['hour', 'day', 'week', 'month'].includes(unit ?? '')) {
      setError('Enter valid start and end dates as YYYY-MM-DD.');
      return;
    }
    if (!Number.isFinite(amountRupees) || amountRupees <= 0) {
      setError('Enter the price you would like to offer.');
      return;
    }
    if (offerReason.trim().length < 3) {
      setError('Tell the owner why you are proposing this price.');
      return;
    }
    setOfferBusy(true);
    setError('');
    setNotice('');
    try {
      await apiClient.createOffer(listing.id, {
        ends_at: new Date(`${offerEndsOn}T17:00:00`).toISOString(),
        fulfillment_method: 'pickup',
        proposed_amount_minor: Math.round(amountRupees * 100),
        quantity: 1,
        reason: offerReason.trim(),
        starts_at: new Date(`${offerStartsOn}T09:00:00`).toISOString(),
        unit: unit as QuoteRequest['unit'],
      }, undefined, token);
      setNotice('Your offer was sent to the owner.');
      setBargaining(false);
      setOfferAmount('');
      setOfferReason('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to send this offer.');
    } finally {
      setOfferBusy(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
        <DetailSkeleton />
      </SafeAreaView>
    );
  }

  if (!listing) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.iconButton}>
            <Ionicons name="chevron-back" size={22} color={colors.ink} />
          </Pressable>
        </View>
        <Text style={styles.errorText}>{error || 'Listing not found.'}</Text>
      </SafeAreaView>
    );
  }

  const accent = categoryColor(listing.category.slug);
  const isOwner = currentUserId != null && currentUserId === listing.owner_user_id;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.gallery}>
          {listing.images.length > 0 ? (
            <>
              <FlatList
                data={listing.images}
                horizontal
                keyExtractor={(image) => image.id}
                onMomentumScrollEnd={(event) => {
                  const index = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
                  setActiveImage(index);
                }}
                pagingEnabled
                renderItem={({ item }) => (
                  <Image source={{ uri: item.url }} style={styles.galleryImage} />
                )}
                showsHorizontalScrollIndicator={false}
              />
              {listing.images.length > 1 ? (
                <View style={styles.dotsRow}>
                  {listing.images.map((image, index) => (
                    <View
                      key={image.id}
                      style={[styles.dot, index === activeImage && [styles.dotActive, { backgroundColor: accent }]]}
                    />
                  ))}
                </View>
              ) : null}
            </>
          ) : (
            <View style={[styles.galleryFallback, { backgroundColor: accent }]}>
              <Ionicons
                name={listing.listing_type === 'service' ? 'person-outline' : 'cube-outline'}
                size={48}
                color={colors.surface}
              />
            </View>
          )}
          <Pressable onPress={() => router.back()} style={styles.backFloating}>
            <Ionicons name="chevron-back" size={22} color={colors.ink} />
          </Pressable>
          {isOwner ? (
            <Pressable onPress={openEdit} style={styles.editFloating}>
              <Ionicons name="pencil" size={18} color={colors.ink} />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.body}>
          <View style={styles.badgeRow}>
            <View style={[styles.categoryBadge, { backgroundColor: accent }]}>
              <Text style={styles.categoryBadgeText}>{listing.category.name}</Text>
            </View>
            {listing.listing_type === 'service' ? (
              <View style={styles.serviceBadge}>
                <Text style={styles.serviceBadgeText}>Available now</Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.title}>{listing.title}</Text>

          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={14} color={colors.muted} />
            <Text style={styles.metaText}>{listing.public_locality}</Text>
          </View>

          <View style={styles.priceRow}>
            {listing.prices.map((price) => (
              <View key={price.id} style={styles.priceChip}>
                <Text style={styles.priceChipText}>{priceLine(price.unit, price.amount_minor)}</Text>
                {price.deposit_minor > 0 ? (
                  <Text style={styles.depositText}>
                    +Rs. {Math.round(price.deposit_minor / 100).toLocaleString('en-IN')} deposit
                  </Text>
                ) : null}
              </View>
            ))}
          </View>

          {!booking && !bargaining && !isOwner ? (
            <Pressable onPress={() => setBargaining(true)} style={styles.bargainLink}>
              <Ionicons name="pricetag-outline" size={14} color={colors.teal} />
              <Text style={styles.bargainLinkText}>Make an offer / bargain</Text>
            </Pressable>
          ) : null}

          <View style={styles.capabilityRow}>
            {listing.pickup_enabled ? (
              <View style={styles.capabilityChip}>
                <Ionicons name="walk-outline" size={13} color={colors.ink} />
                <Text style={styles.capabilityChipText}>Self pickup</Text>
              </View>
            ) : null}
            {listing.delivery_enabled ? (
              <View style={styles.capabilityChip}>
                <Ionicons name="bicycle-outline" size={13} color={colors.ink} />
                <Text style={styles.capabilityChipText}>Delivery available</Text>
              </View>
            ) : null}
            {listing.condition ? (
              <View style={styles.capabilityChip}>
                <Ionicons name="checkmark-circle-outline" size={13} color={colors.ink} />
                <Text style={styles.capabilityChipText}>{titleCase(listing.condition)}</Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.description}>{listing.description}</Text>

          {Object.keys(listing.attributes ?? {}).length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>Details</Text>
              <View style={styles.attributeList}>
                {Object.entries(listing.attributes).map(([key, value]) => (
                  <View key={key} style={styles.attributeRow}>
                    <Text style={styles.attributeKey}>{titleCase(key)}</Text>
                    <Text style={styles.attributeValue}>{attributeText(value)}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : null}

          {bargaining ? (
            <View style={styles.bookingForm}>
              <Text style={styles.sectionTitle}>Make an offer</Text>
              <TextInput
                onChangeText={setOfferStartsOn}
                placeholder="Start YYYY-MM-DD"
                placeholderTextColor={colors.muted}
                style={styles.dateInput}
                value={offerStartsOn}
              />
              <TextInput
                onChangeText={setOfferEndsOn}
                placeholder="End YYYY-MM-DD"
                placeholderTextColor={colors.muted}
                style={styles.dateInput}
                value={offerEndsOn}
              />
              <TextInput
                keyboardType="numeric"
                onChangeText={setOfferAmount}
                placeholder="Your price in Rs."
                placeholderTextColor={colors.muted}
                style={styles.dateInput}
                value={offerAmount}
              />
              <TextInput
                multiline
                numberOfLines={3}
                onChangeText={setOfferReason}
                placeholder="Why should the owner accept this price?"
                placeholderTextColor={colors.muted}
                style={[styles.dateInput, styles.reasonInput]}
                value={offerReason}
              />
              <View style={styles.formActions}>
                <Pressable onPress={() => setBargaining(false)} style={styles.cancelButton}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </Pressable>
                <Pressable
                  disabled={offerBusy}
                  onPress={submitOffer}
                  style={[styles.submitButton, { backgroundColor: accent }]}
                >
                  {offerBusy ? (
                    <ActivityIndicator color={colors.surface} />
                  ) : (
                    <Text style={styles.submitButtonText}>Send offer</Text>
                  )}
                </Pressable>
              </View>
            </View>
          ) : null}

          {notice ? <Text style={styles.notice}>{notice}</Text> : null}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {relatedListings.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>{translate(locale, 'listing.relatedItems')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.relatedRow}>
                {relatedListings.map((item) => (
                  <Pressable
                    key={item.id}
                    onPress={() => router.push(`/listing/${item.id}`)}
                    style={styles.relatedCard}
                  >
                    {item.images[0] ? (
                      <Image source={{ uri: item.images[0].url }} style={styles.relatedImage} />
                    ) : (
                      <View style={[styles.relatedImageFallback, { backgroundColor: categoryColor(item.category.slug) }]}>
                        <Ionicons
                          name={item.listing_type === 'service' ? 'person-outline' : 'cube-outline'}
                          size={20}
                          color={colors.surface}
                        />
                      </View>
                    )}
                    <Text numberOfLines={1} style={styles.relatedTitle}>{item.title}</Text>
                    <Text style={styles.relatedPrice}>{priceLine(item.prices[0]?.unit ?? '', item.prices[0]?.amount_minor ?? 0)}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </>
          ) : null}
        </View>
      </ScrollView>

      {!booking && !bargaining && isOwner ? (
        <View style={styles.actionBar}>
          <Pressable onPress={openEdit} style={[styles.requestButton, { backgroundColor: accent, flex: 1 }]}>
            <Ionicons name="pencil" size={16} color={colors.surface} />
            <Text style={styles.requestButtonText}>Edit listing</Text>
          </Pressable>
        </View>
      ) : null}

      {!booking && !bargaining && !isOwner && existingBooking ? (
        <View style={styles.actionBar}>
          <View style={styles.alreadyRequestedInfo}>
            <Ionicons name="checkmark-circle" size={16} color={colors.teal} />
            <Text style={styles.alreadyRequestedText}>
              Already requested \u00b7 {existingBooking.status.replaceAll('_', ' ')}
            </Text>
          </View>
          <Pressable
            onPress={() => router.push(`/booking/${existingBooking.id}`)}
            style={[styles.requestButton, { backgroundColor: accent }]}
          >
            <Ionicons name="eye-outline" size={16} color={colors.surface} />
            <Text style={styles.requestButtonText}>View request</Text>
          </Pressable>
        </View>
      ) : null}

      {!booking && !bargaining && !isOwner && !existingBooking ? (
        <View style={styles.actionBar}>
          <Pressable
            onPress={() => router.push({
              pathname: '/listing-chat',
              params: { listingId: listing.id, ownerId: listing.owner_user_id, title: listing.title },
            })}
            style={styles.chatButton}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.ink} />
            <Text style={styles.chatButtonText}>Chat</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              const start = defaultStart();
              setStartDate(start);
              setEndDate(defaultEnd(start));
              setBookingNote('');
              setBooking(true);
            }}
            style={[styles.requestButton, { backgroundColor: accent }]}
          >
            <Ionicons name="calendar-outline" size={16} color={colors.surface} />
            <Text style={styles.requestButtonText}>Request dates</Text>
          </Pressable>
        </View>
      ) : null}

      <Modal animationType="slide" onRequestClose={() => setBooking(false)} presentationStyle="pageSheet" visible={booking}>
        <SafeAreaView edges={['top', 'left', 'right']} style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Request to book</Text>
            <Pressable onPress={() => setBooking(false)} style={styles.modalClose}>
              <Ionicons name="close" size={22} color={colors.ink} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <View style={styles.modalListingCard}>
              {listing.images[0] ? (
                <Image source={{ uri: listing.images[0].url }} style={styles.modalListingImage} />
              ) : (
                <View style={[styles.modalListingImage, styles.modalListingImageFallback, { backgroundColor: accent }]}>
                  <Ionicons
                    color={colors.surface}
                    name={listing.listing_type === 'service' ? 'person-outline' : 'cube-outline'}
                    size={20}
                  />
                </View>
              )}
              <View style={styles.modalListingInfo}>
                <Text numberOfLines={1} style={styles.modalListingTitle}>{listing.title}</Text>
                <Text style={styles.modalListingPrice}>
                  {priceLine(listing.prices[0]?.unit ?? '', listing.prices[0]?.amount_minor ?? 0)}
                </Text>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Starts</Text>
            <View style={styles.pickerRow}>
              <Pressable
                onPress={() => setActivePicker({ field: 'start', mode: 'date' })}
                style={styles.pickerPill}
              >
                <Ionicons color={colors.teal} name="calendar-outline" size={15} />
                <Text style={styles.pickerPillText}>{formatDatePart(startDate)}</Text>
              </Pressable>
              <Pressable
                onPress={() => setActivePicker({ field: 'start', mode: 'time' })}
                style={styles.pickerPill}
              >
                <Ionicons color={colors.teal} name="time-outline" size={15} />
                <Text style={styles.pickerPillText}>{formatTimePart(startDate)}</Text>
              </Pressable>
            </View>

            <Text style={styles.sectionTitle}>Ends</Text>
            <View style={styles.pickerRow}>
              <Pressable
                onPress={() => setActivePicker({ field: 'end', mode: 'date' })}
                style={styles.pickerPill}
              >
                <Ionicons color={colors.teal} name="calendar-outline" size={15} />
                <Text style={styles.pickerPillText}>{formatDatePart(endDate)}</Text>
              </Pressable>
              <Pressable
                onPress={() => setActivePicker({ field: 'end', mode: 'time' })}
                style={styles.pickerPill}
              >
                <Ionicons color={colors.teal} name="time-outline" size={15} />
                <Text style={styles.pickerPillText}>{formatTimePart(endDate)}</Text>
              </Pressable>
            </View>

            {activePicker ? (
              <DateTimePicker
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                mode={activePicker.mode}
                onDismiss={() => setActivePicker(null)}
                onValueChange={(_event, selected) => {
                  if (Platform.OS !== 'ios') setActivePicker(null);
                  const setter = activePicker.field === 'start' ? setStartDate : setEndDate;
                  const merge = activePicker.mode === 'date' ? withDatePart : withTimePart;
                  setter((current) => merge(current, selected));
                }}
                value={activePicker.field === 'start' ? startDate : endDate}
              />
            ) : null}
            {activePicker && Platform.OS === 'ios' ? (
              <Pressable onPress={() => setActivePicker(null)} style={styles.pickerDone}>
                <Text style={styles.pickerDoneText}>Done</Text>
              </Pressable>
            ) : null}

            <Text style={styles.sectionTitle}>Note for the owner (optional)</Text>
            <TextInput
              multiline
              numberOfLines={3}
              onChangeText={setBookingNote}
              placeholder="e.g. I'll need it for a birthday event, can you include the tripod?"
              placeholderTextColor={colors.muted}
              style={[styles.dateInput, styles.reasonInput]}
              value={bookingNote}
            />

            <View style={styles.estimateCard}>
              <Text style={styles.estimateLabel}>Estimated total</Text>
              <Text style={styles.estimateValue}>
                Rs. {(
                  estimatePeriods(listing.prices[0]?.unit ?? 'day', startDate, endDate)
                  * Math.round((listing.prices[0]?.amount_minor ?? 0) / 100)
                ).toLocaleString('en-IN')}
              </Text>
              {listing.prices[0]?.deposit_minor ? (
                <Text style={styles.estimateDeposit}>
                  +Rs. {Math.round((listing.prices[0]?.deposit_minor ?? 0) / 100).toLocaleString('en-IN')} refundable deposit at pickup
                </Text>
              ) : null}
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Pressable
              disabled={bookingBusy}
              onPress={requestBooking}
              style={[styles.submitButton, styles.modalSubmit, { backgroundColor: accent }]}
            >
              {bookingBusy ? (
                <ActivityIndicator color={colors.surface} />
              ) : (
                <Text style={styles.submitButtonText}>Send request</Text>
              )}
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal animationType="slide" onRequestClose={() => setEditing(false)} presentationStyle="pageSheet" visible={editing}>
        <SafeAreaView edges={['top', 'left', 'right']} style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit listing</Text>
            <Pressable onPress={() => setEditing(false)} style={styles.modalClose}>
              <Ionicons name="close" size={22} color={colors.ink} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text style={styles.sectionTitle}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.editChipRow}>
              {categories.map((category) => (
                <Pressable
                  key={category.id}
                  onPress={() => setEditCategoryId(category.id)}
                  style={[styles.editChip, editCategoryId === category.id && styles.editChipActive]}
                >
                  <Text style={[styles.editChipText, editCategoryId === category.id && styles.editChipTextActive]}>{category.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Text style={styles.sectionTitle}>Title</Text>
            <TextInput
              onChangeText={setEditTitle}
              placeholder="Listing title"
              placeholderTextColor={colors.muted}
              style={styles.dateInput}
              value={editTitle}
            />
            <Text style={styles.sectionTitle}>Description</Text>
            <TextInput
              multiline
              numberOfLines={4}
              onChangeText={setEditDescription}
              placeholder="Describe the item or service"
              placeholderTextColor={colors.muted}
              style={[styles.dateInput, styles.reasonInput]}
              value={editDescription}
            />
            {listing.listing_type === 'item' ? (
              <>
                <Text style={styles.sectionTitle}>Condition</Text>
                <View style={styles.editChipRow}>
                  {CONDITIONS.map((condition) => (
                    <Pressable
                      key={condition}
                      onPress={() => setEditCondition(condition)}
                      style={[styles.editChip, editCondition === condition && styles.editChipActive]}
                    >
                      <Text style={[styles.editChipText, editCondition === condition && styles.editChipTextActive]}>{titleCase(condition)}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : (
              <>
                <Text style={styles.sectionTitle}>Skill / work offered</Text>
                <TextInput onChangeText={setEditSkill} placeholder="Skill or service" placeholderTextColor={colors.muted} style={styles.dateInput} value={editSkill} />
              </>
            )}
            <Text style={styles.sectionTitle}>Locality</Text>
            <TextInput
              onChangeText={setEditLocality}
              placeholder="Public locality"
              placeholderTextColor={colors.muted}
              style={styles.dateInput}
              value={editLocality}
            />
            <Text style={styles.sectionTitle}>Quantity</Text>
            <TextInput
              keyboardType="numeric"
              onChangeText={setEditQuantity}
              placeholder="Quantity"
              placeholderTextColor={colors.muted}
              style={styles.dateInput}
              value={editQuantity}
            />

            <Text style={styles.sectionTitle}>Price unit</Text>
            <View style={styles.editChipRow}>
              {PRICE_UNITS.map((unit) => (
                <Pressable key={unit} onPress={() => setEditPriceUnit(unit)} style={[styles.editChip, editPriceUnit === unit && styles.editChipActive]}>
                  <Text style={[styles.editChipText, editPriceUnit === unit && styles.editChipTextActive]}>per {unit}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.sectionTitle}>Rental price (INR)</Text>
            <TextInput keyboardType="numeric" onChangeText={setEditPrice} placeholder="Price" placeholderTextColor={colors.muted} style={styles.dateInput} value={editPrice} />
            <Text style={styles.sectionTitle}>Deposit (INR)</Text>
            <TextInput keyboardType="numeric" onChangeText={setEditDeposit} placeholder="0" placeholderTextColor={colors.muted} style={styles.dateInput} value={editDeposit} />

            <View style={styles.editSwitchRow}>
              <Text style={styles.editSwitchLabel}>Self pickup</Text>
              <Switch onValueChange={setEditPickup} value={editPickup} />
            </View>
            <View style={styles.editSwitchRow}>
              <Text style={styles.editSwitchLabel}>Owner delivery</Text>
              <Switch onValueChange={setEditDelivery} value={editDelivery} />
            </View>

            <Text style={styles.sectionTitle}>Location</Text>
            {editLatitude && editLongitude ? (
              <View style={styles.editMapWrap}>
                <OpenMap
                  center={{
                    latitude: Number(editLatitude),
                    longitude: Number(editLongitude),
                  }}
                  markers={[{
                    color: colors.signal,
                    coordinate: {
                      latitude: Number(editLatitude),
                      longitude: Number(editLongitude),
                    },
                    id: 'edit-listing-location',
                  }]}
                  onPress={(coordinate) => {
                    setEditLatitude(String(coordinate.latitude));
                    setEditLongitude(String(coordinate.longitude));
                  }}
                  style={styles.editMap}
                  zoom={13}
                />
              </View>
            ) : null}

            <Text style={styles.sectionTitle}>Store</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.editChipRow}>
              <Pressable onPress={() => setEditStoreId(null)} style={[styles.editChip, editStoreId === null && styles.editChipActive]}>
                <Text style={[styles.editChipText, editStoreId === null && styles.editChipTextActive]}>Personal</Text>
              </Pressable>
              {stores.map((store) => (
                <Pressable key={store.id} onPress={() => setEditStoreId(store.id)} style={[styles.editChip, editStoreId === store.id && styles.editChipActive]}>
                  <Text style={[styles.editChipText, editStoreId === store.id && styles.editChipTextActive]}>{store.display_name}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={styles.sectionTitle}>Photos</Text>
            <View style={styles.editPhotoRow}>
              {listing.images.map((image) => (
                <View key={image.id} style={styles.editPhotoWrap}>
                  <Image source={{ uri: image.url }} style={styles.editPhoto} />
                  <Pressable accessibilityLabel="Remove photo" disabled={editBusy} onPress={() => removeExistingImage(image.id)} style={styles.editPhotoRemove}>
                    <Ionicons color={colors.surface} name="close" size={14} />
                  </Pressable>
                </View>
              ))}
              {editPhotos.map((photo) => (
                <Pressable key={photo.uri} onPress={() => setEditPhotos((current) => current.filter((item) => item.uri !== photo.uri))} style={styles.editPhotoWrap}>
                  <Image source={{ uri: photo.uri }} style={styles.editPhoto} />
                  <View style={styles.editPhotoRemove}>
                    <Ionicons color={colors.surface} name="close" size={14} />
                  </View>
                </Pressable>
              ))}
              {listing.images.length + editPhotos.length < 8 ? (
                <Pressable onPress={pickEditPhotos} style={styles.editPhotoAdd}>
                  <Ionicons color={colors.teal} name="camera-outline" size={20} />
                  <Text style={styles.editPhotoAddText}>Add</Text>
                </Pressable>
              ) : null}
            </View>

            {editError ? <Text style={styles.errorText}>{editError}</Text> : null}

            <Pressable
              disabled={editBusy}
              onPress={submitEdit}
              style={[styles.submitButton, styles.modalSubmit, { backgroundColor: accent }]}
            >
              {editBusy ? (
                <ActivityIndicator color={colors.surface} />
              ) : (
                <Text style={styles.submitButtonText}>Save changes</Text>
              )}
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.paper, flex: 1 },
  loading: { marginTop: 60 },
  header: { padding: 16 },
  iconButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  content: { paddingBottom: 110 },
  gallery: { backgroundColor: '#1C3430', height: 280 },
  galleryImage: { height: 280, width: SCREEN_WIDTH },
  galleryFallback: { alignItems: 'center', height: 280, justifyContent: 'center', width: '100%' },
  dotsRow: {
    bottom: 12,
    flexDirection: 'row',
    gap: 5,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
  },
  dot: { backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: 3, height: 6, width: 6 },
  dotActive: { width: 16 },
  backFloating: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    left: 16,
    position: 'absolute',
    top: 14,
    width: 40,
  },
  editFloating: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    position: 'absolute',
    right: 16,
    top: 14,
    width: 40,
  },
  editChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  editChip: { backgroundColor: colors.paper, borderColor: colors.line, borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9 },
  editChipActive: { backgroundColor: colors.teal, borderColor: colors.teal },
  editChipText: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  editChipTextActive: { color: colors.surface },
  editSwitchRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  editSwitchLabel: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  editMapWrap: { borderRadius: radius.md, height: 190, overflow: 'hidden' },
  editMap: { flex: 1 },
  editPhotoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  editPhotoWrap: { borderRadius: radius.sm, height: 72, overflow: 'hidden', width: 72 },
  editPhoto: { height: '100%', width: '100%' },
  editPhotoRemove: { alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.68)', borderRadius: 12, height: 24, justifyContent: 'center', position: 'absolute', right: 4, top: 4, width: 24 },
  editPhotoAdd: { alignItems: 'center', borderColor: colors.teal, borderRadius: radius.sm, borderStyle: 'dashed', borderWidth: 1, gap: 3, height: 72, justifyContent: 'center', width: 72 },
  editPhotoAddText: { color: colors.teal, fontSize: 11, fontWeight: '800' },
  body: { padding: 20 },
  badgeRow: { flexDirection: 'row', gap: 6 },
  categoryBadge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  categoryBadgeText: { color: colors.surface, fontSize: 11, fontWeight: '800' },
  serviceBadge: { backgroundColor: colors.signal, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  serviceBadgeText: { color: colors.ink, fontSize: 11, fontWeight: '900' },
  title: { color: colors.ink, fontSize: 22, fontWeight: '900', marginTop: 10 },
  metaRow: { alignItems: 'center', flexDirection: 'row', gap: 4, marginTop: 6 },
  metaText: { color: colors.muted, fontSize: 13 },
  priceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  priceChip: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  priceChipText: { color: colors.teal, fontSize: 15, fontWeight: '900' },
  depositText: { color: colors.muted, fontSize: 11, marginTop: 2 },
  capabilityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  capabilityChip: {
    alignItems: 'center',
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  capabilityChipText: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  sectionTitle: { color: colors.teal, fontSize: 13, fontWeight: '900', marginTop: 24, textTransform: 'uppercase' },
  description: { color: colors.ink, fontSize: 14, lineHeight: 21, marginTop: 8 },
  attributeList: { gap: 8, marginTop: 10 },
  attributeRow: { flexDirection: 'row', justifyContent: 'space-between' },
  attributeKey: { color: colors.muted, fontSize: 13 },
  attributeValue: { color: colors.ink, flexShrink: 1, fontSize: 13, fontWeight: '700', textAlign: 'right' },
  relatedRow: { marginTop: 10 },
  relatedCard: { marginRight: 12, width: 120 },
  relatedImage: { borderRadius: radius.sm, height: 90, width: 120 },
  relatedImageFallback: {
    alignItems: 'center',
    borderRadius: radius.sm,
    height: 90,
    justifyContent: 'center',
    width: 120,
  },
  relatedTitle: { color: colors.ink, fontSize: 12, fontWeight: '700', marginTop: 6 },
  relatedPrice: { color: colors.teal, fontSize: 12, fontWeight: '800', marginTop: 2 },
  bookingForm: { marginTop: 12 },
  bargainLink: { alignItems: 'center', flexDirection: 'row', gap: 5, marginTop: 10 },
  bargainLinkText: { color: colors.teal, fontSize: 13, fontWeight: '800' },
  reasonInput: { minHeight: 74, paddingTop: 12, textAlignVertical: 'top' },
  dateInput: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.sm,
    borderWidth: 1,
    color: colors.ink,
    marginTop: 10,
    minHeight: 46,
    paddingHorizontal: 14,
  },
  formActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  cancelButton: {
    alignItems: 'center',
    borderColor: colors.line,
    borderRadius: radius.sm,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 18,
  },
  cancelButtonText: { color: colors.muted, fontSize: 14, fontWeight: '800' },
  submitButton: { alignItems: 'center', borderRadius: radius.sm, flex: 1, justifyContent: 'center', minHeight: 46 },
  submitButtonText: { color: colors.surface, fontSize: 14, fontWeight: '900' },
  notice: {
    backgroundColor: '#FFF8E1',
    borderLeftColor: colors.signal,
    borderLeftWidth: 3,
    borderRadius: radius.sm,
    color: colors.ink,
    marginTop: 16,
    padding: 12,
  },
  errorText: {
    backgroundColor: '#FFF2F0',
    borderLeftColor: colors.danger,
    borderLeftWidth: 3,
    color: colors.danger,
    margin: 20,
    padding: 12,
  },
  actionBar: {
    backgroundColor: colors.paper,
    borderTopColor: colors.line,
    borderTopWidth: 1,
    bottom: 0,
    flexDirection: 'row',
    gap: 10,
    left: 0,
    padding: 16,
    position: 'absolute',
    right: 0,
  },
  chatButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.sm,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 48,
  },
  chatButtonText: { color: colors.ink, fontSize: 14, fontWeight: '900' },
  requestButton: {
    alignItems: 'center',
    borderRadius: radius.sm,
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 48,
  },
  requestButtonText: { color: colors.surface, fontSize: 14, fontWeight: '900' },
  alreadyRequestedInfo: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 6 },
  alreadyRequestedText: { color: colors.ink, flexShrink: 1, fontSize: 13, fontWeight: '700' },
  modalSafeArea: { backgroundColor: colors.paper, flex: 1 },
  modalHeader: {
    alignItems: 'center',
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
  },
  modalTitle: { color: colors.ink, fontSize: 17, fontWeight: '900' },
  modalClose: { alignItems: 'center', height: 32, justifyContent: 'center', width: 32 },
  modalContent: { padding: 20, paddingBottom: 40 },
  modalListingCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 12,
  },
  modalListingImage: { borderRadius: radius.sm, height: 52, width: 52 },
  modalListingImageFallback: { alignItems: 'center', justifyContent: 'center' },
  modalListingInfo: { flex: 1, gap: 3 },
  modalListingTitle: { color: colors.ink, fontSize: 14, fontWeight: '900' },
  modalListingPrice: { color: colors.teal, fontSize: 13, fontWeight: '800' },
  pickerRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  pickerPill: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.sm,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    minHeight: 46,
  },
  pickerPillText: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  pickerDone: { alignItems: 'center', marginTop: 8, paddingVertical: 10 },
  pickerDoneText: { color: colors.teal, fontSize: 14, fontWeight: '900' },
  estimateCard: {
    backgroundColor: '#EAF7F1',
    borderRadius: radius.md,
    marginTop: 24,
    padding: 16,
  },
  estimateLabel: { color: colors.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  estimateValue: { color: colors.teal, fontSize: 22, fontWeight: '900', marginTop: 4 },
  estimateDeposit: { color: colors.muted, fontSize: 12, marginTop: 4 },
  modalSubmit: { marginTop: 20 },
});
