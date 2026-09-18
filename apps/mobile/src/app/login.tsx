import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
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

import { apiClient } from '@/services/api';
import { saveSession } from '@/services/sessionStore';
import { colors } from '@/theme';

type Mode = 'email' | 'mobile' | 'verify-mobile';

export default function LoginScreen() {
  const [mode, setMode] = useState<Mode>('mobile');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function continueWithEmail() {
    setBusy(true);
    setError('');
    try {
      const session = await apiClient.loginEmail({
        client_type: 'mobile',
        device_label: `${Platform.OS} app`,
        email,
        password,
      });
      if (!session.access_token || !session.refresh_token) {
        throw new Error('The mobile session did not include tokens.');
      }
      await saveSession(session.access_token, session.refresh_token);
      router.replace('/account');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to sign in.');
    } finally {
      setBusy(false);
    }
  }

  async function requestCode() {
    setBusy(true);
    setError('');
    try {
      const challenge = await apiClient.requestMobileOTP({ mobile_number: mobileNumber });
      setChallengeId(challenge.challenge_id);
      setMode('verify-mobile');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to request a code.');
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode() {
    setBusy(true);
    setError('');
    try {
      const session = await apiClient.verifyMobileOTP({
        challenge_id: challengeId,
        client_type: 'mobile',
        code,
        device_label: `${Platform.OS} app`,
        display_name: displayName || undefined,
      });
      if (!session.access_token || !session.refresh_token) {
        throw new Error('The mobile session did not include tokens.');
      }
      await saveSession(session.access_token, session.refresh_token);
      router.replace('/account');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to verify the code.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.safeArea}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Pressable accessibilityLabel="Close sign in" onPress={() => router.back()} style={styles.close}>
            <Ionicons name="close" size={24} color={colors.ink} />
          </Pressable>
          <Text style={styles.eyebrow}>Private account access</Text>
          <Text accessibilityRole="header" style={styles.title}>Sign in to For Hire</Text>
          <Text style={styles.subtitle}>Your contact details stay hidden from other users.</Text>

          {mode !== 'verify-mobile' && (
            <View style={styles.segmented}>
              <Pressable
                onPress={() => setMode('mobile')}
                style={[styles.segment, mode === 'mobile' && styles.segmentActive]}
              >
                <Text style={styles.segmentText}>Mobile OTP</Text>
              </Pressable>
              <Pressable
                onPress={() => setMode('email')}
                style={[styles.segment, mode === 'email' && styles.segmentActive]}
              >
                <Text style={styles.segmentText}>Email</Text>
              </Pressable>
            </View>
          )}

          <View style={styles.form}>
            {mode === 'email' && (
              <>
                <TextInput
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  onChangeText={setEmail}
                  placeholder="Email address"
                  style={styles.input}
                  value={email}
                />
                <TextInput
                  autoComplete="password"
                  onChangeText={setPassword}
                  placeholder="Password"
                  secureTextEntry
                  style={styles.input}
                  value={password}
                />
                <Pressable disabled={busy} onPress={continueWithEmail} style={styles.submit}>
                  {busy ? <ActivityIndicator color={colors.ink} /> : <Text style={styles.submitText}>Sign in</Text>}
                </Pressable>
              </>
            )}

            {mode === 'mobile' && (
              <>
                <TextInput
                  autoComplete="tel"
                  keyboardType="phone-pad"
                  onChangeText={setMobileNumber}
                  placeholder="Indian mobile number"
                  style={styles.input}
                  value={mobileNumber}
                />
                <Pressable disabled={busy} onPress={requestCode} style={styles.submit}>
                  {busy ? <ActivityIndicator color={colors.ink} /> : <Text style={styles.submitText}>Send code</Text>}
                </Pressable>
              </>
            )}

            {mode === 'verify-mobile' && (
              <>
                <Text style={styles.note}>Enter the code from the local verification inbox during development.</Text>
                <TextInput
                  keyboardType="number-pad"
                  maxLength={6}
                  onChangeText={setCode}
                  placeholder="6-digit code"
                  style={styles.input}
                  value={code}
                />
                <TextInput
                  onChangeText={setDisplayName}
                  placeholder="Display name (new accounts)"
                  style={styles.input}
                  value={displayName}
                />
                <Pressable disabled={busy} onPress={verifyCode} style={styles.submit}>
                  {busy ? <ActivityIndicator color={colors.ink} /> : <Text style={styles.submitText}>Verify</Text>}
                </Pressable>
              </>
            )}
            {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.paper },
  content: { flexGrow: 1, padding: 24 },
  close: {
    alignItems: 'center',
    alignSelf: 'flex-end',
    backgroundColor: colors.surface,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  eyebrow: { color: colors.teal, fontSize: 12, fontWeight: '900', marginTop: 28 },
  title: { color: colors.ink, fontSize: 38, fontWeight: '900', marginTop: 7 },
  subtitle: { color: colors.muted, fontSize: 16, lineHeight: 23, marginTop: 10 },
  segmented: {
    backgroundColor: colors.line,
    flexDirection: 'row',
    gap: 1,
    marginTop: 30,
    padding: 3,
  },
  segment: { alignItems: 'center', flex: 1, minHeight: 44, justifyContent: 'center' },
  segmentActive: { backgroundColor: colors.surface },
  segmentText: { color: colors.ink, fontSize: 14, fontWeight: '800' },
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
    backgroundColor: colors.signal,
    justifyContent: 'center',
    minHeight: 52,
  },
  submitText: { color: colors.ink, fontSize: 16, fontWeight: '900' },
  note: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  error: {
    backgroundColor: '#FFF2F0',
    borderLeftColor: colors.danger,
    borderLeftWidth: 3,
    color: colors.danger,
    padding: 12,
  },
});
