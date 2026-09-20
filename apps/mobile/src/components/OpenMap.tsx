import Constants, { ExecutionEnvironment } from 'expo-constants';
import { type ReactNode, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius } from '@/theme';

export type MapCoordinate = {
  latitude: number;
  longitude: number;
};

export type OpenMapMarker = {
  color?: string;
  coordinate: MapCoordinate;
  id: string;
  onPress?: () => void;
};

type OpenMapProps = {
  center: MapCoordinate;
  children?: ReactNode;
  interactive?: boolean;
  markers?: OpenMapMarker[];
  onCenterChange?: (coordinate: MapCoordinate) => void;
  onPress?: (coordinate: MapCoordinate) => void;
  style?: StyleProp<ViewStyle>;
  zoom?: number;
};

const mapTilerKey = process.env.EXPO_PUBLIC_MAPTILER_KEY?.trim();
const mapStyleUrl = mapTilerKey
  ? `https://api.maptiler.com/maps/streets-v4/style.json?key=${encodeURIComponent(mapTilerKey)}`
  : null;
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
const mapLibre = isExpoGo
  ? null
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- importing eagerly crashes Expo Go
  : require('@maplibre/maplibre-react-native') as typeof import('@maplibre/maplibre-react-native');

mapLibre?.LogManager.onLog(({ message }) => {
  const isMapTilerNetworkFailure = message.includes('api.maptiler.com')
    && (message.includes('TLS') || message.includes('timed out'));
  const isRelatedStyleFailure = message.includes('loading style failed')
    && (message.includes('TLS') || message.includes('timed out'));
  return isMapTilerNetworkFailure || isRelatedStyleFailure;
});

export function OpenMap({
  center,
  children,
  interactive = true,
  markers = [],
  onCenterChange,
  onPress,
  style,
  zoom = 12,
}: Readonly<OpenMapProps>) {
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [mapFailed, setMapFailed] = useState(false);

  if (isExpoGo || !mapLibre) {
    return (
      <View style={[styles.missingKey, style]}>
        <Text style={styles.missingKeyTitle}>Development build required</Text>
        <Text style={styles.missingKeyText}>MapLibre is not included in Expo Go. Run the native Android or iOS app.</Text>
      </View>
    );
  }

  if (!mapStyleUrl) {
    return (
      <View style={[styles.missingKey, style]}>
        <Text style={styles.missingKeyTitle}>Map configuration needed</Text>
        <Text style={styles.missingKeyText}>Set EXPO_PUBLIC_MAPTILER_KEY, restart Metro, then reload the app.</Text>
      </View>
    );
  }

  const { Camera, Map: MapLibreMap, Marker } = mapLibre;

  if (mapFailed) {
    return (
      <View style={[styles.missingKey, style]}>
        <Text style={styles.missingKeyTitle}>Map unavailable</Text>
        <Text style={styles.missingKeyText}>
          The map service could not be reached. Listings and location details still work.
        </Text>
        <Pressable
          onPress={() => {
            setMapFailed(false);
            setLoadAttempt((current) => current + 1);
          }}
          style={styles.retryButton}
        >
          <Text style={styles.retryButtonText}>Retry map</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View pointerEvents={interactive ? 'auto' : 'none'} style={[styles.container, style]}>
      <MapLibreMap
        attribution
        attributionPosition={{ bottom: 4, right: 4 }}
        compass={interactive}
        logo
        logoPosition={{ bottom: 4, left: 4 }}
        key={loadAttempt}
        mapStyle={mapStyleUrl}
        onDidFailLoadingMap={() => setMapFailed(true)}
        onPress={onPress ? (event) => {
          const [longitude, latitude] = event.nativeEvent.lngLat;
          onPress({ latitude, longitude });
        } : undefined}
        onRegionDidChange={onCenterChange ? (event) => {
          const [longitude, latitude] = event.nativeEvent.center;
          onCenterChange({ latitude, longitude });
        } : undefined}
        style={styles.map}
        touchPitch={false}
        touchRotate={false}
      >
        <Camera center={[center.longitude, center.latitude]} duration={250} zoom={zoom} />
        {markers.map((marker) => (
          <Marker
            anchor="bottom"
            id={marker.id}
            key={marker.id}
            lngLat={[marker.coordinate.longitude, marker.coordinate.latitude]}
            onPress={marker.onPress}
          >
            <View
              style={[
                styles.pin,
                { backgroundColor: marker.color ?? colors.signal },
              ]}
            >
              <View style={styles.pinCenter} />
            </View>
          </Marker>
        ))}
        {children}
      </MapLibreMap>
      <View pointerEvents="none" style={styles.attributionBadge}>
        <Text style={styles.attributionText}>© MapTiler © OpenStreetMap contributors</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.paper, overflow: 'hidden' },
  map: { flex: 1 },
  pin: {
    alignItems: 'center',
    borderColor: colors.surface,
    borderRadius: 14,
    borderWidth: 2,
    height: 24,
    justifyContent: 'center',
    transform: [{ rotate: '45deg' }],
    width: 24,
  },
  pinCenter: {
    backgroundColor: colors.surface,
    borderRadius: 4,
    height: 7,
    width: 7,
  },
  attributionBadge: {
    backgroundColor: 'rgba(255,255,255,0.86)',
    borderRadius: radius.sm,
    bottom: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    position: 'absolute',
    right: 28,
  },
  attributionText: { color: colors.ink, fontSize: 8 },
  missingKey: {
    alignItems: 'center',
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderWidth: 1,
    justifyContent: 'center',
    padding: 20,
  },
  missingKeyTitle: { color: colors.ink, fontSize: 14, fontWeight: '900' },
  missingKeyText: { color: colors.muted, fontSize: 11, marginTop: 5, textAlign: 'center' },
  retryButton: {
    backgroundColor: colors.teal,
    borderRadius: radius.sm,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  retryButtonText: { color: colors.surface, fontSize: 12, fontWeight: '900' },
});
