import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { translate } from '@4by4/i18n';

import { OpenMap } from '@/components/OpenMap';
import { useLocale } from '@/services/localeStore';
import { getLocation, setLocation } from '@/services/locationStore';
import { colors, radius, spacing } from '@/theme';

export default function LocationPickerScreen() {
  const locale = useLocale();
  const initial = getLocation();
  const [region, setRegion] = useState({
    latitude: initial.latitude,
    longitude: initial.longitude,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });
  const [locality, setLocality] = useState(initial.locality);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);

  async function refreshLocality(latitude: number, longitude: number) {
    try {
      const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (place) {
        const label = [place.name ?? place.street, place.city ?? place.subregion, place.region]
          .filter(Boolean)
          .join(', ');
        setLocality(label || 'Selected location');
      }
    } catch {
      // Keep the last known label if reverse geocoding is unavailable.
    }
  }

  async function useDeviceLocation() {
    setBusy(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') return;
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const next = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };
      setRegion(next);
      await refreshLocality(next.latitude, next.longitude);
    } finally {
      setBusy(false);
    }
  }

  async function searchAddress() {
    if (!query.trim()) return;
    setBusy(true);
    try {
      const [place] = await Location.geocodeAsync(`${query}, Tamil Nadu, India`);
      if (place) {
        const next = {
          latitude: place.latitude,
          longitude: place.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        };
        setRegion(next);
        await refreshLocality(next.latitude, next.longitude);
      }
    } finally {
      setBusy(false);
    }
  }

  function confirm() {
    setLocation({ latitude: region.latitude, longitude: region.longitude, locality });
    router.back();
  }

  return (
    <View style={styles.root}>
      <OpenMap
        center={region}
        onCenterChange={(coordinate) => {
          const next = { ...region, ...coordinate };
          setRegion(next);
          void refreshLocality(next.latitude, next.longitude);
        }}
        style={styles.map}
        zoom={13}
      />
      <View pointerEvents="none" style={styles.centerPin}>
        <Ionicons name="location" size={36} color={colors.signal} />
      </View>

      <SafeAreaView style={styles.overlay} edges={['top']}>
        <View style={styles.searchRow}>
          <Pressable accessibilityLabel="Close" onPress={() => router.back()} style={styles.closeButton}>
            <Ionicons name="close" size={20} color={colors.ink} />
          </Pressable>
          <TextInput
            onChangeText={setQuery}
            onSubmitEditing={searchAddress}
            placeholder={translate(locale, 'locationPicker.searchPlaceholder')}
            placeholderTextColor={colors.muted}
            returnKeyType="search"
            style={styles.searchInput}
            value={query}
          />
        </View>
      </SafeAreaView>

      <SafeAreaView style={styles.bottomSheet} edges={['bottom']}>
        <Text style={styles.title}>{translate(locale, 'locationPicker.title')}</Text>
        <View style={styles.localityRow}>
          <Ionicons name="location-outline" size={16} color={colors.teal} />
          <Text numberOfLines={2} style={styles.localityText}>{locality}</Text>
        </View>
        <Pressable onPress={useDeviceLocation} style={styles.deviceLocationButton}>
          <Ionicons name="navigate-outline" size={16} color={colors.teal} />
          <Text style={styles.deviceLocationText}>{translate(locale, 'locationPicker.useCurrent')}</Text>
        </Pressable>
        <Pressable disabled={busy} onPress={confirm} style={styles.confirmButton}>
          {busy ? (
            <ActivityIndicator color={colors.paper} />
          ) : (
            <Text style={styles.confirmText}>{translate(locale, 'locationPicker.confirm')}</Text>
          )}
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  map: { flex: 1 },
  centerPin: {
    alignItems: 'center',
    justifyContent: 'center',
    left: 0,
    right: 0,
    top: '50%',
    marginTop: -36,
    position: 'absolute',
  },
  overlay: { left: 0, position: 'absolute', right: 0, top: 0 },
  searchRow: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    minHeight: 48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  closeButton: {
    alignItems: 'center',
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  searchInput: { color: colors.ink, flex: 1, fontSize: 15 },
  bottomSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    bottom: 0,
    left: 0,
    padding: spacing.md,
    position: 'absolute',
    right: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
  },
  title: { color: colors.ink, fontSize: 18, fontWeight: '900' },
  localityRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  localityText: { color: colors.ink, flex: 1, fontSize: 14, fontWeight: '600' },
  deviceLocationButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  deviceLocationText: { color: colors.teal, fontSize: 13, fontWeight: '800' },
  confirmButton: {
    alignItems: 'center',
    backgroundColor: colors.teal,
    borderRadius: radius.pill,
    justifyContent: 'center',
    marginTop: spacing.md,
    minHeight: 50,
  },
  confirmText: { color: colors.paper, fontSize: 15, fontWeight: '800' },
});
