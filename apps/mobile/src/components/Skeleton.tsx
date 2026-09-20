import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, type ViewStyle } from 'react-native';

import { colors, radius } from '@/theme';

type SkeletonBlockProps = {
  height?: number;
  width?: number | `${number}%`;
  borderRadius?: number;
  style?: ViewStyle;
};

/** A single pulsing placeholder block. Building block for screen-specific skeletons. */
export function SkeletonBlock({ borderRadius = radius.sm, height = 16, width = '100%', style }: Readonly<SkeletonBlockProps>) {
  const opacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { duration: 650, toValue: 1, useNativeDriver: true }),
        Animated.timing(opacity, { duration: 650, toValue: 0.35, useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.block,
        { borderRadius, height, opacity, width: width as ViewStyle['width'] },
        style,
      ]}
    />
  );
}

/** Placeholder for a list of rows (each with an avatar/icon circle and two text lines). */
export function ListSkeleton({ rows = 5 }: Readonly<{ rows?: number }>) {
  return (
    <View style={styles.list}>
      {Array.from({ length: rows }, (_, index) => `skeleton-row-${index}`).map((key) => (
        <View key={key} style={styles.row}>
          <SkeletonBlock borderRadius={20} height={40} width={40} />
          <View style={styles.rowLines}>
            <SkeletonBlock height={14} width="70%" />
            <SkeletonBlock height={12} style={styles.rowLineGap} width="45%" />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Placeholder for a detail screen: a large media block followed by text lines. */
export function DetailSkeleton() {
  return (
    <View style={styles.detail}>
      <SkeletonBlock borderRadius={radius.sm} height={220} width="100%" />
      <SkeletonBlock height={22} style={styles.detailGap} width="60%" />
      <SkeletonBlock height={14} style={styles.detailGap} width="90%" />
      <SkeletonBlock height={14} style={styles.detailGap} width="80%" />
      <View style={styles.detailChips}>
        <SkeletonBlock borderRadius={radius.pill} height={30} width={90} />
        <SkeletonBlock borderRadius={radius.pill} height={30} width={90} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { backgroundColor: colors.line },
  list: { gap: 16, padding: 16 },
  row: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  rowLines: { flex: 1, gap: 6 },
  rowLineGap: { marginTop: 2 },
  detail: { padding: 16 },
  detailGap: { marginTop: 12 },
  detailChips: { flexDirection: 'row', gap: 8, marginTop: 16 },
});
