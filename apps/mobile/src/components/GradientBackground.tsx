import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet } from 'react-native';
import {
  SafeAreaView as RNSafeAreaView,
  type SafeAreaViewProps,
} from 'react-native-safe-area-context';

/**
 * Drop-in replacement for `SafeAreaView` from `react-native-safe-area-context`
 * that paints a soft mint-to-cream gradient behind the screen instead of a flat
 * white/paper background. Import this in place of the original so every screen
 * gets the same app-wide gradient without changing any JSX beyond the import.
 */
export function SafeAreaView({ children, style, ...rest }: Readonly<SafeAreaViewProps>) {
  return (
    <RNSafeAreaView {...rest} style={[styles.fill, style]}>
      <LinearGradient
        colors={['#E3F6EE', '#F5F7F3', '#FDF3E4']}
        end={{ x: 1, y: 1 }}
        pointerEvents="none"
        start={{ x: 0, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </RNSafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});

