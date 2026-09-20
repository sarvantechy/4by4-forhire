import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PhotoCollageBackdrop } from '@/components/PhotoCollageBackdrop';
import { apiClient } from '@/services/api';
import { saveSession } from '@/services/sessionStore';
import { colors } from '@/theme';

type Mode = 'mobile' | 'email';

const DEMO_MOBILE_NUMBER = '+919999999999';
const DEMO_DISPLAY_NAME = 'Demo Renter';

export default function LoginScreen() {
  const [mode, setMode] = useState<Mode>('mobile');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [formAnim] = useState(() => new Animated.Value(0));
  const [badgeAnim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(formAnim, { duration: 620, toValue: 1, useNativeDriver: true }).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(badgeAnim, { duration: 1400, toValue: 1, useNativeDriver: true }),
        Animated.timing(badgeAnim, { duration: 1400, toValue: 0, useNativeDriver: true }),
      ]),
    ).start();
  }, [badgeAnim, formAnim]);

  async function continueWithMobile() {
    setBusy(true);
    setError('');
    try {
      const session = await apiClient.registerMobileDirect({
        client_type: 'mobile',
        device_label: `${Platform.OS} app`,
        display_name: displayName || undefined,
        mobile_number: mobileNumber,
      });
      if (!session.access_token || !session.refresh_token) {
        throw new Error('The mobile session did not include tokens.');
      }
      await saveSession(session.access_token, session.refresh_token);
      router.replace('/account');
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Unable to continue with this mobile number.';
      setError(
        message.toLowerCase().includes('display name')
          ? 'Enter your name to finish creating this account.'
          : message,
      );
    } finally {
      setBusy(false);
    }
  }

  async function continueWithEmail() {
    setBusy(true);
    setError('');
    try {
      const session = await apiClient.registerEmailDirect({
        client_type: 'mobile',
        device_label: `${Platform.OS} app`,
        display_name: displayName || email.split('@')[0] || 'Owner',
        email,
        password,
      });
      if (!session.access_token || !session.refresh_token) {
        throw new Error('The mobile session did not include tokens.');
      }
      await saveSession(session.access_token, session.refresh_token);
      router.replace('/account');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to continue with this email.');
    } finally {
      setBusy(false);
    }
  }

  async function continueWithDemo() {
    setBusy(true);
    setError('');
    try {
      const session = await apiClient.registerMobileDirect({
        client_type: 'mobile',
        device_label: `${Platform.OS} app`,
        display_name: DEMO_DISPLAY_NAME,
        mobile_number: DEMO_MOBILE_NUMBER,
      });
      if (!session.access_token || !session.refresh_token) {
        throw new Error('The demo session did not include tokens.');
      }
      await saveSession(session.access_token, session.refresh_token);
      router.replace('/account');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to start the demo session.');
    } finally {
      setBusy(false);
    }
  }

  const formStyle = {
    opacity: formAnim,
    transform: [
      { translateY: formAnim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) },
    ],
  };
  const badgeStyle = {
    transform: [
      { scale: badgeAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) },
    ],
  };

  return (
    <View style={styles.root}>
      <PhotoCollageBackdrop />
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.safeArea}
        >
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Pressable accessibilityLabel="Close sign in" onPress={() => router.back()} style={styles.close}>
              <Ionicons name="close" size={24} color={colors.ink} />
            </Pressable>

            <Animated.View style={badgeStyle}>
              <View style={styles.badge}>
                <Ionicons name="flash" size={14} color={colors.ink} />
                <Text style={styles.badgeText}>Rent & hire, instantly</Text>
              </View>
            </Animated.View>

            <Animated.View style={formStyle}>
              <Text style={styles.eyebrow}>Get started in seconds</Text>
              <Text accessibilityRole="header" style={styles.title}>Join For Hire</Text>
              <Text style={styles.subtitle}>
                No verification step right now — enter your details and start browsing or listing.
              </Text>

              <View style={styles.segmented}>
                <Pressable
                  onPress={() => setMode('mobile')}
                  style={[styles.segment, mode === 'mobile' && styles.segmentActive]}
                >
                  <Text style={[styles.segmentText, mode === 'mobile' && styles.segmentTextActive]}>Mobile number</Text>
                </Pressable>
                <Pressable
                  onPress={() => setMode('email')}
                  style={[styles.segment, mode === 'email' && styles.segmentActive]}
                >
                  <Text style={[styles.segmentText, mode === 'email' && styles.segmentTextActive]}>Email</Text>
                </Pressable>
              </View>

              <Pressable disabled={busy} onPress={continueWithDemo} style={styles.demoButton}>
                <Ionicons name="sparkles" size={16} color={colors.teal} />
                <Text style={styles.demoButtonText}>Try the demo account</Text>
              </Pressable>

              <View style={styles.form}>
                <TextInput
                  onChangeText={setDisplayName}
                  placeholder="Your name"
                  placeholderTextColor={colors.muted}
                  style={styles.input}
                  value={displayName}
                />

                {mode === 'mobile' && (
                  <>
                    <TextInput
                      autoComplete="tel"
                      keyboardType="phone-pad"
                      onChangeText={setMobileNumber}
                      placeholder="Indian mobile number"
                      placeholderTextColor={colors.muted}
                      style={styles.input}
                      value={mobileNumber}
                    />
                    <Pressable disabled={busy || mobileNumber.length < 10} onPress={continueWithMobile} style={styles.submit}>
                      {busy ? <ActivityIndicator color={colors.ink} /> : <Text style={styles.submitText}>Continue</Text>}
                    </Pressable>
                  </>
                )}

                {mode === 'email' && (
                  <>
                    <TextInput
                      autoCapitalize="none"
                      autoComplete="email"
                      keyboardType="email-address"
                      onChangeText={setEmail}
                      placeholder="Email address"
                      placeholderTextColor={colors.muted}
                      style={styles.input}
                      value={email}
                    />
                    <TextInput
                      autoComplete="password"
                      onChangeText={setPassword}
                      placeholder="Password"
                      placeholderTextColor={colors.muted}
                      secureTextEntry
                      style={styles.input}
                      value={password}
                    />
                    <Pressable disabled={busy || email.length < 5 || password.length < 10} onPress={continueWithEmail} style={styles.submit}>
                      {busy ? <ActivityIndicator color={colors.ink} /> : <Text style={styles.submitText}>Continue</Text>}
                    </Pressable>
                  </>
                )}
                {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
              </View>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: colors.signal, flex: 1 },
  safeArea: { flex: 1 },
  content: { flexGrow: 1, padding: 24 },
  close: {
    alignItems: 'center',
    alignSelf: 'flex-end',
    backgroundColor: colors.ink,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  badge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.ink,
    flexDirection: 'row',
    gap: 6,
    marginTop: 18,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  badgeText: { color: colors.signal, fontSize: 12, fontWeight: '900' },
  eyebrow: { color: colors.ink, fontSize: 12, fontWeight: '900', marginTop: 20 },
  title: { color: colors.ink, fontSize: 38, fontWeight: '900', marginTop: 7 },
  subtitle: { color: 'rgba(23, 26, 31, 0.72)', fontSize: 16, lineHeight: 23, marginTop: 10 },
  segmented: {
    backgroundColor: 'rgba(23, 26, 31, 0.1)',
    borderColor: 'rgba(23, 26, 31, 0.28)',
    borderWidth: 1,
    flexDirection: 'row',
    gap: 1,
    marginTop: 30,
    padding: 3,
  },
  segment: { alignItems: 'center', flex: 1, minHeight: 44, justifyContent: 'center' },
  segmentActive: { backgroundColor: colors.ink },
  segmentText: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  segmentTextActive: { color: colors.signal },
  demoButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderColor: colors.teal,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  demoButtonText: { color: colors.teal, fontSize: 13, fontWeight: '800' },
  form: { gap: 14, marginTop: 24 },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 16,
    minHeight: 54,
    paddingHorizontal: 16,
  },
  submit: {
    alignItems: 'center',
    backgroundColor: colors.ink,
    justifyContent: 'center',
    minHeight: 52,
  },
  submitText: { color: colors.signal, fontSize: 16, fontWeight: '900' },
  note: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  error: {
    backgroundColor: '#FFF2F0',
    borderLeftColor: colors.danger,
    borderLeftWidth: 3,
    color: colors.danger,
    padding: 12,
  },
});
