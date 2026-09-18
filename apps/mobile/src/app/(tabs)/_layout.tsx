import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { colors } from '@/theme';

const icons = {
  index: ['home-outline', 'home'] as const,
  explore: ['search-outline', 'search'] as const,
  'list-item': ['add-circle-outline', 'add-circle'] as const,
  bookings: ['calendar-outline', 'calendar'] as const,
  account: ['person-outline', 'person'] as const,
};

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.teal,
        tabBarInactiveTintColor: colors.muted,
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.line, height: 64 },
      }}
    >
      {Object.entries(icons).map(([name, iconNames]) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title: name === 'list-item'
              ? 'List item'
              : `${name.charAt(0).toUpperCase()}${name.slice(1)}`,
            tabBarAccessibilityLabel: `${name.replace('-', ' ')} tab`,
            tabBarIcon: ({ color, focused, size }) => (
              <Ionicons name={iconNames[focused ? 1 : 0]} color={color} size={size} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
