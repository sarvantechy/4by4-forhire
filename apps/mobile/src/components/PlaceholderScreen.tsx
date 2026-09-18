import { Ionicons } from '@expo/vector-icons';
import { Href, Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

type PlaceholderScreenProps = {
  eyebrow: string;
  title: string;
  message: string;
  icon: IconName;
  actionLabel?: string;
  actionHref?: Href;
};

export function PlaceholderScreen({
  eyebrow,
  title,
  message,
  icon,
  actionLabel = 'Back home',
  actionHref = '/',
}: PlaceholderScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.container}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text accessibilityRole="header" style={styles.title}>{title}</Text>
        <View style={styles.emptyState}>
          <View style={styles.iconBox}>
            <Ionicons name={icon} size={28} color={colors.surface} />
          </View>
          <Text style={styles.message}>{message}</Text>
          <Link href={actionHref} style={styles.action}>{actionLabel}</Link>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.paper },
  container: { flex: 1, paddingHorizontal: 22, paddingTop: 34 },
  eyebrow: {
    color: colors.teal,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  title: { color: colors.ink, fontSize: 34, fontWeight: '800', marginTop: 7 },
  emptyState: {
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    gap: 18,
    marginTop: 28,
    padding: 24,
  },
  iconBox: {
    alignItems: 'center',
    backgroundColor: colors.teal,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  message: { color: colors.muted, fontSize: 16, lineHeight: 23 },
  action: {
    borderColor: colors.ink,
    borderWidth: 2,
    color: colors.ink,
    fontSize: 15,
    fontWeight: '800',
    minHeight: 44,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
});
