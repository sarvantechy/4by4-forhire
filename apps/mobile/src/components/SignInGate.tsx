import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme';
import { SafeAreaView } from '@/components/GradientBackground';

type SignInGateProps = Readonly<{
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
}>;

/** Full-screen sign-in prompt shown instead of a tab's content when no session exists. */
export function SignInGate({ title, subtitle, icon }: SignInGateProps) {
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <View style={styles.content}>
        <View style={styles.badgeRow}>
          <View style={styles.brandBadge}>
            <Ionicons name="cube" size={16} color={colors.ink} />
          </View>
          <Text style={styles.brandBadgeText}>4by4 For Hire</Text>
        </View>

        <LinearGradient colors={['#0BB768', '#087F75']} end={{ x: 1, y: 1 }} start={{ x: 0, y: 0 }} style={styles.heroCard}>
          <View style={styles.heroIconRing}>
            <Ionicons name={icon} size={30} color={colors.surface} />
          </View>
          <Text accessibilityRole="header" style={styles.heroTitle}>{title}</Text>
          <Text style={styles.heroSubtitle}>{subtitle}</Text>
        </LinearGradient>

        <Pressable onPress={() => router.push('/login')} style={styles.signInButton}>
          <Text style={styles.signInButtonText}>Sign in / create account</Text>
        </Pressable>
        <Text style={styles.hint}>New here? Creating an account takes less than a minute.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: 24 },
  badgeRow: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 6,
    marginBottom: 18,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  brandBadge: {
    alignItems: 'center',
    backgroundColor: colors.signal,
    borderRadius: 999,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  brandBadgeText: { color: colors.ink, fontSize: 12, fontWeight: '900' },
  heroCard: {
    alignItems: 'center',
    borderRadius: 24,
    elevation: 8,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    width: '100%',
  },
  heroIconRing: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    borderRadius: 32,
    height: 64,
    justifyContent: 'center',
    marginBottom: 14,
    width: 64,
  },
  heroTitle: { color: colors.surface, fontSize: 21, fontWeight: '900', textAlign: 'center' },
  heroSubtitle: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
    textAlign: 'center',
  },
  signInButton: {
    alignItems: 'center',
    backgroundColor: colors.signal,
    borderRadius: 14,
    elevation: 6,
    justifyContent: 'center',
    marginTop: 22,
    minHeight: 52,
    paddingHorizontal: 24,
    shadowColor: '#000',
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    width: '100%',
  },
  signInButtonText: { color: colors.ink, fontSize: 15, fontWeight: '900' },
  hint: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 14,
    textAlign: 'center',
  },
});
