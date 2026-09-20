import type { CategoryResponse, ListingResponse, StoreOwnerResponse } from '@4by4/api-client';
import { Ionicons } from '@expo/vector-icons';
import { File as ExpoFile } from 'expo-file-system';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from '@/components/GradientBackground';

import { OpenMap, type MapCoordinate } from '@/components/OpenMap';
import { apiClient } from '@/services/api';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { getAccessToken } from '@/services/sessionStore';
import { categoryColor, colors, radius, spacing } from '@/theme';
import { SignInGate } from '@/components/SignInGate';

const CONDITIONS = ['new', 'like_new', 'good', 'fair'] as const;
const PRICE_UNITS = ['hour', 'day', 'week', 'month'] as const;
const DEFAULT_LOCATION = { latitude: 8.1833, longitude: 77.4119 };
type PriceUnit = (typeof PRICE_UNITS)[number];
type ListingType = 'item' | 'service';

export default function ListItemScreen() {
  const params = useLocalSearchParams<{ storeId?: string }>();
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [stores, setStores] = useState<StoreOwnerResponse[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [categoryIndex, setCategoryIndex] = useState(0);
  const [listingType, setListingType] = useState<ListingType>('item');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [condition, setCondition] = useState<(typeof CONDITIONS)[number]>('good');
  const [skill, setSkill] = useState('');
  const [priceUnit, setPriceUnit] = useState<PriceUnit>('day');
  const [price, setPrice] = useState('500');
  const [depositEnabled, setDepositEnabled] = useState(false);
  const [depositAmount, setDepositAmount] = useState('1000');
  const [quantity, setQuantity] = useState('1');
  const [photos, setPhotos] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [location, setLocation] = useState(DEFAULT_LOCATION);
  const [locality, setLocality] = useState('Nagercoil');
  const [locating, setLocating] = useState(false);
  const [created, setCreated] = useState<ListingResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [profileComplete, setProfileComplete] = useState<boolean | null>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      async function checkProfile() {
        const token = await getAccessToken();
        if (!token) {
          if (active) {
            setSignedIn(false);
            setProfileComplete(null);
          }
          return;
        }
        if (active) setSignedIn(true);
        try {
          const [me, ownedStores] = await Promise.all([
            apiClient.getCurrentUser(token),
            apiClient.listMyStores(token),
          ]);
          if (active) {
            setProfileComplete(me.profile_complete);
            setStores(ownedStores.filter((store) => store.status === 'active'));
            setSelectedStoreId((current) => {
              if (current && ownedStores.some((store) => store.id === current && store.status === 'active')) {
                return current;
              }
              const requestedStoreId = typeof params.storeId === 'string' ? params.storeId : null;
              return ownedStores.some((store) => store.id === requestedStoreId && store.status === 'active')
                ? requestedStoreId
                : null;
            });
          }
        } catch {
          if (active) setProfileComplete(null);
        }
      }
      checkProfile();
      return () => {
        active = false;
      };
    }, [params.storeId]),
  );

  useEffect(() => {
    let active = true;
    apiClient.getCategories()
      .then((items) => active && setCategories(items))
      .catch((caught) => active && setError(caught instanceof Error ? caught.message : 'Unable to load categories.'));
    return () => {
      active = false;
    };
  }, []);

  async function useCurrentLocation() {
    setLocating(true);
    setError('');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setError('Location access is needed to use your current position.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({});
      setLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      const [place] = await Location.reverseGeocodeAsync(position.coords);
      if (place?.city || place?.subregion) {
        setLocality(place.city || place.subregion || locality);
      }
    } catch {
      setError('Unable to detect your current location. Pick a point on the map instead.');
    } finally {
      setLocating(false);
    }
  }

  function onMapPress(coordinate: MapCoordinate) {
    setLocation(coordinate);
  }

  async function pickPhotos() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Photo library access is needed to add listing photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      mediaTypes: ['images'],
      quality: 0.7,
      selectionLimit: 5,
    });
    if (!result.canceled) {
      setPhotos((current) => [...current, ...result.assets].slice(0, 5));
    }
  }

  function removePhoto(uri: string) {
    setPhotos((current) => current.filter((photo) => photo.uri !== uri));
  }

  async function publish() {
    const token = await getAccessToken();
    if (!token) {
      setError('Sign in from Account before listing an item.');
      return;
    }
    const category = categories[categoryIndex];
    if (!category) return;
    if (listingType === 'item' && photos.length === 0) {
      setError('Add at least one photo so renters can see the item.');
      return;
    }
    if (listingType === 'service' && skill.trim().length < 3) {
      setError('Describe the skill or work you are offering.');
      return;
    }
    const availableQuantity = Number(quantity);
    if (!Number.isInteger(availableQuantity) || availableQuantity < 1 || availableQuantity > 1000) {
      setError('Enter an available quantity between 1 and 1000.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const listing = await apiClient.createListing({
        attributes: listingType === 'service' ? { skill: skill.trim() } : {},
        category_id: category.id,
        condition: listingType === 'item' ? condition : undefined,
        delivery_enabled: false,
        description,
        latitude: location.latitude,
        listing_type: listingType,
        longitude: location.longitude,
        pickup_enabled: true,
        prices: [{
          amount_minor: Math.round(Number(price) * 100),
          currency: 'INR',
          deposit_minor: depositEnabled ? Math.round(Number(depositAmount) * 100) : 0,
          unit: priceUnit,
        }],
        public_locality: locality,
        quantity: availableQuantity,
        store_id: selectedStoreId,
        title,
      }, undefined, token);
      for (const photo of photos) {
        await apiClient.uploadListingImage(
          listing.id,
          new ExpoFile(photo.uri),
          undefined,
          token,
        );
      }
      setCreated(await apiClient.transitionListing(listing.id, 'publish', undefined, token));
      setTitle('');
      setDescription('');
      setSkill('');
      setPhotos([]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to publish this listing.');
    } finally {
      setBusy(false);
    }
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
        icon="add-circle-outline"
        subtitle="Sign in to your 4by4 account before you list an item or offer a service for rent."
        title="Sign in to list an item"
      />
    );
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      {profileComplete === false ? (
        <View style={styles.gate}>
          <Ionicons name="person-circle-outline" size={40} color={colors.teal} />
          <Text accessibilityRole="header" style={styles.gateTitle}>Complete your profile first</Text>
          <Text style={styles.gateMessage}>
            Add your locality and at least one address so renters know who they are dealing with
            before you list anything.
          </Text>
          <Pressable onPress={() => router.push('/edit-profile')} style={styles.gateButton}>
            <Text style={styles.gateButtonText}>Complete profile</Text>
          </Pressable>
        </View>
      ) : (
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <LinearGradient colors={['#0BB768', '#087F75']} end={{ x: 1, y: 1 }} start={{ x: 0, y: 0 }} style={styles.hero}>
          <Text style={styles.eyebrow}>Owner workspace</Text>
          <Text accessibilityRole="header" style={styles.title}>List an item or offer work</Text>
          <Text style={styles.subtitle}>Listings remain tied to your account. Phone and exact address stay private.</Text>
        </LinearGradient>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>What are you listing?</Text>
          <View style={styles.typeToggle}>
            <Pressable
              onPress={() => setListingType('item')}
              style={[styles.typeOption, listingType === 'item' && styles.typeOptionActive]}
            >
              <Ionicons
                color={listingType === 'item' ? colors.surface : colors.ink}
                name="cube-outline"
                size={16}
              />
              <Text style={[styles.typeOptionText, listingType === 'item' && styles.typeOptionTextActive]}>
                An item to rent
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setListingType('service')}
              style={[styles.typeOption, listingType === 'service' && styles.typeOptionActive]}
            >
              <Ionicons
                color={listingType === 'service' ? colors.surface : colors.ink}
                name="person-outline"
                size={16}
              />
              <Text style={[styles.typeOptionText, listingType === 'service' && styles.typeOptionTextActive]}>
                My own labour / work
              </Text>
            </Pressable>
          </View>

          <Text style={styles.label}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categories}>
            {categories.map((category, index) => {
              const active = index === categoryIndex;
              const accent = categoryColor(category.slug);
              return (
                <Pressable
                  key={category.id}
                  onPress={() => setCategoryIndex(index)}
                  style={[
                    styles.category,
                    { borderColor: accent },
                    active && { backgroundColor: accent },
                  ]}
                >
                  <Text style={[styles.categoryText, active && { color: colors.surface }]}>
                    {category.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={styles.label}>Publish as</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categories}>
            <Pressable
              onPress={() => setSelectedStoreId(null)}
              style={[styles.chip, selectedStoreId === null && styles.chipActive]}
            >
              <Text style={[styles.chipText, selectedStoreId === null && styles.chipTextActive]}>Personal</Text>
            </Pressable>
            {stores.map((store) => (
              <Pressable
                key={store.id}
                onPress={() => setSelectedStoreId(store.id)}
                style={[styles.chip, selectedStoreId === store.id && styles.chipActive]}
              >
                <Text style={[styles.chipText, selectedStoreId === store.id && styles.chipTextActive]}>
                  {store.display_name}
                </Text>
              </Pressable>
            ))}
            <Pressable onPress={() => router.push('/stores')} style={styles.chip}>
              <Text style={styles.chipText}>+ Store</Text>
            </Pressable>
          </ScrollView>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Details</Text>
          <Text style={styles.label}>Title</Text>
          <TextInput
            onChangeText={setTitle}
            placeholder={listingType === 'item' ? 'Cordless drill kit' : 'Experienced electrician for hire'}
            style={styles.input}
            value={title}
          />
          <Text style={styles.label}>Description</Text>
          <TextInput
            multiline
            onChangeText={setDescription}
            placeholder={listingType === 'item'
              ? 'Condition, included accessories, and safe-use notes'
              : 'Experience, tools you bring, and areas you cover'}
            style={[styles.input, styles.description]}
            value={description}
          />

          {listingType === 'item' ? (
            <>
              <Text style={styles.label}>Condition</Text>
              <View style={styles.rowWrap}>
                {CONDITIONS.map((option) => (
                  <Pressable
                    key={option}
                    onPress={() => setCondition(option)}
                    style={[styles.chip, condition === option && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, condition === option && styles.chipTextActive]}>
                      {option.replace('_', ' ')}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : (
            <>
              <Text style={styles.label}>Skill / work offered</Text>
              <TextInput
                onChangeText={setSkill}
                placeholder="e.g. Electrical wiring, house painting, event help"
                style={styles.input}
                value={skill}
              />
            </>
          )}
          <Text style={styles.label}>Available quantity</Text>
          <TextInput
            keyboardType="number-pad"
            onChangeText={setQuantity}
            placeholder="1"
            style={styles.input}
            value={quantity}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Pricing</Text>
          <Text style={styles.label}>Price</Text>
          <View style={styles.rowWrap}>
            {PRICE_UNITS.map((unit) => (
              <Pressable
                key={unit}
                onPress={() => setPriceUnit(unit)}
                style={[styles.chip, priceUnit === unit && styles.chipActive]}
              >
                <Text style={[styles.chipText, priceUnit === unit && styles.chipTextActive]}>per {unit}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput keyboardType="number-pad" onChangeText={setPrice} style={styles.input} value={price} />

          <View style={styles.depositRow}>
            <View style={styles.depositCopy}>
              <Text style={styles.label}>Deposit required?</Text>
              <Text style={styles.depositHint}>Collected by you at pickup, not through the app.</Text>
            </View>
            <Switch
              onValueChange={setDepositEnabled}
              thumbColor={colors.surface}
              trackColor={{ false: colors.line, true: colors.teal }}
              value={depositEnabled}
            />
          </View>
          {depositEnabled ? (
            <TextInput
              keyboardType="number-pad"
              onChangeText={setDepositAmount}
              placeholder="Deposit amount (INR)"
              style={styles.input}
              value={depositAmount}
            />
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Location</Text>
          <Text style={styles.locationHint}>Tap the map to drop a pin, or use your current location.</Text>
          <View style={styles.mapWrap}>
            <OpenMap
              center={location}
              markers={[{
                color: colors.signal,
                coordinate: location,
                id: 'listing-location',
              }]}
              onPress={onMapPress}
              style={styles.map}
              zoom={13}
            />
            <Pressable disabled={locating} onPress={useCurrentLocation} style={styles.locateButton}>
              {locating ? (
                <ActivityIndicator color={colors.ink} size="small" />
              ) : (
                <>
                  <Ionicons name="locate" size={16} color={colors.ink} />
                  <Text style={styles.locateButtonText}>Use current location</Text>
                </>
              )}
            </Pressable>
          </View>
          <TextInput
            onChangeText={setLocality}
            placeholder="Locality shown to renters (e.g. Nagercoil)"
            style={styles.input}
            value={locality}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Photos (up to 5)</Text>
          <View style={styles.photoRow}>
            {photos.map((photo) => (
              <Pressable key={photo.uri} onLongPress={() => removePhoto(photo.uri)} style={styles.photoThumb}>
                <Image source={{ uri: photo.uri }} style={styles.photoImage} />
              </Pressable>
            ))}
            {photos.length < 5 && (
              <Pressable onPress={pickPhotos} style={styles.photoAdd}>
                <Ionicons color={colors.teal} name="camera-outline" size={20} />
                <Text style={styles.photoAddText}>Add</Text>
              </Pressable>
            )}
          </View>
        </View>

        {created ? (
          <View style={styles.success}>
            <Text style={styles.successTitle}>Listing submitted</Text>
            <Text style={styles.successMessage}>Status: {created.status.replace('_', ' ')}</Text>
          </View>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!busy && (title.length < 3 || description.length < 10) ? (
          <Text style={styles.hint}>
            {title.length < 3
              ? 'Add a title of at least 3 characters to publish.'
              : 'Add a description of at least 10 characters to publish.'}
          </Text>
        ) : null}
        <Pressable
          disabled={busy || title.length < 3 || description.length < 10}
          onPress={publish}
          style={[
            styles.submit,
            { backgroundColor: categoryColor(categories[categoryIndex]?.slug) },
            (busy || title.length < 3 || description.length < 10) && styles.submitDisabled,
          ]}
        >
          {busy ? <ActivityIndicator color={colors.surface} /> : <Text style={styles.submitText}>Create and publish</Text>}
        </Pressable>
      </ScrollView>
      )}
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.paper },
  gateSpinner: { marginTop: 60 },
  content: { padding: spacing.md, paddingBottom: 90 },
  hero: {
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    padding: spacing.lg,
  },
  eyebrow: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  title: { color: colors.surface, fontSize: 26, fontWeight: '900', marginTop: 6 },
  subtitle: { color: 'rgba(255,255,255,0.9)', fontSize: 14, lineHeight: 20, marginTop: 8 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
  },
  cardLabel: { color: colors.teal, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', marginBottom: 4 },
  label: { color: colors.ink, fontSize: 13, fontWeight: '800', marginTop: 16, marginBottom: 7 },
  categories: { gap: 8 },
  category: { backgroundColor: colors.paper, borderColor: colors.line, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 10 },
  categoryActive: { borderWidth: 2 },
  categoryText: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  typeToggle: { flexDirection: 'row', gap: 8 },
  typeOption: {
    alignItems: 'center',
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 10,
  },
  typeOptionActive: { backgroundColor: colors.teal, borderColor: colors.teal },
  typeOptionText: { color: colors.ink, fontSize: 13, fontWeight: '800', textAlign: 'center' },
  typeOptionTextActive: { color: colors.surface },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  chipActive: { backgroundColor: colors.teal, borderColor: colors.teal },
  chipText: { color: colors.ink, fontSize: 13, fontWeight: '700', textTransform: 'capitalize' },
  chipTextActive: { color: colors.surface },
  depositRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  depositCopy: { flex: 1, paddingRight: 12 },
  depositHint: { color: colors.muted, fontSize: 12, marginTop: 2 },
  locationHint: { color: colors.muted, fontSize: 12, marginTop: -3, marginBottom: 10 },
  mapWrap: { borderRadius: radius.md, height: 220, marginBottom: 12, overflow: 'hidden' },
  map: { flex: 1 },
  locateButton: {
    alignItems: 'center',
    backgroundColor: colors.signal,
    borderRadius: radius.pill,
    bottom: 10,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    position: 'absolute',
    right: 10,
  },
  locateButtonText: { color: colors.ink, fontSize: 12, fontWeight: '900' },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photoThumb: { borderRadius: radius.sm, height: 84, overflow: 'hidden', width: 84 },
  photoImage: { height: '100%', width: '100%' },
  photoAdd: {
    alignItems: 'center',
    backgroundColor: colors.paper,
    borderColor: colors.teal,
    borderRadius: radius.sm,
    borderStyle: 'dashed',
    borderWidth: 1,
    gap: 4,
    height: 84,
    justifyContent: 'center',
    width: 84,
  },
  photoAddText: { color: colors.teal, fontSize: 12, fontWeight: '800' },
  input: {
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 16,
    minHeight: 52,
    paddingHorizontal: 14,
  },
  description: { minHeight: 120, paddingTop: 14, textAlignVertical: 'top' },
  submit: { alignItems: 'center', backgroundColor: colors.signal, borderRadius: radius.md, justifyContent: 'center', marginTop: 8, minHeight: 52 },
  submitDisabled: { opacity: 0.45 },
  submitText: { color: colors.surface, fontSize: 16, fontWeight: '900' },
  gate: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: 30 },
  gateTitle: { color: colors.ink, fontSize: 22, fontWeight: '900', marginTop: 14, textAlign: 'center' },
  gateMessage: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: 10, textAlign: 'center' },
  gateButton: {
    alignItems: 'center',
    backgroundColor: colors.teal,
    borderRadius: radius.md,
    justifyContent: 'center',
    marginTop: 22,
    minHeight: 52,
    paddingHorizontal: 28,
  },
  gateButtonText: { color: colors.surface, fontSize: 15, fontWeight: '900' },
  success: { backgroundColor: '#E8F6F3', borderLeftColor: colors.teal, borderLeftWidth: 3, borderRadius: radius.sm, marginBottom: 16, padding: 14 },
  successTitle: { color: colors.ink, fontWeight: '900' },
  successMessage: { color: colors.teal, marginTop: 4 },
  error: { backgroundColor: '#FFF2F0', borderLeftColor: colors.danger, borderLeftWidth: 3, borderRadius: radius.sm, color: colors.danger, marginBottom: 16, padding: 12 },
  hint: { color: colors.muted, fontSize: 13, marginBottom: 8, textAlign: 'center' },
});
