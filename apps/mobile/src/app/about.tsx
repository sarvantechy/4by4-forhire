import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from '@/components/GradientBackground';

import { colors, radius, spacing } from '@/theme';

type ChangelogEntry = Readonly<{
  version: string;
  date: string;
  notes: readonly string[];
}>;

// Newest first. Add an entry here whenever a new build ships to the Play Store.
const CHANGELOG: readonly ChangelogEntry[] = [
  {
    version: '1.0.0',
    date: 'September 2026',
    notes: [
      'First public release of 4by4 For Hire.',
      'Browse, list, and book items or services near you.',
      'In-app chat, offers, and booking management.',
    ],
  },
];

const PRIVACY_URL = 'https://api.forhire.4by4softwares.com/privacy';
const ACCOUNT_DELETION_URL = 'https://api.forhire.4by4softwares.com/account-deletion';

export default function AboutScreen() {
  const appVersion = Constants.expoConfig?.version ?? CHANGELOG[0].version;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <Text accessibilityRole="header" style={styles.title}>About</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.brandRow}>
          <Image source={require('../../assets/icon.png')} style={styles.appIcon} />
          <View style={styles.brandText}>
            <Text style={styles.appName}>4by4 For Hire</Text>
            <Text style={styles.appVersion}>Version {appVersion}</Text>
          </View>
        </View>

        <Text style={styles.paragraph}>
          4by4 For Hire is a local peer-to-peer marketplace for renting equipment, tools, and
          skilled services. List what you own or what you can do, discover what is nearby on the
          map, and book directly with the owner &ndash; no middleman, no showroom.
        </Text>
        <Text style={styles.paragraph}>
          Built by 4by4softwares, Kanyakumari, Tamil Nadu.
        </Text>

        <View style={styles.legalLinks}>
          <Pressable onPress={() => void Linking.openURL(PRIVACY_URL)} style={styles.legalLink}>
            <Ionicons name="shield-checkmark-outline" size={18} color={colors.teal} />
            <Text style={styles.legalLinkText}>Privacy policy</Text>
            <Ionicons name="open-outline" size={15} color={colors.muted} />
          </Pressable>
          <Pressable onPress={() => void Linking.openURL(ACCOUNT_DELETION_URL)} style={styles.legalLink}>
            <Ionicons name="person-remove-outline" size={18} color={colors.teal} />
            <Text style={styles.legalLinkText}>Account deletion information</Text>
            <Ionicons name="open-outline" size={15} color={colors.muted} />
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Version history</Text>
        {CHANGELOG.map((entry) => (
          <View key={entry.version} style={styles.entry}>
            <View style={styles.entryHeader}>
              <Text style={styles.entryVersion}>v{entry.version}</Text>
              <Text style={styles.entryDate}>{entry.date}</Text>
            </View>
            {entry.notes.map((note) => (
              <View key={note} style={styles.noteRow}>
                <View style={styles.noteDot} />
                <Text style={styles.noteText}>{note}</Text>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.paper, flex: 1 },
  header: { alignItems: 'center', flexDirection: 'row', gap: 12, padding: spacing.md },
  backButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  title: { color: colors.ink, fontSize: 20, fontWeight: '900' },
  content: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
  brandRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  appIcon: { borderRadius: radius.md, height: 56, width: 56 },
  brandText: { flex: 1 },
  appName: { color: colors.ink, fontSize: 18, fontWeight: '900' },
  appVersion: { color: colors.muted, fontSize: 13, fontWeight: '600', marginTop: 2 },
  paragraph: { color: colors.ink, fontSize: 14, lineHeight: 21, marginBottom: spacing.md },
  legalLinks: { gap: spacing.sm, marginBottom: spacing.lg },
  legalLink: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  legalLinkText: { color: colors.ink, flex: 1, fontSize: 14, fontWeight: '800' },
  sectionTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '900',
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
    textTransform: 'uppercase',
  },
  entry: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.sm,
    padding: spacing.md,
  },
  entryHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
  entryVersion: { color: colors.teal, fontSize: 14, fontWeight: '900' },
  entryDate: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  noteRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  noteDot: { backgroundColor: colors.signal, borderRadius: 3, height: 6, marginTop: 6, width: 6 },
  noteText: { color: colors.ink, flex: 1, fontSize: 13, lineHeight: 19 },
});
