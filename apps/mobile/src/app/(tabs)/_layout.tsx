import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';
import { StyleSheet, View } from 'react-native';

import { PoweredByFooter } from '@/components/PoweredByFooter';
import { colors } from '@/theme';

const TAB_BAR_HEIGHT = 64;

const icons = {
  index: ['home-outline', 'home'] as const,
  explore: ['search-outline', 'search'] as const,
  'list-item': ['add', 'add'] as const,
  bookings: ['calendar-outline', 'calendar'] as const,
  account: ['person-outline', 'person'] as const,
};

const TAB_COLORS: Record<string, string> = {
  index: colors.teal,
  explore: '#3B82F6',
  'list-item': colors.signal,
  bookings: '#F59E0B',
  account: '#EC4899',
};

type TabIconProps = Readonly<{
  color: ColorValue;
  focused: boolean;
  iconNames: readonly [string, string];
  isFab: boolean;
  size: number;
}>;

function TabIcon({ color, focused, iconNames, isFab, size }: TabIconProps) {
  if (isFab) {
    return (
      <View style={styles.fab}>
        <Ionicons name={iconNames[0] as never} color={colors.ink} size={size + 4} />
      </View>
    );
  }
  return <Ionicons name={iconNames[focused ? 1 : 0] as never} color={color} size={size} />;
}

const tabIconRenderers = Object.fromEntries(
  Object.entries(icons).map(([name, iconNames]) => [
    name,
    ({ color, focused, size }: { color: ColorValue; focused: boolean; size: number }) => (
      <TabIcon color={color} focused={focused} iconNames={iconNames} isFab={name === 'list-item'} size={size} />
    ),
  ]),
) as Record<string, (props: { color: ColorValue; focused: boolean; size: number }) => React.JSX.Element>;

export default function TabLayout() {
  return (
    <View style={styles.root}>
      <View style={styles.tabsArea}>
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: colors.teal,
            tabBarInactiveTintColor: colors.muted,
            tabBarHideOnKeyboard: true,
            tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
            tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.line, height: TAB_BAR_HEIGHT },
          }}
        >
          {Object.keys(icons).map((name) => (
            <Tabs.Screen
              key={name}
              name={name}
              options={{
                title: name === 'list-item'
                  ? 'List item'
                  : `${name.charAt(0).toUpperCase()}${name.slice(1)}`,
                tabBarAccessibilityLabel: `${name.replace('-', ' ')} tab`,
                tabBarActiveTintColor: TAB_COLORS[name],
                tabBarIcon: tabIconRenderers[name],
                tabBarLabelStyle: name === 'list-item'
                  ? { color: colors.signal, fontSize: 11, fontWeight: '900' }
                  : undefined,
              }}
            />
          ))}
        </Tabs>
      </View>
      <PoweredByFooter />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  tabsArea: {
    flex: 1,
  },
  fab: {
    alignItems: 'center',
    backgroundColor: colors.signal,
    borderRadius: 28,
    height: 48,
    justifyContent: 'center',
    marginTop: -18,
    width: 48,
  },
});
