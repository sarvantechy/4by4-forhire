import type { StoreOwnerResponse } from '@4by4/api-client';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { SafeAreaView } from '@/components/GradientBackground';
import { SignInGate } from '@/components/SignInGate';
import { apiClient } from '@/services/api';
import { getAccessToken } from '@/services/sessionStore';
import { colors, radius, spacing } from '@/theme';

export default function MyStoresScreen() {
  const [stores, setStores] = useState<StoreOwnerResponse[]>([]);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [locality, setLocality] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) {
      setSignedIn(false);
      setLoading(false);
      return;
    }
    setSignedIn(true);
    try {
      setStores(await apiClient.listMyStores(token));
      setError('');
    } catch (error_) {
      setError(error_ instanceof Error ? error_.message : 'Unable to load your stores.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  async function createStore() {
    if (displayName.trim().length < 2 || locality.trim().length < 2) {
      setError('Enter a store name and locality.');
      return;
    }
    const token = await getAccessToken();
    if (!token) return;
    setBusy(true);
    setError('');
    try {
      await apiClient.createStore({
        description: description.trim(),
        display_name: displayName.trim(),
        public_locality: locality.trim(),
      }, undefined, token);
      setDisplayName('');
      setDescription('');
      setLocality('');
      setCreating(false);
      await load();
    } catch (error_) {
      setError(error_ instanceof Error ? error_.message : 'Unable to create your store.');
    } finally {
      setBusy(false);
    }
  }

  if (signedIn === false) {
    return (
      <SignInGate
        icon="storefront-outline"
        subtitle="Sign in to create a store and group your rental listings."
        title="Sign in to manage stores"
      />
    );
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Back" onPress={() => router.back()} style={styles.iconButton}>
          <Ionicons color={colors.ink} name="chevron-back" size={22} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text accessibilityRole="header" style={styles.title}>My Stores</Text>
          <Text style={styles.subtitle}>Group your items under a public store name.</Text>
        </View>
        <Pressable accessibilityLabel="Create store" onPress={() => setCreating((value) => !value)} style={styles.addButton}>
          <Ionicons color={colors.ink} name={creating ? 'close' : 'add'} size={22} />
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.teal} style={styles.loading} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {creating ? (
            <View style={styles.formCard}>
              <Text style={styles.sectionTitle}>Create store</Text>
              <Text style={styles.label}>Store name</Text>
              <TextInput onChangeText={setDisplayName} placeholder="e.g. Sarvan Tools" placeholderTextColor={colors.muted} style={styles.input} value={displayName} />
              <Text style={styles.label}>Public locality</Text>
              <TextInput onChangeText={setLocality} placeholder="e.g. Nagercoil" placeholderTextColor={colors.muted} style={styles.input} value={locality} />
              <Text style={styles.label}>Description</Text>
              <TextInput multiline onChangeText={setDescription} placeholder="What do you rent?" placeholderTextColor={colors.muted} style={[styles.input, styles.description]} value={description} />
              <Pressable disabled={busy} onPress={createStore} style={styles.primaryButton}>
                {busy ? <ActivityIndicator color={colors.surface} /> : <Text style={styles.primaryButtonText}>Create store</Text>}
              </Pressable>
            </View>
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {stores.length === 0 && !creating ? (
            <View style={styles.empty}>
              <Ionicons color={colors.teal} name="storefront-outline" size={34} />
              <Text style={styles.emptyTitle}>No stores yet</Text>
              <Text style={styles.emptyText}>Create a store, then choose it while listing an item.</Text>
              <Pressable onPress={() => setCreating(true)} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Create your first store</Text>
              </Pressable>
            </View>
          ) : null}

          {stores.map((store) => (
            <View key={store.id} style={styles.storeCard}>
              <View style={styles.storeIcon}>
                <Ionicons color={colors.teal} name="storefront" size={24} />
              </View>
              <View style={styles.storeBody}>
                <View style={styles.storeTitleRow}>
                  <Text numberOfLines={1} style={styles.storeName}>{store.display_name}</Text>
                  <Text style={styles.status}>{store.status}</Text>
                </View>
                <Text style={styles.locality}>{store.public_locality}</Text>
                <Text style={styles.counts}>
                  {store.listing_counts.active} active · {store.listing_counts.draft} draft · {store.listing_counts.total} total
                </Text>
                {store.description ? <Text numberOfLines={2} style={styles.storeDescription}>{store.description}</Text> : null}
              </View>
              <Pressable
                accessibilityLabel={`Add an item to ${store.display_name}`}
                onPress={() => router.push({ pathname: '/list-item', params: { storeId: store.id } })}
                style={styles.addItemButton}
              >
                <Ionicons color={colors.surface} name="add" size={18} />
              </Pressable>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.paper, flex: 1 },
  header: { alignItems: 'center', flexDirection: 'row', gap: 12, padding: spacing.md },
  headerCopy: { flex: 1 },
  title: { color: colors.ink, fontSize: 24, fontWeight: '900' },
  subtitle: { color: colors.muted, fontSize: 12, marginTop: 2 },
  iconButton: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: 20, height: 40, justifyContent: 'center', width: 40 },
  addButton: { alignItems: 'center', backgroundColor: colors.signal, borderRadius: 20, height: 40, justifyContent: 'center', width: 40 },
  loading: { marginTop: 60 },
  content: { gap: 12, padding: spacing.md, paddingBottom: 40 },
  formCard: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radius.lg, borderWidth: 1, padding: spacing.md },
  sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: '900', marginBottom: 8 },
  label: { color: colors.ink, fontSize: 12, fontWeight: '800', marginBottom: 6, marginTop: 10 },
  input: { backgroundColor: colors.paper, borderColor: colors.line, borderRadius: radius.md, borderWidth: 1, color: colors.ink, minHeight: 46, paddingHorizontal: 12 },
  description: { minHeight: 90, paddingTop: 12, textAlignVertical: 'top' },
  primaryButton: { alignItems: 'center', alignSelf: 'stretch', backgroundColor: colors.teal, borderRadius: radius.md, justifyContent: 'center', marginTop: 16, minHeight: 48 },
  primaryButtonText: { color: colors.surface, fontSize: 14, fontWeight: '900' },
  error: { color: colors.danger, fontSize: 13, textAlign: 'center' },
  empty: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radius.lg, borderWidth: 1, padding: 24 },
  emptyTitle: { color: colors.ink, fontSize: 17, fontWeight: '900', marginTop: 10 },
  emptyText: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 5, textAlign: 'center' },
  storeCard: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radius.lg, borderWidth: 1, flexDirection: 'row', gap: 12, padding: 14 },
  storeIcon: { alignItems: 'center', backgroundColor: colors.paper, borderRadius: radius.md, height: 48, justifyContent: 'center', width: 48 },
  storeBody: { flex: 1 },
  storeTitleRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  storeName: { color: colors.ink, flex: 1, fontSize: 16, fontWeight: '900' },
  status: { color: colors.teal, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  locality: { color: colors.muted, fontSize: 12, marginTop: 3 },
  counts: { color: colors.ink, fontSize: 11, fontWeight: '700', marginTop: 6 },
  storeDescription: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 5 },
  addItemButton: { alignItems: 'center', backgroundColor: colors.teal, borderRadius: 18, height: 36, justifyContent: 'center', width: 36 },
});
