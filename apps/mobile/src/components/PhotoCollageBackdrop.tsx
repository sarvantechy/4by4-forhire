import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

// Local, network-independent tiles (no remote images to fetch) so the backdrop
// always renders, even offline or behind a restrictive network/proxy.
const DEFAULT_TILES: readonly { icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
  { color: '#F97316', icon: 'construct' },
  { color: '#EF4444', icon: 'hammer' },
  { color: '#06B6D4', icon: 'sparkles' },
  { color: '#22C55E', icon: 'leaf' },
  { color: '#A855F7', icon: 'balloon' },
  { color: '#3B82F6', icon: 'camera' },
  { color: '#14B8A6', icon: 'bicycle' },
  { color: '#EC4899', icon: 'shirt' },
];

const TILE_SIZE = 128;
const TILE_GAP = 10;
const ROW_STEP = TILE_SIZE + TILE_GAP;

type Tile = Readonly<{ icon: keyof typeof Ionicons.glyphMap; color: string }>;

type Props = Readonly<{
  tiles?: readonly Tile[];
  tintColors?: [string, string];
}>;

/** A slow, auto-scrolling colour-tile marquee used as a full-bleed screen backdrop. */
export function PhotoCollageBackdrop({
  tiles = DEFAULT_TILES,
  tintColors = ['rgba(16, 24, 32, 0.45)', 'rgba(255, 153, 40, 0.3)'],
}: Props) {
  const trackA = useRef(new Animated.Value(0)).current;
  const trackB = useRef(new Animated.Value(0)).current;
  const loopWidth = tiles.length * ROW_STEP;

  useEffect(() => {
    const forward = Animated.loop(
      Animated.timing(trackA, {
        toValue: -loopWidth,
        duration: tiles.length * 3600,
        useNativeDriver: true,
      }),
    );
    const reverse = Animated.loop(
      Animated.timing(trackB, {
        toValue: loopWidth,
        duration: tiles.length * 4200,
        useNativeDriver: true,
      }),
    );
    forward.start();
    reverse.start();
    return () => {
      forward.stop();
      reverse.stop();
    };
  }, [loopWidth, tiles.length, trackA, trackB]);

  const doubled = [...tiles, ...tiles];

  return (
    <View pointerEvents="none" style={styles.root}>
      <Animated.View style={[styles.row, { transform: [{ translateX: trackA }] }]}>
        {doubled.map((tile, index) => (
          <LinearGradient
            colors={[tile.color, 'rgba(0, 0, 0, 0.35)']}
            end={{ x: 1, y: 1 }}
            key={`a-${index}-${tile.icon}`}
            start={{ x: 0, y: 0 }}
            style={styles.tile}
          >
            <Ionicons color="rgba(255, 255, 255, 0.55)" name={tile.icon} size={48} />
          </LinearGradient>
        ))}
      </Animated.View>
      <Animated.View style={[styles.row, styles.rowOffset, { transform: [{ translateX: trackB }] }]}>
        {doubled
          .slice()
          .reverse()
          .map((tile, index) => (
            <LinearGradient
              colors={[tile.color, 'rgba(0, 0, 0, 0.35)']}
              end={{ x: 1, y: 1 }}
              key={`b-${index}-${tile.icon}`}
              start={{ x: 0, y: 0 }}
              style={styles.tile}
            >
              <Ionicons color="rgba(255, 255, 255, 0.55)" name={tile.icon} size={48} />
            </LinearGradient>
          ))}
      </Animated.View>
      <LinearGradient colors={tintColors} end={{ x: 1, y: 1 }} start={{ x: 0, y: 0 }} style={styles.overlay} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    gap: TILE_GAP,
    opacity: 0.9,
    position: 'absolute',
    top: '10%',
  },
  rowOffset: { top: '58%' },
  tile: {
    alignItems: 'center',
    borderRadius: 14,
    height: TILE_SIZE,
    justifyContent: 'center',
    width: TILE_SIZE,
  },
  overlay: { ...StyleSheet.absoluteFill },
});
