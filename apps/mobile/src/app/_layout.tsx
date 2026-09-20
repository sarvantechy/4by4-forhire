import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="login" options={{ presentation: 'modal' }} />
        <Stack.Screen name="edit-profile" options={{ presentation: 'modal' }} />
        <Stack.Screen name="location-picker" options={{ presentation: 'modal' }} />
        <Stack.Screen name="listing-chat" />
        <Stack.Screen name="listing/[id]" />
        <Stack.Screen name="booking/[id]" />
        <Stack.Screen name="map" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="offers" />
        <Stack.Screen name="blocked-users" />
        <Stack.Screen name="stores/index" />
        <Stack.Screen name="about" />
      </Stack>
    </>
  );
}
