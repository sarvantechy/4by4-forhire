import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { translate } from '@4by4/i18n';

import { colors } from '@/theme';

const categories = [
  { name: 'Tools & repair', icon: 'hammer-outline' as const },
  { name: 'Cleaning', icon: 'sparkles-outline' as const },
  { name: 'Events', icon: 'musical-notes-outline' as const },
  { name: 'Garden & farm', icon: 'leaf-outline' as const },
];

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>4×4 FOR HIRE</Text>
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={15} color={colors.teal} />
              <Text style={styles.location}>Nagercoil, Kanyakumari</Text>
            </View>
          </View>
          <Pressable accessibilityLabel="Open notifications" style={styles.iconButton}>
            <Ionicons name="notifications-outline" size={22} color={colors.ink} />
          </Pressable>
        </View>

        <ImageBackground
          source={{ uri: 'https://images.unsplash.com/photo-1530124566582-a618bc2615dc?auto=format&fit=crop&w=1200&q=85' }}
          style={styles.searchHero}
          imageStyle={styles.heroImage}
        >
          <View style={styles.heroOverlay} />
          <View style={styles.heroContent}>
            <Text style={styles.pilotLabel}>Kanyakumari pilot</Text>
            <Text accessibilityRole="header" style={styles.heroTitle}>
              {translate('en', 'home.heroTitle')}
            </Text>
            <Pressable style={styles.searchBox} onPress={() => router.push('/explore')}>
              <Ionicons name="search" size={20} color={colors.muted} />
              <TextInput
                editable={false}
                pointerEvents="none"
                placeholder="Drill, ladder, speaker..."
                placeholderTextColor={colors.muted}
                style={styles.searchInput}
              />
            </Pressable>
          </View>
        </ImageBackground>

        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.eyebrow}>Browse locally</Text>
            <Text style={styles.sectionTitle}>{translate('en', 'home.popularCategories')}</Text>
          </View>
          <Pressable onPress={() => router.push('/explore')}>
            <Text style={styles.viewAll}>View all</Text>
          </Pressable>
        </View>

        <View style={styles.categoryGrid}>
          {categories.map((category) => (
            <Pressable
              accessibilityRole="button"
              key={category.name}
              onPress={() => router.push('/explore')}
              style={styles.categoryTile}
            >
              <Ionicons name={category.icon} size={26} color={colors.teal} />
              <Text style={styles.categoryName}>{category.name}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.eyebrow}>Available around you</Text>
            <Text style={styles.sectionTitle}>Nearby items</Text>
          </View>
        </View>

        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Ionicons name="locate-outline" size={26} color={colors.surface} />
          </View>
          <View style={styles.emptyCopy}>
            <Text style={styles.emptyTitle}>{translate('en', 'home.nearbyEmpty')}</Text>
            <Text style={styles.emptyMessage}>
              Local inventory will appear here as owners publish approved items.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.paper },
  content: { paddingBottom: 32 },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  brand: { color: colors.ink, fontSize: 17, fontWeight: '900' },
  locationRow: { alignItems: 'center', flexDirection: 'row', gap: 4, marginTop: 4 },
  location: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  iconButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  searchHero: { minHeight: 330, justifyContent: 'flex-end' },
  heroImage: { borderRadius: 0 },
  heroOverlay: {
    backgroundColor: 'rgba(10, 25, 22, 0.66)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  heroContent: { padding: 24 },
  pilotLabel: {
    color: colors.signal,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  heroTitle: { color: colors.surface, fontSize: 38, fontWeight: '900', marginTop: 8 },
  searchBox: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    flexDirection: 'row',
    gap: 10,
    marginTop: 24,
    minHeight: 54,
    paddingHorizontal: 16,
  },
  searchInput: { color: colors.ink, flex: 1, fontSize: 15 },
  sectionHeading: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 32,
  },
  eyebrow: { color: colors.teal, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  sectionTitle: { color: colors.ink, fontSize: 25, fontWeight: '900', marginTop: 4 },
  viewAll: { color: colors.teal, fontSize: 14, fontWeight: '800' },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  categoryTile: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    gap: 12,
    minHeight: 110,
    padding: 17,
    width: '48%',
  },
  categoryName: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  emptyState: {
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 16,
    marginHorizontal: 20,
    marginTop: 16,
    padding: 20,
  },
  emptyIcon: {
    alignItems: 'center',
    backgroundColor: colors.teal,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  emptyCopy: { flex: 1 },
  emptyTitle: { color: colors.ink, fontSize: 17, fontWeight: '800' },
  emptyMessage: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 5 },
});
