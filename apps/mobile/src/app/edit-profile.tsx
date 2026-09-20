import type { AddressResponse, SessionResponse, UserResponse } from '@4by4/api-client';
import { Ionicons } from '@expo/vector-icons';
import { File as ExpoFile } from 'expo-file-system';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from '@/components/GradientBackground';

import { apiClient } from '@/services/api';
import { setLocale } from '@/services/localeStore';
import { clearSession, getAccessToken } from '@/services/sessionStore';
import { colors, radius } from '@/theme';

type Language = 'en' | 'ta';

const EMPTY_ADDRESS_FORM = {
  label: 'Home',
  addressLine1: '',
  addressLine2: '',
  locality: '',
  district: '',
  state: 'Tamil Nadu',
  postalCode: '',
};

export default function EditProfileScreen() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const [displayName, setDisplayName] = useState('');
  const [homeLocality, setHomeLocality] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState<Language>('en');
  const [email, setEmail] = useState<string | null>(null);
  const [mobileNumber, setMobileNumber] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const [addresses, setAddresses] = useState<AddressResponse[]>([]);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [addressForm, setAddressForm] = useState(EMPTY_ADDRESS_FORM);

  const [sessions, setSessions] = useState<SessionResponse[]>([]);

  useEffect(() => {
    let active = true;
    async function bootstrap() {
      const token = await getAccessToken();
      if (!token) {
        if (active) {
          setError('Sign in to edit your profile.');
          setLoading(false);
        }
        return;
      }
      try {
        const [me, addressList, sessionList] = await Promise.all([
          apiClient.getCurrentUser(token),
          apiClient.listAddresses(token),
          apiClient.listSessions(token),
        ]);
        if (!active) return;
        applyUser(me);
        setAddresses(addressList);
        setSessions(sessionList);
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : 'Unable to load your profile.');
      } finally {
        if (active) setLoading(false);
      }
    }
    bootstrap();
    return () => {
      active = false;
    };
  }, []);

  function applyUser(me: UserResponse) {
    setDisplayName(me.display_name);
    setHomeLocality(me.home_locality ?? '');
    const language = me.preferred_language === 'ta' ? 'ta' : 'en';
    setPreferredLanguage(language);
    setLocale(language);
    setEmail(me.email ?? null);
    setMobileNumber(me.mobile_number ?? null);
    setAvatarUrl(me.avatar_url ?? null);
  }

  async function pickAvatar() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Photo library access is needed to change your photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const token = await getAccessToken();
    if (!token) return;
    setAvatarBusy(true);
    setError('');
    try {
      const me = await apiClient.uploadAvatar(
        new ExpoFile(asset.uri),
        undefined,
        token,
      );
      applyUser(me);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to update your photo.');
    } finally {
      setAvatarBusy(false);
    }
  }

  async function save() {
    const token = await getAccessToken();
    if (!token) return;
    setBusy(true);
    setError('');
    setSaved(false);
    try {
      const me = await apiClient.updateProfile(
        {
          display_name: displayName,
          home_locality: homeLocality || null,
          preferred_language: preferredLanguage,
        },
        undefined,
        token,
      );
      applyUser(me);
      setSaved(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save your profile.');
    } finally {
      setBusy(false);
    }
  }

  function startAddAddress() {
    setEditingAddressId(null);
    setAddressForm(EMPTY_ADDRESS_FORM);
    setShowAddressForm(true);
  }

  function startEditAddress(address: AddressResponse) {
    setEditingAddressId(address.id);
    setAddressForm({
      label: address.label,
      addressLine1: address.address_line_1,
      addressLine2: address.address_line_2 ?? '',
      locality: address.locality,
      district: address.district,
      state: address.state,
      postalCode: address.postal_code,
    });
    setShowAddressForm(true);
  }

  async function saveAddress() {
    const token = await getAccessToken();
    if (!token) return;
    const label = addressForm.label.trim() || 'Home';
    const addressLine1 = addressForm.addressLine1.trim();
    const locality = addressForm.locality.trim();
    const district = addressForm.district.trim();
    const state = addressForm.state.trim();
    const postalCode = addressForm.postalCode.trim();
    if (label.length < 2) {
      setError('Label must be at least 2 characters.');
      return;
    }
    if (addressLine1.length < 3) {
      setError('Address line 1 must be at least 3 characters.');
      return;
    }
    if (locality.length < 2 || district.length < 2 || state.length < 2) {
      setError('Locality, district, and state must each be at least 2 characters.');
      return;
    }
    if (!/^\d{6}$/.test(postalCode)) {
      setError('Postal code must be exactly 6 digits.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const payload = {
        address_line_1: addressLine1,
        address_line_2: addressForm.addressLine2.trim() || null,
        district,
        label,
        locality,
        postal_code: postalCode,
        state,
      };
      const savedAddress = editingAddressId
        ? await apiClient.updateAddress(editingAddressId, payload, undefined, token)
        : await apiClient.createAddress(payload, undefined, token);
      setAddresses((current) => {
        const withoutSaved = current.filter((item) => item.id !== savedAddress.id);
        return [...withoutSaved, savedAddress];
      });
      const me = await apiClient.getCurrentUser(token);
      applyUser(me);
      setShowAddressForm(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save this address.');
    } finally {
      setBusy(false);
    }

  }

  async function removeAddress(addressId: string) {
    const token = await getAccessToken();
    if (!token) return;
    setBusy(true);
    setError('');
    try {
      await apiClient.deleteAddress(addressId, undefined, token);
      setAddresses((current) => current.filter((item) => item.id !== addressId));
      const me = await apiClient.getCurrentUser(token);
      applyUser(me);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to remove this address.');
    } finally {
      setBusy(false);
    }
  }

  async function revokeSession(sessionId: string) {
    const token = await getAccessToken();
    if (!token) return;
    setBusy(true);
    setError('');
    try {
      await apiClient.revokeSession(sessionId, undefined, token);
      setSessions((current) => current.filter((item) => item.id !== sessionId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to sign out that device.');
    } finally {
      setBusy(false);
    }
  }

  function confirmAccountDeletion() {
    Alert.alert(
      'Delete account?',
      'Your login details, addresses, profile photo, and listing photos will be removed immediately. Your listings and stores will be hidden. Booking, payment, message, dispute, and audit records may be retained where required.',
      [
        { style: 'cancel', text: 'Cancel' },
        {
          onPress: () => void deactivateAccount(),
          style: 'destructive',
          text: 'Delete account',
        },
      ],
    );
  }

  async function deactivateAccount() {
    const token = await getAccessToken();
    if (!token) return;
    setDeleting(true);
    setError('');
    try {
      await apiClient.deactivateAccount(undefined, token);
      await clearSession();
      router.replace('/login');
    } catch (error_) {
      setError(error_ instanceof Error ? error_.message : 'Unable to delete your account.');
      setDeleting(false);
    }
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text accessibilityRole="header" style={styles.title}>Edit profile</Text>
          <Pressable onPress={() => router.back()} style={styles.close}>
            <Ionicons name="close" size={22} color={colors.ink} />
          </Pressable>
        </View>
        <Text style={styles.subtitle}>
          Complete your details before listing anything — renters and owners see a trusted, complete
          profile.
        </Text>

        {loading ? (
          <ActivityIndicator color={colors.teal} size="large" style={styles.loading} />
        ) : (
          <>
            <View style={styles.avatarRow}>
              <Pressable onPress={pickAvatar} style={styles.avatarWrap}>
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Ionicons name="person" size={30} color={colors.muted} />
                  </View>
                )}
                <View style={styles.avatarEditBadge}>
                  {avatarBusy ? (
                    <ActivityIndicator color={colors.surface} size="small" />
                  ) : (
                    <Ionicons name="camera" size={13} color={colors.surface} />
                  )}
                </View>
              </Pressable>
              <View style={styles.avatarCopy}>
                <Text style={styles.avatarName}>{displayName || 'Your name'}</Text>
                <Text style={styles.avatarHint}>Tap the photo to change it</Text>
              </View>
            </View>

            <Text style={styles.label}>Display name</Text>
            <TextInput onChangeText={setDisplayName} style={styles.input} value={displayName} />

            {email ? (
              <>
                <Text style={styles.label}>Email</Text>
                <Text style={styles.readOnly}>{email}</Text>
              </>
            ) : null}
            {mobileNumber ? (
              <>
                <Text style={styles.label}>Mobile number</Text>
                <Text style={styles.readOnly}>{mobileNumber}</Text>
              </>
            ) : null}

            <Text style={styles.label}>Home locality</Text>
            <TextInput
              onChangeText={setHomeLocality}
              placeholder="e.g. Nagercoil"
              style={styles.input}
              value={homeLocality}
            />

            <Text style={styles.label}>Preferred language</Text>
            <View style={styles.languageRow}>
              <Pressable
                onPress={() => {
                  setPreferredLanguage('en');
                  setLocale('en');
                }}
                style={[styles.languageChip, preferredLanguage === 'en' && styles.languageChipActive]}
              >
                <Text style={[styles.languageChipText, preferredLanguage === 'en' && styles.languageChipTextActive]}>
                  English
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setPreferredLanguage('ta');
                  setLocale('ta');
                }}
                style={[styles.languageChip, preferredLanguage === 'ta' && styles.languageChipActive]}
              >
                <Text style={[styles.languageChipText, preferredLanguage === 'ta' && styles.languageChipTextActive]}>
                  தமிழ்
                </Text>
              </Pressable>
            </View>

            {saved ? <Text style={styles.success}>Profile saved.</Text> : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable disabled={busy} onPress={save} style={styles.submit}>
              {busy ? <ActivityIndicator color={colors.surface} /> : <Text style={styles.submitText}>Save profile</Text>}
            </Pressable>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Addresses</Text>
              <Pressable onPress={startAddAddress}>
                <Text style={styles.sectionAction}>+ Add address</Text>
              </Pressable>
            </View>

            {addresses.map((address) => (
              <View key={address.id} style={styles.addressCard}>
                <View style={styles.addressCardBody}>
                  <Text style={styles.addressLabel}>{address.label}</Text>
                  <Text style={styles.addressLine}>{address.address_line_1}</Text>
                  {address.address_line_2 ? <Text style={styles.addressLine}>{address.address_line_2}</Text> : null}
                  <Text style={styles.addressLine}>
                    {address.locality}, {address.district}, {address.state} {address.postal_code}
                  </Text>
                </View>
                <View style={styles.addressActions}>
                  <Pressable onPress={() => startEditAddress(address)} style={styles.addressActionButton}>
                    <Ionicons name="create-outline" size={17} color={colors.ink} />
                  </Pressable>
                  <Pressable onPress={() => removeAddress(address.id)} style={styles.addressActionButton}>
                    <Ionicons name="trash-outline" size={17} color={colors.danger} />
                  </Pressable>
                </View>
              </View>
            ))}
            {addresses.length === 0 ? <Text style={styles.emptyHint}>No saved addresses yet.</Text> : null}

            {showAddressForm ? (
              <View style={styles.addressForm}>
                <Text style={styles.label}>Label</Text>
                <TextInput
                  onChangeText={(value) => setAddressForm((form) => ({ ...form, label: value }))}
                  placeholder="Home"
                  style={styles.input}
                  value={addressForm.label}
                />
                <Text style={styles.label}>Address line 1</Text>
                <TextInput
                  onChangeText={(value) => setAddressForm((form) => ({ ...form, addressLine1: value }))}
                  style={styles.input}
                  value={addressForm.addressLine1}
                />
                <Text style={styles.label}>Address line 2 (optional)</Text>
                <TextInput
                  onChangeText={(value) => setAddressForm((form) => ({ ...form, addressLine2: value }))}
                  style={styles.input}
                  value={addressForm.addressLine2}
                />
                <Text style={styles.label}>Locality</Text>
                <TextInput
                  onChangeText={(value) => setAddressForm((form) => ({ ...form, locality: value }))}
                  style={styles.input}
                  value={addressForm.locality}
                />
                <Text style={styles.label}>District</Text>
                <TextInput
                  onChangeText={(value) => setAddressForm((form) => ({ ...form, district: value }))}
                  style={styles.input}
                  value={addressForm.district}
                />
                <Text style={styles.label}>State</Text>
                <TextInput
                  onChangeText={(value) => setAddressForm((form) => ({ ...form, state: value }))}
                  style={styles.input}
                  value={addressForm.state}
                />
                <Text style={styles.label}>Postal code</Text>
                <TextInput
                  keyboardType="number-pad"
                  maxLength={6}
                  onChangeText={(value) => setAddressForm((form) => ({ ...form, postalCode: value }))}
                  style={styles.input}
                  value={addressForm.postalCode}
                />
                <View style={styles.formActions}>
                  <Pressable onPress={() => setShowAddressForm(false)} style={styles.formCancel}>
                    <Text style={styles.formCancelText}>Cancel</Text>
                  </Pressable>
                  <Pressable disabled={busy} onPress={saveAddress} style={styles.formSave}>
                    {busy ? <ActivityIndicator color={colors.surface} /> : <Text style={styles.formSaveText}>Save address</Text>}
                  </Pressable>
                </View>
              </View>
            ) : null}

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Signed-in devices</Text>
            </View>
            {sessions.map((session) => (
              <View key={session.id} style={styles.sessionRow}>
                <View style={styles.sessionCopy}>
                  <Text style={styles.sessionLabel}>{session.device_label ?? session.client_type}</Text>
                  <Text style={styles.sessionMeta}>Expires {new Date(session.expires_at).toLocaleDateString()}</Text>
                </View>
                <Pressable onPress={() => revokeSession(session.id)} style={styles.sessionAction}>
                  <Text style={styles.sessionActionText}>Sign out</Text>
                </Pressable>
              </View>
            ))}
            {sessions.length === 0 ? <Text style={styles.emptyHint}>No other active sessions.</Text> : null}

            <View style={styles.dangerZone}>
              <Text style={styles.dangerTitle}>Delete account</Text>
              <Text style={styles.dangerText}>
                Permanently remove your login details and personal profile data. Required booking,
                payment, safety, and audit records may be retained.
              </Text>
              <Pressable disabled={deleting} onPress={confirmAccountDeletion} style={styles.deleteAccountButton}>
                {deleting ? (
                  <ActivityIndicator color={colors.surface} />
                ) : (
                  <Text style={styles.deleteAccountButtonText}>Delete my account</Text>
                )}
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.paper, flex: 1 },
  content: { padding: 22, paddingBottom: 50 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  title: { color: colors.ink, fontSize: 26, fontWeight: '900' },
  close: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 22,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: 8 },
  loading: { marginTop: 60 },
  avatarRow: { alignItems: 'center', flexDirection: 'row', gap: 14, marginTop: 20 },
  avatarWrap: { height: 72, width: 72 },
  avatarImage: { borderRadius: 36, height: 72, width: 72 },
  avatarPlaceholder: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 36,
    borderWidth: 1,
    height: 72,
    justifyContent: 'center',
    width: 72,
  },
  avatarEditBadge: {
    alignItems: 'center',
    backgroundColor: colors.teal,
    borderRadius: 12,
    bottom: -2,
    height: 24,
    justifyContent: 'center',
    position: 'absolute',
    right: -2,
    width: 24,
  },
  avatarCopy: { flex: 1 },
  avatarName: { color: colors.ink, fontSize: 17, fontWeight: '900' },
  avatarHint: { color: colors.muted, fontSize: 12, marginTop: 2 },
  label: { color: colors.ink, fontSize: 13, fontWeight: '800', marginBottom: 7, marginTop: 18 },
  readOnly: { color: colors.muted, fontSize: 15 },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 32,
  },
  sectionTitle: { color: colors.teal, fontSize: 14, fontWeight: '900', textTransform: 'uppercase' },
  sectionAction: { color: colors.teal, fontSize: 13, fontWeight: '800' },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 16,
    minHeight: 50,
    paddingHorizontal: 14,
  },
  languageRow: { flexDirection: 'row', gap: 8 },
  languageChip: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 18,
  },
  languageChipActive: { backgroundColor: colors.teal, borderColor: colors.teal },
  languageChipText: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  languageChipTextActive: { color: colors.surface },
  success: { color: colors.teal, fontSize: 13, fontWeight: '800', marginTop: 18 },
  error: {
    backgroundColor: '#FFF2F0',
    borderLeftColor: colors.danger,
    borderLeftWidth: 3,
    color: colors.danger,
    marginTop: 18,
    padding: 12,
  },
  submit: {
    alignItems: 'center',
    backgroundColor: colors.teal,
    justifyContent: 'center',
    marginTop: 24,
    minHeight: 52,
  },
  submitText: { color: colors.surface, fontSize: 16, fontWeight: '900' },
  emptyHint: { color: colors.muted, fontSize: 13, marginTop: 10 },
  addressCard: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    padding: 14,
  },
  addressCardBody: { flex: 1, gap: 2 },
  addressLabel: { color: colors.ink, fontSize: 13, fontWeight: '900' },
  addressLine: { color: colors.muted, fontSize: 13 },
  addressActions: { flexDirection: 'row', gap: 4 },
  addressActionButton: { alignItems: 'center', height: 32, justifyContent: 'center', width: 32 },
  addressForm: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.sm,
    borderWidth: 1,
    marginTop: 14,
    padding: 14,
  },
  formActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  formCancel: {
    alignItems: 'center',
    borderColor: colors.line,
    borderRadius: radius.sm,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 18,
  },
  formCancelText: { color: colors.muted, fontSize: 14, fontWeight: '800' },
  formSave: {
    alignItems: 'center',
    backgroundColor: colors.teal,
    borderRadius: radius.sm,
    flex: 1,
    justifyContent: 'center',
    minHeight: 46,
  },
  formSaveText: { color: colors.surface, fontSize: 14, fontWeight: '900' },
  sessionRow: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    padding: 12,
  },
  sessionCopy: { flex: 1 },
  sessionLabel: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  sessionMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  sessionAction: { paddingHorizontal: 10, paddingVertical: 6 },
  sessionActionText: { color: colors.danger, fontSize: 13, fontWeight: '800' },
  dangerZone: {
    backgroundColor: '#FFF2F0',
    borderColor: colors.danger,
    borderRadius: radius.sm,
    borderWidth: 1,
    marginTop: 32,
    padding: 14,
  },
  dangerTitle: { color: colors.danger, fontSize: 15, fontWeight: '900' },
  dangerText: { color: colors.ink, fontSize: 13, lineHeight: 19, marginTop: 6 },
  deleteAccountButton: {
    alignItems: 'center',
    backgroundColor: colors.danger,
    justifyContent: 'center',
    marginTop: 14,
    minHeight: 46,
  },
  deleteAccountButtonText: { color: colors.surface, fontSize: 14, fontWeight: '900' },
});
