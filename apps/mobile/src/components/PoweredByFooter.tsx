import { useEffect, useRef } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { colors } from '@/theme';

const SCREEN_WIDTH = Dimensions.get('window').width;
const BRAND_COLORS = ['#0BB768', '#3B82F6', '#EC4899', '#FFB800', '#F97316', '#087F75'];
const BRAND_COLOR_STOPS = BRAND_COLORS.map((_, index) => index / (BRAND_COLORS.length - 1));

/**
 * Branding strip pinned below the tab bar: a soft colourful gradient background
 * with a diagonal shimmer sweep, plus a brand name that cycles through colours.
 */
export function PoweredByFooter() {
  const fadeAnim = useRef(new Animated.Value(0.55)).current;
  const colorAnim = useRef(new Animated.Value(0)).current;
  const sweepAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const fadeLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.delay(1800),
        Animated.timing(fadeAnim, { toValue: 0.55, duration: 1400, useNativeDriver: true }),
        Animated.delay(1800),
      ]),
    );
    const colorLoop = Animated.loop(
      Animated.timing(colorAnim, {
        toValue: 1,
        duration: 5000,
        easing: Easing.linear,
        useNativeDriver: false,
      }),
    );
    const sweepLoop = Animated.loop(
      Animated.timing(sweepAnim, {
        toValue: 1,
        duration: 3200,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    fadeLoop.start();
    colorLoop.start();
    sweepLoop.start();
    return () => {
      fadeLoop.stop();
      colorLoop.stop();
      sweepLoop.stop();
    };
  }, [fadeAnim, colorAnim, sweepAnim]);

  const brandColor = colorAnim.interpolate({
    inputRange: BRAND_COLOR_STOPS,
    outputRange: BRAND_COLORS,
  });
  const sweepTranslate = sweepAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-SCREEN_WIDTH, SCREEN_WIDTH],
  });

  return (
    <View style={styles.footer}>
      <LinearGradient
        colors={['#FFF3D6', '#DFF7EE', '#E1EBFF', '#FCE4EC']}
        end={{ x: 1, y: 0 }}
        pointerEvents="none"
        start={{ x: 0, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View
        pointerEvents="none"
        style={[styles.sweep, { transform: [{ translateX: sweepTranslate }, { rotate: '20deg' }] }]}
      />
      <Animated.Text style={[styles.text, { opacity: fadeAnim }]}>
        Powered By <Animated.Text style={[styles.brand, { color: brandColor }]}>4by4softwares</Animated.Text>
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    alignItems: 'center',
    borderTopColor: colors.line,
    borderTopWidth: 1,
    justifyContent: 'center',
    overflow: 'hidden',
    paddingVertical: 6,
  },
  sweep: {
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
    height: '250%',
    position: 'absolute',
    top: -12,
    width: 60,
  },
  text: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '600',
  },
  brand: {
    fontWeight: '900',
    letterSpacing: 0.3,
  },
});
